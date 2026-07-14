"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signOut } from "@/auth";
import { encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { stripeTestConfigurationIsComplete } from "@/lib/env";
import { normalizeEmail, normalizePhone, sanitizeText, slugify } from "@/lib/normalization";
import { requireAdmin, requireTenant, type TenantContext } from "@/lib/tenant";

const optionalText = (maximum = 500) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.email("Introdueix un correu electrònic vàlid").max(320).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.url("Introdueix una URL vàlida")
    .max(2_000)
    .refine(
      (value) => ["http:", "https:"].includes(new URL(value).protocol),
      "La URL ha de començar per http:// o https://",
    )
    .optional(),
);

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa les dades del formulari.";
}

function fail(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`);
}

function parseOrFail<T>(schema: z.ZodType<T>, value: unknown, path: string): T {
  const result = schema.safeParse(value);
  if (!result.success) fail(path, firstIssue(result.error));
  return result.data;
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function parseDateTime(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  action: string,
  entityType: string,
  entityId: string,
  after?: Prisma.InputJsonValue,
) {
  await tx.auditLog.create({
    data: {
      organizationId: context.organizationId,
      userId: context.userId,
      action,
      entityType,
      entityId,
      after,
    },
  });
}

async function writeOutbox(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: Prisma.InputJsonValue,
) {
  await tx.outboxEvent.create({
    data: {
      organizationId: context.organizationId,
      eventType,
      aggregateType,
      aggregateId,
      payload,
      idempotencyKey: `${eventType}:${aggregateId}:${randomUUID()}`,
    },
  });
}

const companySchema = z.object({
  name: z.string().trim().min(2, "El nom és obligatori").max(180),
  legalName: optionalText(180),
  taxId: optionalText(30),
  email: optionalEmail,
  phone: optionalText(40),
  website: optionalUrl,
  address: optionalText(240),
  city: optionalText(100),
  postalCode: optionalText(20),
  country: z.string().trim().min(2).max(2).default("ES"),
  sector: optionalText(100),
  source: optionalText(100),
  notesText: optionalText(5_000),
});

export async function createCompanyAction(formData: FormData) {
  const context = await requireTenant();
  const input = parseOrFail(companySchema, Object.fromEntries(formData), "/companies/new");
  let companyId = "";

  try {
    const company = await db.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          organizationId: context.organizationId,
          ownerId: context.userId,
          ...input,
          country: input.country.toUpperCase(),
          email: input.email ? normalizeEmail(input.email) : null,
          emailNormalized: normalizeEmail(input.email),
          phoneNormalized: normalizePhone(input.phone),
          notesText: input.notesText ? sanitizeText(input.notesText, 5_000) : null,
        },
      });
      await writeAudit(tx, context, "COMPANY_CREATED", "Company", created.id, {
        name: created.name,
      });
      return created;
    });
    companyId = company.id;
  } catch (error) {
    if (isUniqueError(error)) fail("/companies/new", "Ja existeix una empresa amb aquest NIF, correu o telèfon.");
    throw error;
  }

  revalidatePath("/companies");
  redirect(`/companies/${companyId}?created=1`);
}

const contactSchema = z.object({
  firstName: z.string().trim().min(1, "El nom és obligatori").max(100),
  lastName: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  position: optionalText(120),
  companyId: optionalText(100),
  source: optionalText(100),
  preferredLanguage: z.string().trim().min(2).max(10).default("ca"),
  notesText: optionalText(5_000),
});

export async function createContactAction(formData: FormData) {
  const context = await requireTenant();
  const input = parseOrFail(contactSchema, Object.fromEntries(formData), "/contacts/new");
  if (input.companyId) {
    const company = await db.company.findFirst({
      where: { id: input.companyId, organizationId: context.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!company) fail("/contacts/new", "L’empresa seleccionada no és vàlida.");
  }

  let contactId = "";
  try {
    const contact = await db.$transaction(async (tx) => {
      const created = await tx.contact.create({
        data: {
          organizationId: context.organizationId,
          ownerId: context.userId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email ? normalizeEmail(input.email) : null,
          emailNormalized: normalizeEmail(input.email),
          phone: input.phone,
          phoneNormalized: normalizePhone(input.phone),
          position: input.position,
          companyId: input.companyId,
          source: input.source,
          preferredLanguage: input.preferredLanguage.toLowerCase(),
          notesText: input.notesText ? sanitizeText(input.notesText, 5_000) : null,
        },
      });
      await tx.activity.create({
        data: {
          organizationId: context.organizationId,
          type: "CONTACT_CREATED",
          summary: `Contacte creat: ${created.firstName}${created.lastName ? ` ${created.lastName}` : ""}`,
          actorId: context.userId,
          contactId: created.id,
          companyId: created.companyId,
        },
      });
      await writeOutbox(tx, context, "contact.created", "Contact", created.id, {
        contactId: created.id,
        companyId: created.companyId,
        email: created.email,
      });
      return created;
    });
    contactId = contact.id;
  } catch (error) {
    if (isUniqueError(error)) fail("/contacts/new", "Ja existeix un contacte amb aquest correu o telèfon.");
    throw error;
  }

  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  redirect(`/contacts/${contactId}?created=1`);
}

const noteSchema = z.object({
  entityType: z.enum(["COMPANY", "CONTACT", "OPPORTUNITY"]),
  entityId: z.string().min(1),
  content: z.string().trim().min(2, "Escriu una nota").max(5_000),
});

export async function addNoteAction(formData: FormData) {
  const context = await requireTenant();
  const input = parseOrFail(noteSchema, Object.fromEntries(formData), "/activity");
  const target =
    input.entityType === "COMPANY"
      ? await db.company.findFirst({ where: { id: input.entityId, organizationId: context.organizationId, deletedAt: null } })
      : input.entityType === "CONTACT"
        ? await db.contact.findFirst({ where: { id: input.entityId, organizationId: context.organizationId, deletedAt: null } })
        : await db.opportunity.findFirst({ where: { id: input.entityId, organizationId: context.organizationId, deletedAt: null } });
  if (!target) fail("/activity", "No s’ha trobat el registre.");

  const links = {
    companyId: input.entityType === "COMPANY" ? input.entityId : undefined,
    contactId: input.entityType === "CONTACT" ? input.entityId : undefined,
    opportunityId: input.entityType === "OPPORTUNITY" ? input.entityId : undefined,
  };
  await db.$transaction(async (tx) => {
    const note = await tx.note.create({
      data: {
        organizationId: context.organizationId,
        authorId: context.userId,
        content: sanitizeText(input.content, 5_000),
        ...links,
      },
    });
    await tx.activity.create({
      data: {
        organizationId: context.organizationId,
        type: "NOTE_ADDED",
        summary: "Nota interna afegida",
        actorId: context.userId,
        details: { noteId: note.id },
        ...links,
      },
    });
  });

  revalidatePath("/activity");
  if (input.entityType === "COMPANY") revalidatePath(`/companies/${input.entityId}`);
  if (input.entityType === "CONTACT") revalidatePath(`/contacts/${input.entityId}`);
  if (input.entityType === "OPPORTUNITY") revalidatePath("/pipeline");
}

const opportunitySchema = z.object({
  title: z.string().trim().min(2, "El títol és obligatori").max(180),
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  companyId: optionalText(100),
  contactId: optionalText(100),
  value: z.coerce.number().min(0).max(20_000_000),
  currency: z.string().trim().length(3).default("EUR"),
  probability: z.coerce.number().int().min(0).max(100),
  expectedCloseDate: optionalText(40),
  source: optionalText(100),
});

export async function createOpportunityAction(formData: FormData) {
  const context = await requireTenant();
  const input = parseOrFail(opportunitySchema, Object.fromEntries(formData), "/pipeline/new");
  const [pipeline, stage, company, contact] = await Promise.all([
    db.pipeline.findFirst({ where: { id: input.pipelineId, organizationId: context.organizationId, isActive: true } }),
    db.pipelineStage.findFirst({
      where: {
        id: input.stageId,
        pipelineId: input.pipelineId,
        organizationId: context.organizationId,
        type: "OPEN",
      },
    }),
    input.companyId
      ? db.company.findFirst({ where: { id: input.companyId, organizationId: context.organizationId, deletedAt: null } })
      : null,
    input.contactId
      ? db.contact.findFirst({ where: { id: input.contactId, organizationId: context.organizationId, deletedAt: null } })
      : null,
  ]);
  if (!pipeline || !stage) fail("/pipeline/new", "El pipeline o l’etapa no són vàlids.");
  if (input.companyId && !company) fail("/pipeline/new", "L’empresa seleccionada no és vàlida.");
  if (input.contactId && !contact) fail("/pipeline/new", "El contacte seleccionat no és vàlid.");
  const closeDate = parseDateTime(input.expectedCloseDate);
  if (input.expectedCloseDate && !closeDate) fail("/pipeline/new", "La data prevista no és vàlida.");

  await db.$transaction(async (tx) => {
    const opportunity = await tx.opportunity.create({
      data: {
        organizationId: context.organizationId,
        title: input.title,
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        companyId: input.companyId,
        contactId: input.contactId,
        ownerId: context.userId,
        valueCents: Math.round(input.value * 100),
        currency: input.currency.toUpperCase(),
        probability: input.probability,
        expectedCloseDate: closeDate,
        source: input.source,
      },
    });
    await tx.opportunityStageHistory.create({
      data: {
        organizationId: context.organizationId,
        opportunityId: opportunity.id,
        toStageId: input.stageId,
        changedById: context.userId,
        reason: "Creació de l’oportunitat",
      },
    });
    await tx.activity.create({
      data: {
        organizationId: context.organizationId,
        type: "OPPORTUNITY_CREATED",
        summary: `Oportunitat creada: ${opportunity.title}`,
        actorId: context.userId,
        opportunityId: opportunity.id,
        companyId: opportunity.companyId,
        contactId: opportunity.contactId,
      },
    });
    await writeOutbox(tx, context, "opportunity.created", "Opportunity", opportunity.id, {
      opportunityId: opportunity.id,
      stageId: opportunity.stageId,
      valueCents: opportunity.valueCents,
    });
  });

  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  redirect("/pipeline?created=1");
}

const formFieldTypes = ["TEXT", "EMAIL", "PHONE", "TEXTAREA", "NUMBER", "SELECT", "CHECKBOX", "HIDDEN"] as const;
const formFieldSchema = z.object({
  label: z.string().trim().min(1).max(120),
  name: z.string().trim().regex(/^[a-z][a-zA-Z0-9_]*$/, "El nom intern no és vàlid").max(80),
  type: z.enum(formFieldTypes),
  required: z.boolean(),
  placeholder: optionalText(180),
  options: z.array(z.string().min(1).max(120)).max(30),
  defaultValue: optionalText(500),
  position: z.number().int().min(0),
});

function parseFormFields(formData: FormData, failurePath: string) {
  const fields = Array.from({ length: 10 }, (_, index) => {
    const label = formData.get(`field_${index}_label`);
    const name = formData.get(`field_${index}_name`);
    if (typeof label !== "string" || !label.trim() || typeof name !== "string" || !name.trim()) return null;
    const rawOptions = formData.get(`field_${index}_options`);
    return parseOrFail(
      formFieldSchema,
      {
        label,
        name,
        type: formData.get(`field_${index}_type`),
        required: formData.get(`field_${index}_required`) === "true",
        placeholder: formData.get(`field_${index}_placeholder`),
        options:
          typeof rawOptions === "string"
            ? rawOptions.split(",").map((option) => option.trim()).filter(Boolean)
            : [],
        defaultValue: formData.get(`field_${index}_defaultValue`),
        position: index,
      },
      failurePath,
    );
  }).filter((field): field is z.infer<typeof formFieldSchema> => Boolean(field));
  if (!fields.length) fail(failurePath, "Afegeix almenys un camp al formulari.");
  if (new Set(fields.map((field) => field.name)).size !== fields.length) {
    fail(failurePath, "Els noms interns dels camps no es poden repetir.");
  }
  return fields;
}

const formSchema = z.object({
  name: z.string().trim().min(2, "El nom és obligatori").max(160),
  slug: z.string().trim().min(2).max(80),
  description: optionalText(1_000),
  pipelineId: z.string().min(1),
  initialStageId: z.string().min(1),
  successMessage: z.string().trim().min(2).max(500),
  redirectUrl: optionalUrl,
  consentText: optionalText(2_000),
  createFollowUpTask: z.boolean(),
  followUpTaskDelayHours: z.coerce.number().int().min(1).max(8_760),
  webhookEnabled: z.boolean(),
  isActive: z.boolean(),
});

function parseFormDefinition(formData: FormData, path: string) {
  const input = parseOrFail(
    formSchema,
    {
      ...Object.fromEntries(formData),
      slug: slugify(String(formData.get("slug") || formData.get("name") || "")),
      createFollowUpTask: formData.get("createFollowUpTask") === "on",
      webhookEnabled: formData.get("webhookEnabled") === "on",
      isActive: formData.get("isActive") === "on",
    },
    path,
  );
  return { input, fields: parseFormFields(formData, path) };
}

async function assertFormPipeline(context: TenantContext, pipelineId: string, stageId: string, path: string) {
  const stage = await db.pipelineStage.findFirst({
    where: {
      id: stageId,
      pipelineId,
      organizationId: context.organizationId,
      type: "OPEN",
      pipeline: { isActive: true },
    },
    select: { id: true },
  });
  if (!stage) fail(path, "El pipeline o l’etapa inicial no són vàlids.");
}

export async function createFormAction(formData: FormData) {
  const context = await requireTenant();
  const path = "/forms/new";
  const { input, fields } = parseFormDefinition(formData, path);
  await assertFormPipeline(context, input.pipelineId, input.initialStageId, path);
  let formId = "";

  try {
    const form = await db.$transaction(async (tx) => {
      const created = await tx.form.create({
        data: {
          organizationId: context.organizationId,
          ownerId: context.userId,
          ...input,
          fields: {
            create: fields.map((field) => ({
              organizationId: context.organizationId,
              ...field,
              options: field.options,
            })),
          },
        },
      });
      await writeAudit(tx, context, "FORM_CREATED", "Form", created.id, {
        name: created.name,
        slug: created.slug,
      });
      return created;
    });
    formId = form.id;
  } catch (error) {
    if (isUniqueError(error)) fail(path, "Aquest identificador o nom intern de camp ja existeix.");
    throw error;
  }

  revalidatePath("/forms");
  redirect(`/forms/${formId}?created=1`);
}

export async function updateFormAction(formData: FormData) {
  const context = await requireTenant();
  const formId = String(formData.get("formId") || "");
  const path = `/forms/${formId}`;
  const existing = await db.form.findFirst({
    where: { id: formId, organizationId: context.organizationId, archivedAt: null },
    select: { id: true },
  });
  if (!existing) fail("/forms", "No s’ha trobat el formulari.");
  const { input, fields } = parseFormDefinition(formData, path);
  await assertFormPipeline(context, input.pipelineId, input.initialStageId, path);

  try {
    await db.$transaction(async (tx) => {
      await tx.form.update({ where: { id: formId }, data: input });
      await tx.formField.deleteMany({ where: { formId, organizationId: context.organizationId } });
      await tx.formField.createMany({
        data: fields.map((field) => ({
          organizationId: context.organizationId,
          formId,
          ...field,
          options: field.options,
        })),
      });
      await writeAudit(tx, context, "FORM_UPDATED", "Form", formId, { name: input.name, slug: input.slug });
    });
  } catch (error) {
    if (isUniqueError(error)) fail(path, "Aquest identificador o nom intern de camp ja existeix.");
    throw error;
  }
  revalidatePath("/forms");
  revalidatePath(path);
  revalidatePath(`/f/${input.slug}`);
  redirect(`${path}?updated=1`);
}

export async function toggleFormAction(formData: FormData) {
  const context = await requireTenant();
  const formId = String(formData.get("formId") || "");
  const form = await db.form.findFirst({
    where: { id: formId, organizationId: context.organizationId, archivedAt: null },
    select: { id: true, isActive: true },
  });
  if (!form) return;
  await db.form.update({ where: { id: form.id }, data: { isActive: !form.isActive } });
  revalidatePath("/forms");
  revalidatePath(`/forms/${form.id}`);
}

const taskSchema = z.object({
  title: z.string().trim().min(2, "El títol és obligatori").max(180),
  description: optionalText(3_000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  dueAt: optionalText(80),
  assignedToId: optionalText(100),
  contactId: optionalText(100),
  companyId: optionalText(100),
  opportunityId: optionalText(100),
});

export async function createTaskAction(formData: FormData) {
  const context = await requireTenant();
  const path = "/tasks/new";
  const input = parseOrFail(taskSchema, Object.fromEntries(formData), path);
  const dueAt = parseDateTime(input.dueAt);
  if (input.dueAt && !dueAt) fail(path, "La data de venciment no és vàlida.");
  const [assignee, contact, company, opportunity] = await Promise.all([
    input.assignedToId
      ? db.membership.findFirst({
          where: { organizationId: context.organizationId, userId: input.assignedToId, isActive: true },
        })
      : null,
    input.contactId
      ? db.contact.findFirst({ where: { id: input.contactId, organizationId: context.organizationId, deletedAt: null } })
      : null,
    input.companyId
      ? db.company.findFirst({ where: { id: input.companyId, organizationId: context.organizationId, deletedAt: null } })
      : null,
    input.opportunityId
      ? db.opportunity.findFirst({ where: { id: input.opportunityId, organizationId: context.organizationId, deletedAt: null } })
      : null,
  ]);
  if (input.assignedToId && !assignee) fail(path, "La persona assignada no és vàlida.");
  if (input.contactId && !contact) fail(path, "El contacte no és vàlid.");
  if (input.companyId && !company) fail(path, "L’empresa no és vàlida.");
  if (input.opportunityId && !opportunity) fail(path, "L’oportunitat no és vàlida.");

  await db.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        organizationId: context.organizationId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueAt,
        assignedToId: input.assignedToId ?? context.userId,
        createdById: context.userId,
        contactId: input.contactId,
        companyId: input.companyId,
        opportunityId: input.opportunityId,
      },
    });
    await tx.activity.create({
      data: {
        organizationId: context.organizationId,
        type: "TASK_CREATED",
        summary: `Tasca creada: ${task.title}`,
        actorId: context.userId,
        taskId: task.id,
        contactId: task.contactId,
        companyId: task.companyId,
        opportunityId: task.opportunityId,
      },
    });
    await writeOutbox(tx, context, "task.created", "Task", task.id, {
      taskId: task.id,
      title: task.title,
      dueAt: task.dueAt?.toISOString() ?? null,
    });
    if (dueAt) {
      await tx.scheduledJob.create({
        data: {
          organizationId: context.organizationId,
          type: "TASK_DUE",
          runAt: dueAt,
          taskId: task.id,
          payload: { taskId: task.id },
          deduplicationKey: `task-due:${task.id}`,
        },
      });
    }
  });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  redirect("/tasks?created=1");
}

async function setTaskCompletion(formData: FormData, completed: boolean) {
  const context = await requireTenant();
  const taskId = String(formData.get("taskId") || "");
  const task = await db.task.findFirst({
    where: { id: taskId, organizationId: context.organizationId, deletedAt: null },
  });
  if (!task) return;
  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: { status: completed ? "COMPLETED" : "PENDING", completedAt: completed ? new Date() : null },
    });
    if (completed) {
      await tx.scheduledJob.updateMany({
        where: { organizationId: context.organizationId, taskId: task.id, status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: "CANCELLED", cancelledAt: new Date(), lockedAt: null, lockedBy: null },
      });
      await tx.activity.create({
        data: {
          organizationId: context.organizationId,
          type: "TASK_COMPLETED",
          summary: `Tasca completada: ${task.title}`,
          actorId: context.userId,
          taskId: task.id,
          companyId: task.companyId,
          contactId: task.contactId,
          opportunityId: task.opportunityId,
        },
      });
    } else if (task.dueAt) {
      const existing = await tx.scheduledJob.findFirst({
        where: { organizationId: context.organizationId, taskId: task.id, deduplicationKey: `task-due:${task.id}` },
      });
      if (existing) {
        await tx.scheduledJob.update({
          where: { id: existing.id },
          data: {
            status: "PENDING",
            runAt: task.dueAt,
            cancelledAt: null,
            completedAt: null,
            lockedAt: null,
            lockedBy: null,
            attempts: 0,
            lastError: null,
          },
        });
      }
    }
  });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function completeTaskAction(formData: FormData) {
  await setTaskCompletion(formData, true);
}

export async function reopenTaskAction(formData: FormData) {
  await setTaskCompletion(formData, false);
}

const productSchema = z.object({
  name: z.string().trim().min(2, "El nom és obligatori").max(180),
  description: optionalText(2_000),
  sku: z.string().trim().min(2).max(80),
  unitPrice: z.coerce.number().min(0).max(20_000_000),
  currency: z.string().trim().length(3),
  taxRate: z.coerce.number().min(0).max(100),
  billingType: z.enum(["ONE_TIME", "RECURRING"]),
  isActive: z.boolean(),
});

export async function createProductAction(formData: FormData) {
  const context = await requireTenant();
  const path = "/products/new";
  const input = parseOrFail(
    productSchema,
    { ...Object.fromEntries(formData), isActive: formData.get("isActive") === "on" },
    path,
  );
  try {
    await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          organizationId: context.organizationId,
          name: input.name,
          description: input.description,
          sku: input.sku.toUpperCase(),
          unitPriceCents: Math.round(input.unitPrice * 100),
          currency: input.currency.toUpperCase(),
          taxRateBps: Math.round(input.taxRate * 100),
          billingType: input.billingType,
          isActive: input.isActive,
        },
      });
      await writeAudit(tx, context, "PRODUCT_CREATED", "Product", product.id, {
        name: product.name,
        sku: product.sku,
      });
    });
  } catch (error) {
    if (isUniqueError(error)) fail(path, "Ja existeix un producte amb aquest SKU.");
    throw error;
  }
  revalidatePath("/products");
  redirect("/products?created=1");
}

const settingsSchema = z.object({
  tradeName: z.string().trim().min(2).max(180),
  legalName: optionalText(180),
  taxId: optionalText(30),
  email: optionalEmail,
  phone: optionalText(40),
  website: optionalUrl,
  address: optionalText(240),
  city: optionalText(100),
  postalCode: optionalText(20),
  country: z.string().trim().length(2),
  currency: z.string().trim().length(3),
  defaultTaxRate: z.coerce.number().min(0).max(100),
  paymentTermsDays: z.coerce.number().int().min(0).max(365),
  timezone: z.string().trim().min(2).max(80),
  quotePrefix: z.string().trim().min(1).max(10),
  quoteNumberLength: z.coerce.number().int().min(2).max(10),
  quoteValidityDays: z.coerce.number().int().min(1).max(365),
  quoteFollowUpDays: z.string(),
  invoicePrefix: z.string().trim().min(1).max(10),
  invoiceNumberLength: z.coerce.number().int().min(2).max(10),
  invoiceDueDays: z.coerce.number().int().min(0).max(365),
  invoiceReminderOffsetsDays: z.string(),
  stripeEnabled: z.boolean(),
  stripeTestMode: z.boolean(),
  onboardingTaskOnPayment: z.boolean(),
});

function commaSeparatedIntegers(value: string, minimum: number, maximum: number): number[] | null {
  const values = value.split(",").map((part) => Number(part.trim()));
  if (!values.length || values.some((entry) => !Number.isInteger(entry) || entry < minimum || entry > maximum)) return null;
  return [...new Set(values)];
}

export async function updateOrganizationSettingsAction(formData: FormData) {
  const context = await requireAdmin();
  const path = "/settings";
  const input = parseOrFail(
    settingsSchema,
    {
      ...Object.fromEntries(formData),
      stripeEnabled: formData.get("stripeEnabled") === "on",
      stripeTestMode: formData.get("stripeTestMode") === "on",
      onboardingTaskOnPayment: formData.get("onboardingTaskOnPayment") === "on",
    },
    path,
  );
  const quoteFollowUpDays = commaSeparatedIntegers(input.quoteFollowUpDays, 0, 365);
  const invoiceReminderOffsetsDays = commaSeparatedIntegers(input.invoiceReminderOffsetsDays, -365, 365);
  if (!quoteFollowUpDays || !invoiceReminderOffsetsDays) {
    fail(path, "Els recordatoris han de ser dies enters separats per comes.");
  }
  if (input.stripeEnabled && !input.stripeTestMode) {
    fail(path, "Stripe només es pot activar en mode test en aquest MVP.");
  }
  if (
    input.stripeEnabled &&
    !stripeTestConfigurationIsComplete({
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    })
  ) {
    fail(path, "Configura les tres claus Stripe de test abans d’activar els pagaments.");
  }
  const data = {
    tradeName: input.tradeName,
    legalName: input.legalName,
    taxId: input.taxId,
    email: input.email,
    phone: input.phone,
    website: input.website,
    address: input.address,
    city: input.city,
    postalCode: input.postalCode,
    country: input.country.toUpperCase(),
    currency: input.currency.toUpperCase(),
    defaultTaxRateBps: Math.round(input.defaultTaxRate * 100),
    paymentTermsDays: input.paymentTermsDays,
    timezone: input.timezone,
    quotePrefix: input.quotePrefix.toUpperCase(),
    quoteNumberLength: input.quoteNumberLength,
    quoteValidityDays: input.quoteValidityDays,
    quoteFollowUpDays,
    invoicePrefix: input.invoicePrefix.toUpperCase(),
    invoiceNumberLength: input.invoiceNumberLength,
    invoiceDueDays: input.invoiceDueDays,
    invoiceReminderOffsetsDays,
    stripeEnabled: input.stripeEnabled,
    stripeTestMode: input.stripeTestMode,
    onboardingTaskOnPayment: input.onboardingTaskOnPayment,
  };
  await db.$transaction(async (tx) => {
    await tx.organization.updateMany({
      where: { id: context.organizationId, deletedAt: null },
      data: { name: input.tradeName },
    });
    await tx.organizationSettings.upsert({
      where: { organizationId: context.organizationId },
      create: { organizationId: context.organizationId, ...data },
      update: data,
    });
    await writeAudit(tx, context, "ORGANIZATION_SETTINGS_UPDATED", "Organization", context.organizationId);
  });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings?updated=1");
}

const webhookEvents = new Set([
  "form.submitted",
  "contact.created",
  "contact.updated",
  "opportunity.created",
  "opportunity.stage_changed",
  "quote.created",
  "quote.sent",
  "quote.viewed",
  "quote.accepted",
  "quote.rejected",
  "quote.expired",
  "quote.followup_due",
  "invoice.created",
  "invoice.sent",
  "invoice.paid",
  "invoice.overdue",
  "invoice.reminder_due",
  "task.created",
  "task.due",
]);

const webhookSchema = z.object({
  name: z.string().trim().min(2).max(120),
  url: z.url().max(2_000).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "La URL ha de ser HTTP o HTTPS"),
  secret: z.string().min(16, "El secret ha de tenir almenys 16 caràcters").max(500),
});

export async function createWebhookEndpointAction(formData: FormData) {
  const context = await requireAdmin();
  const path = "/settings?section=webhooks";
  const input = parseOrFail(webhookSchema, Object.fromEntries(formData), path);
  const eventTypes = formData
    .getAll("eventTypes")
    .filter((value): value is string => typeof value === "string" && webhookEvents.has(value));
  if (!eventTypes.length) fail(path, "Selecciona almenys un tipus d’esdeveniment.");
  const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!encryptionKey || Buffer.from(encryptionKey, "base64").length !== 32) {
    fail(path, "Configura INTEGRATION_ENCRYPTION_KEY amb 32 bytes en base64 abans de crear endpoints.");
  }

  try {
    await db.$transaction(async (tx) => {
      const endpoint = await tx.webhookEndpoint.create({
        data: {
          organizationId: context.organizationId,
          name: input.name,
          url: input.url,
          secretEncrypted: encryptSecret(input.secret, encryptionKey),
          secretHint: input.secret.slice(-4),
          eventTypes,
          createdById: context.userId,
        },
      });
      await tx.organizationSettings.updateMany({
        where: { organizationId: context.organizationId },
        data: { webhooksEnabled: true },
      });
      await writeAudit(tx, context, "WEBHOOK_ENDPOINT_CREATED", "WebhookEndpoint", endpoint.id, {
        name: endpoint.name,
        url: endpoint.url,
        eventTypes,
      });
    });
  } catch (error) {
    if (isUniqueError(error)) fail(path, "Ja existeix un endpoint amb aquest nom.");
    throw error;
  }
  revalidatePath("/settings");
  redirect("/settings?section=webhooks&created=1");
}

export async function toggleWebhookEndpointAction(formData: FormData) {
  const context = await requireAdmin();
  const endpointId = String(formData.get("endpointId") || "");
  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id: endpointId, organizationId: context.organizationId, archivedAt: null },
    select: { id: true, isActive: true },
  });
  if (!endpoint) return;
  await db.webhookEndpoint.update({ where: { id: endpoint.id }, data: { isActive: !endpoint.isActive } });
  revalidatePath("/settings");
}

export async function logoutAction() {
  const context = await requireTenant();
  await db.auditLog.create({
    data: {
      organizationId: context.organizationId,
      userId: context.userId,
      action: "AUTH_LOGOUT",
      entityType: "User",
      entityId: context.userId,
    },
  });
  await signOut({ redirectTo: "/login" });
}
