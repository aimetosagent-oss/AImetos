import { createHash } from "node:crypto";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

function dateAt(daysFromToday: number, utcHour = 9): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  date.setUTCHours(utcHour, 0, 0, 0);
  return date;
}

function longSeedToken(scope: string, organizationId: string): string {
  return createHash("sha256")
    .update(`aimetos-crm-demo:${organizationId}:${scope}`)
    .digest("hex");
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@aimetos.local").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "CanviaAquestaContrasenya123!";
  const adminName = (process.env.ADMIN_NAME || "Administrador AImetos").trim();
  const timezone = process.env.ORGANIZATION_TIMEZONE || "Europe/Madrid";
  const currency = (process.env.ORGANIZATION_CURRENCY || "EUR").trim().toUpperCase();
  const includeDemoData = process.env.SEED_DEMO_DATA !== "false";

  if (!adminEmail.includes("@")) {
    throw new Error("ADMIN_EMAIL ha de contenir una adreça de correu vàlida.");
  }
  if (adminPassword.length < 12) {
    throw new Error("ADMIN_PASSWORD ha de tenir com a mínim 12 caràcters.");
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("ORGANIZATION_CURRENCY ha de ser un codi ISO de tres lletres.");
  }

  const passwordHash = await hash(adminPassword, 12);
  const year = new Date().getUTCFullYear();

  const result = await prisma.$transaction(
    async (tx) => {
      const organization = await tx.organization.upsert({
        where: { slug: "aimetos" },
        update: { name: "AImetos", deletedAt: null },
        create: { name: "AImetos", slug: "aimetos" },
      });

      await tx.organizationSettings.upsert({
        where: { organizationId: organization.id },
        update: {
          tradeName: "AImetos",
          email: "hola@aimetos.com",
          website: "https://aimetos.com",
          country: "ES",
          currency,
          defaultTaxRateBps: 2100,
          paymentTermsDays: 30,
          timezone,
          quotePrefix: "P",
          quoteNumberLength: 4,
          quoteValidityDays: 30,
          quoteFollowUpDays: [3, 7, 14],
          invoicePrefix: "F",
          invoiceNumberLength: 4,
          invoiceDueDays: 30,
          invoiceReminderOffsetsDays: [-3, 0, 3, 7],
          stripeTestMode: true,
        },
        create: {
          organizationId: organization.id,
          tradeName: "AImetos",
          email: "hola@aimetos.com",
          website: "https://aimetos.com",
          country: "ES",
          currency,
          defaultTaxRateBps: 2100,
          paymentTermsDays: 30,
          timezone,
          quotePrefix: "P",
          quoteNumberLength: 4,
          quoteValidityDays: 30,
          quoteFollowUpDays: [3, 7, 14],
          invoicePrefix: "F",
          invoiceNumberLength: 4,
          invoiceDueDays: 30,
          invoiceReminderOffsetsDays: [-3, 0, 3, 7],
          stripeTestMode: true,
        },
      });

      const admin = await tx.user.upsert({
        where: { email: adminEmail },
        update: {
          name: adminName,
          isActive: true,
        },
        create: {
          email: adminEmail,
          name: adminName,
          passwordHash,
          isActive: true,
        },
      });

      await tx.membership.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: admin.id,
          },
        },
        update: { role: "ADMIN", isActive: true },
        create: {
          organizationId: organization.id,
          userId: admin.id,
          role: "ADMIN",
          isActive: true,
        },
      });

      const pipeline = await tx.pipeline.upsert({
        where: {
          organizationId_slug: {
            organizationId: organization.id,
            slug: "comercial",
          },
        },
        update: { name: "Pipeline comercial", isDefault: true, isActive: true },
        create: {
          organizationId: organization.id,
          name: "Pipeline comercial",
          slug: "comercial",
          isDefault: true,
          isActive: true,
        },
      });

      const stageDefinitions = [
        { name: "Lead nou", slug: "lead-nou", position: 0, type: "OPEN" as const, probability: 10, color: "#0e7490" },
        { name: "Contactat", slug: "contactat", position: 1, type: "OPEN" as const, probability: 20, color: "#0284c7" },
        { name: "Qualificat", slug: "qualificat", position: 2, type: "OPEN" as const, probability: 40, color: "#2563eb" },
        { name: "Reunió programada", slug: "reunio-programada", position: 3, type: "OPEN" as const, probability: 55, color: "#4f46e5" },
        { name: "Proposta enviada", slug: "proposta-enviada", position: 4, type: "OPEN" as const, probability: 70, color: "#7c3aed" },
        { name: "Negociació", slug: "negociacio", position: 5, type: "OPEN" as const, probability: 85, color: "#9333ea" },
        { name: "Guanyat", slug: "guanyat", position: 6, type: "WON" as const, probability: 100, color: "#0f766e" },
        { name: "Perdut", slug: "perdut", position: 7, type: "LOST" as const, probability: 0, color: "#64748b" },
      ];

      const stages = new Map<string, { id: string }>();
      for (const definition of stageDefinitions) {
        const stage = await tx.pipelineStage.upsert({
          where: {
            pipelineId_slug: {
              pipelineId: pipeline.id,
              slug: definition.slug,
            },
          },
          update: {
            organizationId: organization.id,
            name: definition.name,
            position: definition.position,
            type: definition.type,
            defaultProbability: definition.probability,
            color: definition.color,
          },
          create: {
            organizationId: organization.id,
            pipelineId: pipeline.id,
            name: definition.name,
            slug: definition.slug,
            position: definition.position,
            type: definition.type,
            defaultProbability: definition.probability,
            color: definition.color,
          },
          select: { id: true },
        });
        stages.set(definition.slug, stage);
      }

      const stageId = (slug: string): string => {
        const stage = stages.get(slug);
        if (!stage) throw new Error(`No s'ha creat l'etapa ${slug}.`);
        return stage.id;
      };

      const productDefinitions = [
        { sku: "BACKOFFICE-SMART", name: "Backoffice Smart", description: "Automatització del backoffice comercial i operatiu.", price: 250_000, billingType: "ONE_TIME" as const },
        { sku: "BACKOFFICE-CORE", name: "Backoffice Core", description: "Base operativa automatitzada per a processos essencials.", price: 145_000, billingType: "ONE_TIME" as const },
        { sku: "AGENT-TEXT", name: "Agent de text", description: "Agent conversacional de text per a atenció i qualificació.", price: 180_000, billingType: "ONE_TIME" as const },
        { sku: "AGENT-INBOUND", name: "Agent inbound", description: "Agent per atendre i derivar consultes entrants.", price: 480_000, billingType: "ONE_TIME" as const },
        { sku: "MAINT-BASIC", name: "Manteniment bàsic", description: "Manteniment preventiu i suport essencial.", price: 25_000, billingType: "RECURRING" as const },
        { sku: "MAINT-MEDIUM", name: "Manteniment mitjà", description: "Manteniment, monitoratge i millores periòdiques.", price: 49_000, billingType: "RECURRING" as const },
        { sku: "MAINT-PRO", name: "Manteniment professional", description: "Manteniment prioritari i evolució contínua.", price: 89_000, billingType: "RECURRING" as const },
      ];

      const products = new Map<string, { id: string; unitPriceCents: number }>();
      for (const definition of productDefinitions) {
        const product = await tx.product.upsert({
          where: {
            organizationId_sku: {
              organizationId: organization.id,
              sku: definition.sku,
            },
          },
          update: {
            name: definition.name,
            description: definition.description,
            unitPriceCents: definition.price,
            currency,
            taxRateBps: 2100,
            billingType: definition.billingType,
            isActive: true,
            deletedAt: null,
          },
          create: {
            organizationId: organization.id,
            sku: definition.sku,
            name: definition.name,
            description: definition.description,
            unitPriceCents: definition.price,
            currency,
            taxRateBps: 2100,
            billingType: definition.billingType,
            isActive: true,
          },
          select: { id: true, unitPriceCents: true },
        });
        products.set(definition.sku, product);
      }

      if (!includeDemoData) {
        return {
          demoData: false as const,
          organizationId: organization.id,
          adminEmail: admin.email,
          pipelineId: pipeline.id,
          formSlug: null,
          quoteNumber: null,
          invoiceNumber: null,
        };
      }

      const smartProduct = products.get("BACKOFFICE-SMART");
      if (!smartProduct) throw new Error("No s'ha pogut crear el producte Backoffice Smart.");

      const architectureCompany = await tx.company.upsert({
        where: {
          organizationId_emailNormalized: {
            organizationId: organization.id,
            emailNormalized: "hola@alba-arquitectura.demo",
          },
        },
        update: {
          name: "Alba Arquitectura Demo",
          legalName: "Alba Arquitectura Demo, SL",
          taxId: "B00000001",
          phone: "+34 930 000 101",
          phoneNormalized: "+34930000101",
          website: "https://alba-arquitectura.demo",
          city: "Barcelona",
          postalCode: "08001",
          country: "ES",
          sector: "Arquitectura",
          source: "Dades de demostració",
          ownerId: admin.id,
          deletedAt: null,
        },
        create: {
          organizationId: organization.id,
          name: "Alba Arquitectura Demo",
          legalName: "Alba Arquitectura Demo, SL",
          taxId: "B00000001",
          email: "hola@alba-arquitectura.demo",
          emailNormalized: "hola@alba-arquitectura.demo",
          phone: "+34 930 000 101",
          phoneNormalized: "+34930000101",
          website: "https://alba-arquitectura.demo",
          city: "Barcelona",
          postalCode: "08001",
          country: "ES",
          sector: "Arquitectura",
          source: "Dades de demostració",
          ownerId: admin.id,
        },
      });

      const restaurantCompany = await tx.company.upsert({
        where: {
          organizationId_emailNormalized: {
            organizationId: organization.id,
            emailNormalized: "hola@bistro-mediterrani.demo",
          },
        },
        update: {
          name: "Bistró Mediterrani Demo",
          phone: "+34 930 000 202",
          phoneNormalized: "+34930000202",
          city: "Girona",
          country: "ES",
          sector: "Restauració",
          source: "Formulari web",
          ownerId: admin.id,
          deletedAt: null,
        },
        create: {
          organizationId: organization.id,
          name: "Bistró Mediterrani Demo",
          email: "hola@bistro-mediterrani.demo",
          emailNormalized: "hola@bistro-mediterrani.demo",
          phone: "+34 930 000 202",
          phoneNormalized: "+34930000202",
          city: "Girona",
          country: "ES",
          sector: "Restauració",
          source: "Formulari web",
          ownerId: admin.id,
        },
      });

      const talentCompany = await tx.company.upsert({
        where: {
          organizationId_emailNormalized: {
            organizationId: organization.id,
            emailNormalized: "equip@talent-nord.demo",
          },
        },
        update: {
          name: "Talent Nord Demo",
          city: "Sabadell",
          country: "ES",
          sector: "Recursos humans",
          source: "Referència",
          ownerId: admin.id,
          deletedAt: null,
        },
        create: {
          organizationId: organization.id,
          name: "Talent Nord Demo",
          email: "equip@talent-nord.demo",
          emailNormalized: "equip@talent-nord.demo",
          city: "Sabadell",
          country: "ES",
          sector: "Recursos humans",
          source: "Referència",
          ownerId: admin.id,
        },
      });

      const carpentryCompany = await tx.company.upsert({
        where: {
          organizationId_emailNormalized: {
            organizationId: organization.id,
            emailNormalized: "info@fusteria-delta.demo",
          },
        },
        update: {
          name: "Fusteria Delta Demo",
          city: "Mataró",
          country: "ES",
          sector: "Indústria",
          source: "Prospecció",
          ownerId: admin.id,
          deletedAt: null,
        },
        create: {
          organizationId: organization.id,
          name: "Fusteria Delta Demo",
          email: "info@fusteria-delta.demo",
          emailNormalized: "info@fusteria-delta.demo",
          city: "Mataró",
          country: "ES",
          sector: "Indústria",
          source: "Prospecció",
          ownerId: admin.id,
        },
      });

      const architectureContact = await tx.contact.upsert({
        where: {
          organizationId_emailNormalized: {
            organizationId: organization.id,
            emailNormalized: "laia@alba-arquitectura.demo",
          },
        },
        update: {
          firstName: "Laia",
          lastName: "Serra",
          phone: "+34 600 000 101",
          phoneNormalized: "+34600000101",
          position: "Directora",
          companyId: architectureCompany.id,
          source: "Dades de demostració",
          preferredLanguage: "ca",
          ownerId: admin.id,
          deletedAt: null,
        },
        create: {
          organizationId: organization.id,
          firstName: "Laia",
          lastName: "Serra",
          email: "laia@alba-arquitectura.demo",
          emailNormalized: "laia@alba-arquitectura.demo",
          phone: "+34 600 000 101",
          phoneNormalized: "+34600000101",
          position: "Directora",
          companyId: architectureCompany.id,
          source: "Dades de demostració",
          preferredLanguage: "ca",
          ownerId: admin.id,
        },
      });

      const restaurantContact = await tx.contact.upsert({
        where: {
          organizationId_emailNormalized: {
            organizationId: organization.id,
            emailNormalized: "marta@bistro-mediterrani.demo",
          },
        },
        update: {
          firstName: "Marta",
          lastName: "Puig",
          phone: "+34 600 000 202",
          phoneNormalized: "+34600000202",
          position: "Gerent",
          companyId: restaurantCompany.id,
          source: "Formulari web",
          preferredLanguage: "ca",
          ownerId: admin.id,
          deletedAt: null,
        },
        create: {
          organizationId: organization.id,
          firstName: "Marta",
          lastName: "Puig",
          email: "marta@bistro-mediterrani.demo",
          emailNormalized: "marta@bistro-mediterrani.demo",
          phone: "+34 600 000 202",
          phoneNormalized: "+34600000202",
          position: "Gerent",
          companyId: restaurantCompany.id,
          source: "Formulari web",
          preferredLanguage: "ca",
          ownerId: admin.id,
        },
      });

      const talentContact = await tx.contact.upsert({
        where: {
          organizationId_emailNormalized: {
            organizationId: organization.id,
            emailNormalized: "nuria@talent-nord.demo",
          },
        },
        update: {
          firstName: "Núria",
          lastName: "Vidal",
          position: "CEO",
          companyId: talentCompany.id,
          source: "Referència",
          preferredLanguage: "ca",
          ownerId: admin.id,
          deletedAt: null,
        },
        create: {
          organizationId: organization.id,
          firstName: "Núria",
          lastName: "Vidal",
          email: "nuria@talent-nord.demo",
          emailNormalized: "nuria@talent-nord.demo",
          position: "CEO",
          companyId: talentCompany.id,
          source: "Referència",
          preferredLanguage: "ca",
          ownerId: admin.id,
        },
      });

      const carpentryContact = await tx.contact.upsert({
        where: {
          organizationId_emailNormalized: {
            organizationId: organization.id,
            emailNormalized: "joan@fusteria-delta.demo",
          },
        },
        update: {
          firstName: "Joan",
          lastName: "Riera",
          position: "Propietari",
          companyId: carpentryCompany.id,
          source: "Prospecció",
          preferredLanguage: "ca",
          ownerId: admin.id,
          deletedAt: null,
        },
        create: {
          organizationId: organization.id,
          firstName: "Joan",
          lastName: "Riera",
          email: "joan@fusteria-delta.demo",
          emailNormalized: "joan@fusteria-delta.demo",
          position: "Propietari",
          companyId: carpentryCompany.id,
          source: "Prospecció",
          preferredLanguage: "ca",
          ownerId: admin.id,
        },
      });

      const wonOpportunity = await tx.opportunity.upsert({
        where: { id: "seed-opportunity-backoffice-smart" },
        update: {
          organizationId: organization.id,
          title: "Backoffice Smart — Alba Arquitectura (Demo)",
          companyId: architectureCompany.id,
          contactId: architectureContact.id,
          pipelineId: pipeline.id,
          stageId: stageId("guanyat"),
          ownerId: admin.id,
          valueCents: 250_000,
          currency,
          probability: 100,
          status: "WON",
          source: "Dades de demostració",
          closedAt: dateAt(-5),
          deletedAt: null,
        },
        create: {
          id: "seed-opportunity-backoffice-smart",
          organizationId: organization.id,
          title: "Backoffice Smart — Alba Arquitectura (Demo)",
          companyId: architectureCompany.id,
          contactId: architectureContact.id,
          pipelineId: pipeline.id,
          stageId: stageId("guanyat"),
          ownerId: admin.id,
          valueCents: 250_000,
          currency,
          probability: 100,
          status: "WON",
          source: "Dades de demostració",
          closedAt: dateAt(-5),
        },
      });

      const meetingOpportunity = await tx.opportunity.upsert({
        where: { id: "seed-opportunity-agent-inbound" },
        update: {
          organizationId: organization.id,
          title: "Agent inbound — Talent Nord (Demo)",
          companyId: talentCompany.id,
          contactId: talentContact.id,
          pipelineId: pipeline.id,
          stageId: stageId("reunio-programada"),
          ownerId: admin.id,
          valueCents: 480_000,
          currency,
          probability: 55,
          expectedCloseDate: dateAt(21),
          status: "OPEN",
          source: "Referència",
          closedAt: null,
          deletedAt: null,
        },
        create: {
          id: "seed-opportunity-agent-inbound",
          organizationId: organization.id,
          title: "Agent inbound — Talent Nord (Demo)",
          companyId: talentCompany.id,
          contactId: talentContact.id,
          pipelineId: pipeline.id,
          stageId: stageId("reunio-programada"),
          ownerId: admin.id,
          valueCents: 480_000,
          currency,
          probability: 55,
          expectedCloseDate: dateAt(21),
          status: "OPEN",
          source: "Referència",
        },
      });

      const newOpportunity = await tx.opportunity.upsert({
        where: { id: "seed-opportunity-restaurant-demo" },
        update: {
          organizationId: organization.id,
          title: "Automatització de reserves — Bistró Mediterrani (Demo)",
          companyId: restaurantCompany.id,
          contactId: restaurantContact.id,
          pipelineId: pipeline.id,
          stageId: stageId("lead-nou"),
          ownerId: admin.id,
          valueCents: 95_000,
          currency,
          probability: 10,
          expectedCloseDate: dateAt(30),
          status: "OPEN",
          source: "Formulari web",
          closedAt: null,
          deletedAt: null,
        },
        create: {
          id: "seed-opportunity-restaurant-demo",
          organizationId: organization.id,
          title: "Automatització de reserves — Bistró Mediterrani (Demo)",
          companyId: restaurantCompany.id,
          contactId: restaurantContact.id,
          pipelineId: pipeline.id,
          stageId: stageId("lead-nou"),
          ownerId: admin.id,
          valueCents: 95_000,
          currency,
          probability: 10,
          expectedCloseDate: dateAt(30),
          status: "OPEN",
          source: "Formulari web",
        },
      });

      await tx.opportunityStageHistory.upsert({
        where: { id: "seed-stage-history-won" },
        update: {
          organizationId: organization.id,
          opportunityId: wonOpportunity.id,
          fromStageId: stageId("negociacio"),
          toStageId: stageId("guanyat"),
          changedById: admin.id,
          reason: "Pressupost acceptat (dades de demostració)",
          changedAt: dateAt(-5),
        },
        create: {
          id: "seed-stage-history-won",
          organizationId: organization.id,
          opportunityId: wonOpportunity.id,
          fromStageId: stageId("negociacio"),
          toStageId: stageId("guanyat"),
          changedById: admin.id,
          reason: "Pressupost acceptat (dades de demostració)",
          changedAt: dateAt(-5),
        },
      });

      await tx.opportunityStageHistory.upsert({
        where: { id: "seed-stage-history-meeting" },
        update: {
          organizationId: organization.id,
          opportunityId: meetingOpportunity.id,
          fromStageId: stageId("qualificat"),
          toStageId: stageId("reunio-programada"),
          changedById: admin.id,
          reason: "Reunió confirmada (dades de demostració)",
          changedAt: dateAt(-1),
        },
        create: {
          id: "seed-stage-history-meeting",
          organizationId: organization.id,
          opportunityId: meetingOpportunity.id,
          fromStageId: stageId("qualificat"),
          toStageId: stageId("reunio-programada"),
          changedById: admin.id,
          reason: "Reunió confirmada (dades de demostració)",
          changedAt: dateAt(-1),
        },
      });

      await tx.lead.upsert({
        where: { id: "seed-lead-restaurant-converted" },
        update: {
          organizationId: organization.id,
          companyId: restaurantCompany.id,
          contactId: restaurantContact.id,
          ownerId: admin.id,
          opportunityId: newOpportunity.id,
          status: "CONVERTED",
          source: "Formulari web",
          score: 68,
          convertedAt: dateAt(-2),
          deletedAt: null,
        },
        create: {
          id: "seed-lead-restaurant-converted",
          organizationId: organization.id,
          companyId: restaurantCompany.id,
          contactId: restaurantContact.id,
          ownerId: admin.id,
          opportunityId: newOpportunity.id,
          status: "CONVERTED",
          source: "Formulari web",
          score: 68,
          convertedAt: dateAt(-2),
        },
      });

      await tx.lead.upsert({
        where: { id: "seed-lead-carpentry-new" },
        update: {
          organizationId: organization.id,
          companyId: carpentryCompany.id,
          contactId: carpentryContact.id,
          ownerId: admin.id,
          opportunityId: null,
          status: "NEW",
          source: "Prospecció",
          score: 42,
          convertedAt: null,
          deletedAt: null,
        },
        create: {
          id: "seed-lead-carpentry-new",
          organizationId: organization.id,
          companyId: carpentryCompany.id,
          contactId: carpentryContact.id,
          ownerId: admin.id,
          status: "NEW",
          source: "Prospecció",
          score: 42,
        },
      });

      const form = await tx.form.upsert({
        where: { slug: "demanar-una-demo" },
        update: {
          organizationId: organization.id,
          name: "Demanar una demo",
          description: "Formulari públic de demostració per iniciar una conversa comercial.",
          isActive: true,
          pipelineId: pipeline.id,
          initialStageId: stageId("lead-nou"),
          ownerId: admin.id,
          successMessage: "Gràcies! Hem rebut la teva sol·licitud i et contactarem aviat.",
          consentText: "Accepto que AImetos tracti les dades per respondre aquesta sol·licitud.",
          createFollowUpTask: true,
          followUpTaskDelayHours: 24,
          webhookEnabled: true,
          archivedAt: null,
        },
        create: {
          organizationId: organization.id,
          name: "Demanar una demo",
          slug: "demanar-una-demo",
          description: "Formulari públic de demostració per iniciar una conversa comercial.",
          isActive: true,
          pipelineId: pipeline.id,
          initialStageId: stageId("lead-nou"),
          ownerId: admin.id,
          successMessage: "Gràcies! Hem rebut la teva sol·licitud i et contactarem aviat.",
          consentText: "Accepto que AImetos tracti les dades per respondre aquesta sol·licitud.",
          createFollowUpTask: true,
          followUpTaskDelayHours: 24,
          webhookEnabled: true,
        },
      });

      const formFields = [
        { label: "Nom", name: "firstName", type: "TEXT" as const, required: true, placeholder: "El teu nom", position: 0 },
        { label: "Cognoms", name: "lastName", type: "TEXT" as const, required: false, placeholder: "Els teus cognoms", position: 1 },
        { label: "Correu electrònic", name: "email", type: "EMAIL" as const, required: true, placeholder: "tu@empresa.com", position: 2 },
        { label: "Telèfon", name: "phone", type: "PHONE" as const, required: false, placeholder: "+34 600 000 000", position: 3 },
        { label: "Empresa", name: "companyName", type: "TEXT" as const, required: false, placeholder: "Nom de l'empresa", position: 4 },
        { label: "En què et podem ajudar?", name: "message", type: "TEXTAREA" as const, required: true, placeholder: "Explica'ns breument el teu objectiu", position: 5 },
        { label: "Consentiment", name: "consent", type: "CHECKBOX" as const, required: true, placeholder: null, position: 6 },
      ];

      for (const field of formFields) {
        await tx.formField.upsert({
          where: { formId_name: { formId: form.id, name: field.name } },
          update: {
            organizationId: organization.id,
            label: field.label,
            type: field.type,
            required: field.required,
            placeholder: field.placeholder,
            position: field.position,
          },
          create: {
            organizationId: organization.id,
            formId: form.id,
            label: field.label,
            name: field.name,
            type: field.type,
            required: field.required,
            placeholder: field.placeholder,
            position: field.position,
          },
        });
      }

      const followUpTask = await tx.task.upsert({
        where: { id: "seed-task-form-follow-up" },
        update: {
          organizationId: organization.id,
          title: "Contactar Marta sobre la sol·licitud de demo",
          description: "Tasques i dades creades pel seed de demostració.",
          status: "PENDING",
          priority: "HIGH",
          dueAt: dateAt(0, 14),
          completedAt: null,
          assignedToId: admin.id,
          createdById: admin.id,
          contactId: restaurantContact.id,
          companyId: restaurantCompany.id,
          opportunityId: newOpportunity.id,
          deletedAt: null,
        },
        create: {
          id: "seed-task-form-follow-up",
          organizationId: organization.id,
          title: "Contactar Marta sobre la sol·licitud de demo",
          description: "Tasques i dades creades pel seed de demostració.",
          status: "PENDING",
          priority: "HIGH",
          dueAt: dateAt(0, 14),
          assignedToId: admin.id,
          createdById: admin.id,
          contactId: restaurantContact.id,
          companyId: restaurantCompany.id,
          opportunityId: newOpportunity.id,
        },
      });

      await tx.task.upsert({
        where: { id: "seed-task-overdue" },
        update: {
          organizationId: organization.id,
          title: "Preparar la reunió amb Talent Nord",
          description: "Revisar necessitats, volum de consultes i criteris de qualificació.",
          status: "PENDING",
          priority: "URGENT",
          dueAt: dateAt(-1, 10),
          completedAt: null,
          assignedToId: admin.id,
          createdById: admin.id,
          contactId: talentContact.id,
          companyId: talentCompany.id,
          opportunityId: meetingOpportunity.id,
          deletedAt: null,
        },
        create: {
          id: "seed-task-overdue",
          organizationId: organization.id,
          title: "Preparar la reunió amb Talent Nord",
          description: "Revisar necessitats, volum de consultes i criteris de qualificació.",
          status: "PENDING",
          priority: "URGENT",
          dueAt: dateAt(-1, 10),
          assignedToId: admin.id,
          createdById: admin.id,
          contactId: talentContact.id,
          companyId: talentCompany.id,
          opportunityId: meetingOpportunity.id,
        },
      });

      await tx.task.upsert({
        where: { id: "seed-task-onboarding" },
        update: {
          organizationId: organization.id,
          title: "Preparar onboarding d'Alba Arquitectura",
          description: "Confirmar responsables, accessos i calendari inicial.",
          status: "IN_PROGRESS",
          priority: "NORMAL",
          dueAt: dateAt(2, 9),
          completedAt: null,
          assignedToId: admin.id,
          createdById: admin.id,
          contactId: architectureContact.id,
          companyId: architectureCompany.id,
          opportunityId: wonOpportunity.id,
          deletedAt: null,
        },
        create: {
          id: "seed-task-onboarding",
          organizationId: organization.id,
          title: "Preparar onboarding d'Alba Arquitectura",
          description: "Confirmar responsables, accessos i calendari inicial.",
          status: "IN_PROGRESS",
          priority: "NORMAL",
          dueAt: dateAt(2, 9),
          assignedToId: admin.id,
          createdById: admin.id,
          contactId: architectureContact.id,
          companyId: architectureCompany.id,
          opportunityId: wonOpportunity.id,
        },
      });

      const submission = await tx.formSubmission.upsert({
        where: {
          organizationId_requestId: {
            organizationId: organization.id,
            requestId: "seed-form-submission-demo-001",
          },
        },
        update: {
          formId: form.id,
          rawData: {
            firstName: "Marta",
            lastName: "Puig",
            email: "marta@bistro-mediterrani.demo",
            phone: "+34 600 000 202",
            companyName: "Bistró Mediterrani Demo",
            message: "Volem automatitzar la gestió inicial de reserves i consultes.",
            consent: true,
          },
          processedData: { source: "seed", demo: true },
          companyId: restaurantCompany.id,
          contactId: restaurantContact.id,
          opportunityId: newOpportunity.id,
          followUpTaskId: followUpTask.id,
          utmSource: "linkedin",
          utmMedium: "social",
          utmCampaign: "demo-crm",
          sourceUrl: "https://aimetos.com/demo",
          referer: "https://www.linkedin.com/",
          honeypotTriggered: false,
          isSpam: false,
          consentAccepted: true,
          submittedAt: dateAt(-2, 11),
          processedAt: dateAt(-2, 11),
        },
        create: {
          organizationId: organization.id,
          formId: form.id,
          requestId: "seed-form-submission-demo-001",
          rawData: {
            firstName: "Marta",
            lastName: "Puig",
            email: "marta@bistro-mediterrani.demo",
            phone: "+34 600 000 202",
            companyName: "Bistró Mediterrani Demo",
            message: "Volem automatitzar la gestió inicial de reserves i consultes.",
            consent: true,
          },
          processedData: { source: "seed", demo: true },
          companyId: restaurantCompany.id,
          contactId: restaurantContact.id,
          opportunityId: newOpportunity.id,
          followUpTaskId: followUpTask.id,
          utmSource: "linkedin",
          utmMedium: "social",
          utmCampaign: "demo-crm",
          sourceUrl: "https://aimetos.com/demo",
          referer: "https://www.linkedin.com/",
          honeypotTriggered: false,
          isSpam: false,
          consentAccepted: true,
          submittedAt: dateAt(-2, 11),
          processedAt: dateAt(-2, 11),
        },
      });

      await tx.documentSequence.upsert({
        where: {
          organizationId_type_year: {
            organizationId: organization.id,
            type: "QUOTE",
            year,
          },
        },
        update: { prefix: "P", padding: 4 },
        create: {
          organizationId: organization.id,
          type: "QUOTE",
          year,
          prefix: "P",
          padding: 4,
          nextValue: 2,
        },
      });

      await tx.documentSequence.upsert({
        where: {
          organizationId_type_year: {
            organizationId: organization.id,
            type: "INVOICE",
            year,
          },
        },
        update: { prefix: "F", padding: 4 },
        create: {
          organizationId: organization.id,
          type: "INVOICE",
          year,
          prefix: "F",
          padding: 4,
          nextValue: 2,
        },
      });

      const quoteNumber = `P-${year}-0001`;
      const quote = await tx.quote.upsert({
        where: {
          organizationId_number: {
            organizationId: organization.id,
            number: quoteNumber,
          },
        },
        update: {
          status: "ACCEPTED",
          companyId: architectureCompany.id,
          contactId: architectureContact.id,
          opportunityId: wonOpportunity.id,
          issueDate: dateAt(-12),
          validUntil: dateAt(18),
          currency,
          subtotalCents: 250_000,
          discountType: null,
          discountValue: 0,
          discountAmountCents: 0,
          taxAmountCents: 52_500,
          totalCents: 302_500,
          notesText: "Pressupost de demostració. No és un document fiscal real.",
          terms: "Validesa de 30 dies. Pagament segons condicions acordades.",
          publicToken: longSeedToken("quote", organization.id),
          sentAt: dateAt(-11),
          viewedAt: dateAt(-10),
          acceptedAt: dateAt(-5),
          rejectedAt: null,
          expiredAt: null,
          cancelledAt: null,
          decisionComment: "Proposta acceptada per a la demostració del CRM.",
          followUpEnabled: false,
          followUpDays: [3, 7, 14],
          followUpsCancelledAt: dateAt(-5),
          createdById: admin.id,
        },
        create: {
          organizationId: organization.id,
          number: quoteNumber,
          status: "ACCEPTED",
          companyId: architectureCompany.id,
          contactId: architectureContact.id,
          opportunityId: wonOpportunity.id,
          issueDate: dateAt(-12),
          validUntil: dateAt(18),
          currency,
          subtotalCents: 250_000,
          discountAmountCents: 0,
          taxAmountCents: 52_500,
          totalCents: 302_500,
          notesText: "Pressupost de demostració. No és un document fiscal real.",
          terms: "Validesa de 30 dies. Pagament segons condicions acordades.",
          publicToken: longSeedToken("quote", organization.id),
          sentAt: dateAt(-11),
          viewedAt: dateAt(-10),
          acceptedAt: dateAt(-5),
          decisionComment: "Proposta acceptada per a la demostració del CRM.",
          followUpEnabled: false,
          followUpDays: [3, 7, 14],
          followUpsCancelledAt: dateAt(-5),
          createdById: admin.id,
        },
      });

      await tx.quoteItem.deleteMany({
        where: { organizationId: organization.id, quoteId: quote.id },
      });
      await tx.quoteItem.create({
        data: {
          organizationId: organization.id,
          quoteId: quote.id,
          productId: smartProduct.id,
          description: "Backoffice Smart — implementació inicial",
          quantity: 1,
          unitPriceCents: 250_000,
          discountBps: 0,
          discountAmountCents: 0,
          taxRateBps: 2100,
          subtotalCents: 250_000,
          taxAmountCents: 52_500,
          totalCents: 302_500,
          position: 0,
        },
      });

      const invoiceNumber = `F-${year}-0001`;
      const invoice = await tx.invoice.upsert({
        where: {
          organizationId_number: {
            organizationId: organization.id,
            number: invoiceNumber,
          },
        },
        update: {
          status: "PARTIALLY_PAID",
          companyId: architectureCompany.id,
          contactId: architectureContact.id,
          opportunityId: wonOpportunity.id,
          quoteId: quote.id,
          issueDate: dateAt(-4),
          dueDate: dateAt(26),
          currency,
          subtotalCents: 250_000,
          discountAmountCents: 0,
          taxAmountCents: 52_500,
          totalCents: 302_500,
          paidAmountCents: 100_000,
          remainingAmountCents: 202_500,
          notesText: "Factura de demostració. No representa compliment complet de VeriFactu.",
          terms: "Venciment a 30 dies.",
          publicToken: longSeedToken("invoice", organization.id),
          issuedAt: dateAt(-4),
          sentAt: dateAt(-4),
          paidAt: null,
          cancelledAt: null,
          remindersEnabled: true,
          reminderOffsetsDays: [-3, 0, 3, 7],
          remindersCancelledAt: null,
          createdById: admin.id,
        },
        create: {
          organizationId: organization.id,
          number: invoiceNumber,
          status: "PARTIALLY_PAID",
          companyId: architectureCompany.id,
          contactId: architectureContact.id,
          opportunityId: wonOpportunity.id,
          quoteId: quote.id,
          issueDate: dateAt(-4),
          dueDate: dateAt(26),
          currency,
          subtotalCents: 250_000,
          discountAmountCents: 0,
          taxAmountCents: 52_500,
          totalCents: 302_500,
          paidAmountCents: 100_000,
          remainingAmountCents: 202_500,
          notesText: "Factura de demostració. No representa compliment complet de VeriFactu.",
          terms: "Venciment a 30 dies.",
          publicToken: longSeedToken("invoice", organization.id),
          issuedAt: dateAt(-4),
          sentAt: dateAt(-4),
          remindersEnabled: true,
          reminderOffsetsDays: [-3, 0, 3, 7],
          createdById: admin.id,
        },
      });

      await tx.invoiceItem.deleteMany({
        where: { organizationId: organization.id, invoiceId: invoice.id },
      });
      await tx.invoiceItem.create({
        data: {
          organizationId: organization.id,
          invoiceId: invoice.id,
          productId: smartProduct.id,
          description: "Backoffice Smart — implementació inicial",
          quantity: 1,
          unitPriceCents: 250_000,
          discountBps: 0,
          discountAmountCents: 0,
          taxRateBps: 2100,
          subtotalCents: 250_000,
          taxAmountCents: 52_500,
          totalCents: 302_500,
          position: 0,
        },
      });

      const payment = await tx.payment.upsert({
        where: {
          organizationId_idempotencyKey: {
            organizationId: organization.id,
            idempotencyKey: "seed-manual-payment-001",
          },
        },
        update: {
          invoiceId: invoice.id,
          amountCents: 100_000,
          currency,
          status: "SUCCEEDED",
          method: "MANUAL",
          externalPaymentId: "demo-transfer-001",
          receivedAt: dateAt(-2),
          refundedAmountCents: 0,
          recordedById: admin.id,
          metadata: { demo: true, note: "Pagament parcial de demostració" },
        },
        create: {
          organizationId: organization.id,
          invoiceId: invoice.id,
          amountCents: 100_000,
          currency,
          status: "SUCCEEDED",
          method: "MANUAL",
          externalPaymentId: "demo-transfer-001",
          idempotencyKey: "seed-manual-payment-001",
          receivedAt: dateAt(-2),
          refundedAmountCents: 0,
          recordedById: admin.id,
          metadata: { demo: true, note: "Pagament parcial de demostració" },
        },
      });

      const activities = [
        {
          id: "seed-activity-form-submitted",
          type: "FORM_SUBMITTED" as const,
          summary: "Marta Puig ha enviat el formulari Demanar una demo",
          details: { demo: true, requestId: submission.requestId },
          companyId: restaurantCompany.id,
          contactId: restaurantContact.id,
          opportunityId: newOpportunity.id,
          formId: form.id,
          formSubmissionId: submission.id,
          taskId: null,
          quoteId: null,
          invoiceId: null,
          paymentId: null,
          occurredAt: dateAt(-2, 11),
        },
        {
          id: "seed-activity-quote-accepted",
          type: "QUOTE_ACCEPTED" as const,
          summary: `${quoteNumber} acceptat per Alba Arquitectura Demo`,
          details: { demo: true, totalCents: quote.totalCents },
          companyId: architectureCompany.id,
          contactId: architectureContact.id,
          opportunityId: wonOpportunity.id,
          formId: null,
          formSubmissionId: null,
          taskId: null,
          quoteId: quote.id,
          invoiceId: null,
          paymentId: null,
          occurredAt: dateAt(-5),
        },
        {
          id: "seed-activity-stage-won",
          type: "STAGE_CHANGED" as const,
          summary: "Oportunitat moguda a Guanyat",
          details: { demo: true, from: "Negociació", to: "Guanyat" },
          companyId: architectureCompany.id,
          contactId: architectureContact.id,
          opportunityId: wonOpportunity.id,
          formId: null,
          formSubmissionId: null,
          taskId: null,
          quoteId: quote.id,
          invoiceId: null,
          paymentId: null,
          occurredAt: dateAt(-5),
        },
        {
          id: "seed-activity-invoice-sent",
          type: "INVOICE_SENT" as const,
          summary: `${invoiceNumber} enviada a Alba Arquitectura Demo`,
          details: { demo: true, totalCents: invoice.totalCents },
          companyId: architectureCompany.id,
          contactId: architectureContact.id,
          opportunityId: wonOpportunity.id,
          formId: null,
          formSubmissionId: null,
          taskId: null,
          quoteId: quote.id,
          invoiceId: invoice.id,
          paymentId: null,
          occurredAt: dateAt(-4),
        },
        {
          id: "seed-activity-payment-received",
          type: "PAYMENT_RECEIVED" as const,
          summary: "Pagament parcial rebut",
          details: { demo: true, amountCents: payment.amountCents },
          companyId: architectureCompany.id,
          contactId: architectureContact.id,
          opportunityId: wonOpportunity.id,
          formId: null,
          formSubmissionId: null,
          taskId: null,
          quoteId: quote.id,
          invoiceId: invoice.id,
          paymentId: payment.id,
          occurredAt: dateAt(-2),
        },
      ];

      for (const activity of activities) {
        await tx.activity.upsert({
          where: { id: activity.id },
          update: {
            organizationId: organization.id,
            type: activity.type,
            summary: activity.summary,
            details: activity.details,
            actorId: admin.id,
            companyId: activity.companyId,
            contactId: activity.contactId,
            opportunityId: activity.opportunityId,
            formId: activity.formId,
            formSubmissionId: activity.formSubmissionId,
            taskId: activity.taskId,
            quoteId: activity.quoteId,
            invoiceId: activity.invoiceId,
            paymentId: activity.paymentId,
            occurredAt: activity.occurredAt,
          },
          create: {
            id: activity.id,
            organizationId: organization.id,
            type: activity.type,
            summary: activity.summary,
            details: activity.details,
            actorId: admin.id,
            companyId: activity.companyId,
            contactId: activity.contactId,
            opportunityId: activity.opportunityId,
            formId: activity.formId,
            formSubmissionId: activity.formSubmissionId,
            taskId: activity.taskId,
            quoteId: activity.quoteId,
            invoiceId: activity.invoiceId,
            paymentId: activity.paymentId,
            occurredAt: activity.occurredAt,
          },
        });
      }

      await tx.note.upsert({
        where: { id: "seed-note-opportunity" },
        update: {
          organizationId: organization.id,
          content: "Nota de demostració: el client prioritza visibilitat operativa i traçabilitat.",
          authorId: admin.id,
          companyId: talentCompany.id,
          contactId: talentContact.id,
          opportunityId: meetingOpportunity.id,
          quoteId: null,
          invoiceId: null,
          deletedAt: null,
        },
        create: {
          id: "seed-note-opportunity",
          organizationId: organization.id,
          content: "Nota de demostració: el client prioritza visibilitat operativa i traçabilitat.",
          authorId: admin.id,
          companyId: talentCompany.id,
          contactId: talentContact.id,
          opportunityId: meetingOpportunity.id,
        },
      });

      await tx.outboxEvent.upsert({
        where: {
          organizationId_idempotencyKey: {
            organizationId: organization.id,
            idempotencyKey: "seed-form-submitted-event-001",
          },
        },
        update: {
          eventType: "form.submitted",
          aggregateType: "FormSubmission",
          aggregateId: submission.id,
          payload: {
            demo: true,
            submissionId: submission.id,
            contactId: restaurantContact.id,
            opportunityId: newOpportunity.id,
          },
          status: "DELIVERED",
          occurredAt: dateAt(-2, 11),
          availableAt: dateAt(-2, 11),
          processedAt: dateAt(-2, 11),
          attempts: 0,
          lastError: null,
        },
        create: {
          organizationId: organization.id,
          eventType: "form.submitted",
          aggregateType: "FormSubmission",
          aggregateId: submission.id,
          payload: {
            demo: true,
            submissionId: submission.id,
            contactId: restaurantContact.id,
            opportunityId: newOpportunity.id,
          },
          status: "DELIVERED",
          idempotencyKey: "seed-form-submitted-event-001",
          occurredAt: dateAt(-2, 11),
          availableAt: dateAt(-2, 11),
          processedAt: dateAt(-2, 11),
        },
      });

      await tx.emailMessage.upsert({
        where: {
          organizationId_idempotencyKey: {
            organizationId: organization.id,
            idempotencyKey: "seed-invoice-email-001",
          },
        },
        update: {
          templateKey: "invoice.sent",
          toAddress: architectureContact.email || "laia@alba-arquitectura.demo",
          ccAddresses: [],
          bccAddresses: [],
          subject: `${invoiceNumber} — AImetos (demostració)`,
          htmlBody: `<p>Hola Laia,</p><p>Aquest és un correu de demostració per a la factura ${invoiceNumber}.</p>`,
          textBody: `Hola Laia,\n\nAquest és un correu de demostració per a la factura ${invoiceNumber}.`,
          status: "SENT",
          attempts: 1,
          nextAttemptAt: dateAt(-4),
          lastError: null,
          providerMessageId: "seed-mailpit-message-001",
          contactId: architectureContact.id,
          quoteId: quote.id,
          invoiceId: invoice.id,
          sentAt: dateAt(-4),
        },
        create: {
          organizationId: organization.id,
          templateKey: "invoice.sent",
          toAddress: architectureContact.email || "laia@alba-arquitectura.demo",
          ccAddresses: [],
          bccAddresses: [],
          subject: `${invoiceNumber} — AImetos (demostració)`,
          htmlBody: `<p>Hola Laia,</p><p>Aquest és un correu de demostració per a la factura ${invoiceNumber}.</p>`,
          textBody: `Hola Laia,\n\nAquest és un correu de demostració per a la factura ${invoiceNumber}.`,
          status: "SENT",
          attempts: 1,
          nextAttemptAt: dateAt(-4),
          providerMessageId: "seed-mailpit-message-001",
          idempotencyKey: "seed-invoice-email-001",
          contactId: architectureContact.id,
          quoteId: quote.id,
          invoiceId: invoice.id,
          sentAt: dateAt(-4),
        },
      });

      await tx.scheduledJob.upsert({
        where: {
          organizationId_deduplicationKey: {
            organizationId: organization.id,
            deduplicationKey: "seed-invoice-reminder-001",
          },
        },
        update: {
          type: "INVOICE_REMINDER",
          status: "PENDING",
          runAt: dateAt(23),
          payload: { demo: true, invoiceId: invoice.id, offsetDays: -3 },
          attempts: 0,
          maxAttempts: 5,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          completedAt: null,
          cancelledAt: null,
          invoiceId: invoice.id,
        },
        create: {
          organizationId: organization.id,
          type: "INVOICE_REMINDER",
          status: "PENDING",
          runAt: dateAt(23),
          payload: { demo: true, invoiceId: invoice.id, offsetDays: -3 },
          attempts: 0,
          maxAttempts: 5,
          deduplicationKey: "seed-invoice-reminder-001",
          invoiceId: invoice.id,
        },
      });

      await tx.auditLog.upsert({
        where: { id: "seed-audit-initial-data" },
        update: {
          organizationId: organization.id,
          userId: admin.id,
          action: "seed.initialized",
          entityType: "Organization",
          entityId: organization.id,
          after: { demoData: true, year },
          metadata: { source: "prisma/seed.ts" },
          occurredAt: new Date(Date.now() - DAY_MS),
        },
        create: {
          id: "seed-audit-initial-data",
          organizationId: organization.id,
          userId: admin.id,
          action: "seed.initialized",
          entityType: "Organization",
          entityId: organization.id,
          after: { demoData: true, year },
          metadata: { source: "prisma/seed.ts" },
          occurredAt: new Date(Date.now() - DAY_MS),
        },
      });

      return {
        demoData: true as const,
        organizationId: organization.id,
        adminEmail: admin.email,
        pipelineId: pipeline.id,
        formSlug: form.slug,
        quoteNumber,
        invoiceNumber,
      };
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.log(result.demoData ? "Seed demo AImetos CRM completat." : "Bootstrap AImetos CRM completat sense dades demo.");
  console.log(`Organització: ${result.organizationId}`);
  console.log(`Administrador: ${result.adminEmail}`);
  console.log(`Pipeline: ${result.pipelineId}`);
  if (result.demoData) {
    console.log(`Formulari públic: /f/${result.formSlug}`);
    console.log(`Documents demo: ${result.quoteNumber}, ${result.invoiceNumber}`);
  }
}

main()
  .catch((error) => {
    console.error("No s'ha pogut completar el seed d'AImetos CRM.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
