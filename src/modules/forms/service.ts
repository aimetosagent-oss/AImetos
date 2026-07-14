import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { normalizeEmail, normalizePhone, sanitizeText } from "@/lib/normalization";
import { hashIdentifier } from "@/lib/tokens";
import { createOutboxEvent } from "@/modules/automation/outbox";
import { validateDynamicForm } from "./validation";

export type PublicSubmissionInput = {
  slug: string;
  values: Record<string, unknown>;
  requestId?: string;
  ip?: string;
  rateLimitKey?: string;
  userAgent?: string;
  referer?: string;
  sourceUrl?: string;
  consentAccepted?: boolean;
  utm?: Partial<Record<"source" | "medium" | "campaign" | "term" | "content", string>>;
};

const field = (data: Record<string, unknown>, name: string) => sanitizeText(data[name] == null ? "" : String(data[name]), 500);

export async function submitPublicForm(input: PublicSubmissionInput) {
  const form = await db.form.findFirst({
    where: { slug: input.slug, isActive: true, archivedAt: null },
    include: { fields: { orderBy: { position: "asc" } } },
  });
  if (!form) throw new NotFoundError("Aquest formulari no està disponible");

  const allowedFields = new Set([...form.fields.map(({ name }) => name), "website_url", "_company_website"]);
  const submittedValues = Object.fromEntries(
    Object.entries(input.values).filter(([name]) => allowedFields.has(name)),
  );
  const validation = validateDynamicForm(form.fields, submittedValues);
  if (!validation.success) throw new AppError("Revisa els camps del formulari", "VALIDATION_ERROR", 422);
  if (form.consentText && !input.consentAccepted) throw new AppError("Cal acceptar el consentiment", "CONSENT_REQUIRED", 422);

  const ipHash = input.ip ? hashIdentifier(input.ip) : null;
  const rateLimitHash = ipHash ?? hashIdentifier(`fallback:${input.rateLimitKey ?? "unknown"}`);
  await enforceRateLimit(form.organizationId, rateLimitHash);
  const honeypotTriggered = Boolean(field(submittedValues, "website_url") || field(submittedValues, "_company_website"));
  const requestId = input.requestId ?? randomUUID();

  return retryFormTransaction(() =>
    db.$transaction(async (tx) => {
    const existingSubmission = await tx.formSubmission.findUnique({
      where: { organizationId_requestId: { organizationId: form.organizationId, requestId } },
    });
    if (existingSubmission) {
      if (existingSubmission.formId !== form.id) {
        throw new AppError("L'identificador de la peticio ja s'ha utilitzat", "REQUEST_ID_CONFLICT", 409);
      }
      return {
        success: true,
        submissionId: existingSubmission.id,
        companyId: existingSubmission.companyId,
        contactId: existingSubmission.contactId,
        opportunityId: existingSubmission.opportunityId,
        taskId: existingSubmission.followUpTaskId,
        spam: existingSubmission.isSpam,
        message: form.successMessage,
        redirectUrl: form.redirectUrl,
      };
    }

    const submission = await tx.formSubmission.create({
      data: {
        organizationId: form.organizationId,
        formId: form.id,
        requestId,
        rawData: submittedValues as Prisma.InputJsonObject,
        processedData: validation.data as Prisma.InputJsonObject,
        utmSource: input.utm?.source,
        utmMedium: input.utm?.medium,
        utmCampaign: input.utm?.campaign,
        utmTerm: input.utm?.term,
        utmContent: input.utm?.content,
        sourceUrl: input.sourceUrl,
        referer: input.referer,
        ipHash,
        userAgent: input.userAgent?.slice(0, 500),
        consentAccepted: Boolean(input.consentAccepted),
        honeypotTriggered,
        isSpam: honeypotTriggered,
      },
    });

    if (honeypotTriggered) return { success: true, submissionId: submission.id, spam: true, message: form.successMessage };

    const firstName = field(validation.data, "firstName") || field(validation.data, "name") || "Contacte";
    const lastName = field(validation.data, "lastName") || null;
    const email = normalizeEmail(field(validation.data, "email"));
    const phone = normalizePhone(field(validation.data, "phone"));
    const companyName = field(validation.data, "companyName") || field(validation.data, "company") || null;

    const company = companyName ? await findOrCreateCompany(tx, form.organizationId, companyName, email, phone, form.ownerId) : null;
    const contactResult = await findOrCreateContact(tx, {
      organizationId: form.organizationId,
      firstName,
      lastName,
      email,
      phone,
      companyId: company?.id,
      ownerId: form.ownerId,
      source: `Formulari: ${form.name}`,
    });

    const opportunity = await tx.opportunity.create({
      data: {
        organizationId: form.organizationId,
        title: `${company?.name ?? [firstName, lastName].filter(Boolean).join(" ")} · ${form.name}`,
        companyId: company?.id,
        contactId: contactResult.contact.id,
        pipelineId: form.pipelineId,
        stageId: form.initialStageId,
        ownerId: form.ownerId,
        source: `Formulari: ${form.name}`,
        probability: 10,
      },
    });
    await tx.lead.create({
      data: {
        organizationId: form.organizationId,
        companyId: company?.id,
        contactId: contactResult.contact.id,
        opportunityId: opportunity.id,
        ownerId: form.ownerId,
        source: `Formulari: ${form.name}`,
      },
    });

    const task = form.createFollowUpTask
      ? await tx.task.create({
          data: {
            organizationId: form.organizationId,
            title: `Fer seguiment de ${firstName}`,
            description: `Lead rebut mitjançant el formulari “${form.name}”.`,
            dueAt: new Date(Date.now() + form.followUpTaskDelayHours * 60 * 60 * 1000),
            assignedToId: form.ownerId,
            createdById: form.ownerId,
            companyId: company?.id,
            contactId: contactResult.contact.id,
            opportunityId: opportunity.id,
          },
        })
      : null;

    await tx.formSubmission.update({
      where: { id: submission.id },
      data: {
        companyId: company?.id,
        contactId: contactResult.contact.id,
        opportunityId: opportunity.id,
        followUpTaskId: task?.id,
        processedAt: new Date(),
      },
    });

    await tx.activity.createMany({
      data: [
        {
          organizationId: form.organizationId,
          type: "FORM_SUBMITTED",
          summary: `Formulari “${form.name}” enviat`,
          formId: form.id,
          formSubmissionId: submission.id,
          companyId: company?.id,
          contactId: contactResult.contact.id,
          opportunityId: opportunity.id,
        },
        {
          organizationId: form.organizationId,
          type: contactResult.created ? "CONTACT_CREATED" : "CONTACT_UPDATED",
          summary: contactResult.created ? "Contacte creat des d’un formulari" : "Contacte existent actualitzat",
          contactId: contactResult.contact.id,
          companyId: company?.id,
        },
        {
          organizationId: form.organizationId,
          type: "OPPORTUNITY_CREATED",
          summary: "Oportunitat creada des d’un formulari",
          opportunityId: opportunity.id,
          contactId: contactResult.contact.id,
          companyId: company?.id,
        },
        ...(task
          ? [
              {
                organizationId: form.organizationId,
                type: "TASK_CREATED" as const,
                summary: "Tasca de seguiment creada automàticament",
                taskId: task.id,
                opportunityId: opportunity.id,
                contactId: contactResult.contact.id,
                companyId: company?.id,
              },
            ]
          : []),
      ],
    });

    await Promise.all([
      createOutboxEvent(tx, {
        organizationId: form.organizationId,
        eventType: "form.submitted",
        webhookDispatchEnabled: form.webhookEnabled,
        aggregateType: "FormSubmission",
        aggregateId: submission.id,
        idempotencyKey: `form.submitted:${submission.id}`,
        payload: { submissionId: submission.id, formId: form.id, contactId: contactResult.contact.id, companyId: company?.id ?? null, opportunityId: opportunity.id },
      }),
      createOutboxEvent(tx, {
        organizationId: form.organizationId,
        eventType: "opportunity.created",
        webhookDispatchEnabled: form.webhookEnabled,
        aggregateType: "Opportunity",
        aggregateId: opportunity.id,
        idempotencyKey: `opportunity.created:${opportunity.id}`,
        payload: { opportunityId: opportunity.id, stageId: form.initialStageId, source: opportunity.source, submissionId: submission.id },
      }),
      createOutboxEvent(tx, {
        organizationId: form.organizationId,
        eventType: contactResult.created ? "contact.created" : "contact.updated",
        webhookDispatchEnabled: form.webhookEnabled,
        aggregateType: "Contact",
        aggregateId: contactResult.contact.id,
        idempotencyKey: `${contactResult.created ? "contact.created" : "contact.updated"}:${submission.id}`,
        payload: { contactId: contactResult.contact.id, submissionId: submission.id },
      }),
    ]);

    return {
      success: true,
      submissionId: submission.id,
      companyId: company?.id ?? null,
      contactId: contactResult.contact.id,
      opportunityId: opportunity.id,
      taskId: task?.id ?? null,
      spam: false,
      message: form.successMessage,
      redirectUrl: form.redirectUrl,
    };
    }, { maxWait: 15_000, timeout: 20_000 }),
  );
}

export async function retryFormTransaction<T>(operation: () => Promise<T>, maxAttempts = 4): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034");
      if (!retryable || attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5 * 2 ** (attempt - 1)));
    }
  }
  throw new Error("No s'ha pogut completar la transaccio del formulari");
}

async function enforceRateLimit(organizationId: string, keyHash: string) {
  const windowSeconds = 60 * 60;
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCMinutes(0, 0, 0);
  const counter = await db.rateLimitCounter.upsert({
    where: { organizationId_namespace_keyHash_windowStart: { organizationId, namespace: "public-form", keyHash, windowStart } },
    create: { organizationId, namespace: "public-form", keyHash, windowStart, windowSeconds, expiresAt: new Date(windowStart.getTime() + windowSeconds * 1000) },
    update: { count: { increment: 1 } },
  });
  if (counter.count > 8) throw new AppError("Massa intents. Torna-ho a provar més tard.", "RATE_LIMITED", 429);
}

async function findOrCreateCompany(
  tx: Prisma.TransactionClient,
  organizationId: string,
  name: string,
  email: string | null,
  phone: string | null,
  ownerId: string | null,
) {
  const emailMatch = email
    ? await tx.company.findFirst({ where: { organizationId, emailNormalized: email, deletedAt: null } })
    : null;
  const phoneMatch = !emailMatch && phone
    ? await tx.company.findFirst({ where: { organizationId, phoneNormalized: phone, deletedAt: null } })
    : null;
  const existing =
    emailMatch ??
    phoneMatch ??
    (await tx.company.findFirst({ where: { organizationId, name: { equals: name, mode: "insensitive" }, deletedAt: null } }));
  if (existing) return existing;
  return tx.company.create({
    data: { organizationId, name, email, emailNormalized: email, phone, phoneNormalized: phone, source: "Formulari públic", ownerId },
  });
}

async function findOrCreateContact(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    companyId?: string;
    ownerId: string | null;
    source: string;
  },
) {
  const emailMatch = input.email
    ? await tx.contact.findFirst({ where: { organizationId: input.organizationId, deletedAt: null, emailNormalized: input.email } })
    : null;
  const contact =
    emailMatch ??
    (input.phone
      ? await tx.contact.findFirst({ where: { organizationId: input.organizationId, deletedAt: null, phoneNormalized: input.phone } })
      : null);
  if (!contact) {
    return {
      created: true,
      contact: await tx.contact.create({
        data: {
          organizationId: input.organizationId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          emailNormalized: input.email,
          phone: input.phone,
          phoneNormalized: input.phone,
          companyId: input.companyId,
          ownerId: input.ownerId,
          source: input.source,
        },
      }),
    };
  }
  const emailConflict = input.email
    ? await tx.contact.findFirst({ where: { organizationId: input.organizationId, deletedAt: null, emailNormalized: input.email, id: { not: contact.id } }, select: { id: true } })
    : null;
  const phoneConflict = input.phone
    ? await tx.contact.findFirst({ where: { organizationId: input.organizationId, deletedAt: null, phoneNormalized: input.phone, id: { not: contact.id } }, select: { id: true } })
    : null;
  const emailCanBeFilled = !contact.emailNormalized && input.email && !emailConflict;
  const phoneCanBeFilled = !contact.phoneNormalized && input.phone && !phoneConflict;
  return {
    created: false,
    contact: await tx.contact.update({
      where: { id: contact.id },
      data: {
        firstName: contact.firstName || input.firstName,
        lastName: contact.lastName || input.lastName,
        companyId: contact.companyId || input.companyId,
        email: emailCanBeFilled ? input.email : undefined,
        emailNormalized: emailCanBeFilled ? input.email : undefined,
        phone: phoneCanBeFilled ? input.phone : undefined,
        phoneNormalized: phoneCanBeFilled ? input.phone : undefined,
      },
    }),
  };
}
