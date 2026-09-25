import { createHash } from "node:crypto";
import { hash } from "bcryptjs";
import { PrismaClient, type FormFieldType } from "@prisma/client";

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

type SeedFormField = {
  label: string;
  name: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
};

const commonContactFields = (includeSector = true): SeedFormField[] => [
  { label: "Nombre", name: "firstName", type: "TEXT", required: true, placeholder: "Nombre" },
  { label: "Apellidos", name: "lastName", type: "TEXT", required: true, placeholder: "Apellidos" },
  { label: "Empresa", name: "companyName", type: "TEXT", required: true, placeholder: "Empresa" },
  { label: "Cargo en la empresa", name: "position", type: "TEXT", required: true },
  { label: "Teléfono", name: "phone", type: "PHONE", required: true, placeholder: "+34" },
  { label: "E-mail", name: "email", type: "EMAIL", required: true, placeholder: "nombre@empresa.com" },
  ...(includeSector ? [{ label: "Sector", name: "sector", type: "TEXT" as const, required: false }] : []),
];

const serviceFormDefinitions: Array<{
  name: string;
  slug: string;
  description: string;
  fields: SeedFormField[];
}> = [
  {
    name: "AImetos - Atención automatizada 24/7",
    slug: "atencion-automatizada-24-7",
    description: "Formulario de diagnóstico para el servicio de atención automatizada.",
    fields: [
      { label: "1. ¿Qué está pasando cuando un cliente escribe fuera de horario?", name: "afterHoursResponse", type: "RADIO", required: true, options: ["Se responde al día siguiente", "Se responde cuando alguien puede", "Muchas consultas se pierden", "Siempre respondemos rápido"] },
      { label: "2. ¿Qué volumen aproximado de mensajes recibís al día?", name: "dailyMessageVolume", type: "RADIO", required: true, options: ["Menos de 10", "10-30", "30-100", "Más de 100"] },
      { label: "3. ¿Dónde recibís más consultas?", name: "inquiryChannels", type: "MULTI_CHECKBOX", required: true, options: ["WhatsApp", "Instagram / Facebook", "Web", "Email", "Llamadas"] },
      { label: "4. ¿Qué es lo que más os frustra del sistema actual?", name: "currentFrustrations", type: "MULTI_CHECKBOX", required: true, options: ["Perdemos oportunidades por tardar en responder", "Nos quita tiempo de tareas importantes", "No sabemos qué consultas convierten", "No tenemos un sistema claro"] },
      { label: "5. ¿Estás buscando una solución puntual o una mejora estructural de tu proceso comercial?", name: "improvementScope", type: "RADIO", required: true, options: ["Algo puntual", "Mejorar una parte concreta", "Reestructurar todo el sistema"] },
      { label: "6. ¿Cuándo te gustaría tenerlo funcionando?", name: "implementationTimeline", type: "RADIO", required: true, options: ["En menos de 30 días", "En 1–3 meses", "Solo estoy explorando opciones"] },
      { label: "7. Describe brevemente cómo gestionáis ahora la atención al cliente", name: "currentServiceProcess", type: "TEXTAREA", required: false, placeholder: "Respuesta corta" },
      ...commonContactFields(),
    ],
  },
  {
    name: "AImetos - Reservas automatizadas",
    slug: "reservas-automatizadas",
    description: "Formulario de diagnóstico para el servicio de reservas automatizadas.",
    fields: [
      { label: "1. ¿Cómo gestionáis actualmente las citas?", name: "appointmentManagement", type: "MULTI_CHECKBOX", required: true, options: ["Manualmente por WhatsApp", "Llamadas", "Calendario online básico", "No tenemos sistema claro"] },
      { label: "2. ¿Qué problemas son habituales?", name: "appointmentProblems", type: "MULTI_CHECKBOX", required: true, options: ["Citas duplicadas", "Cancelación sin aviso", "Errores en horarios", "Demasiado tiempo gestionando agenda"] },
      { label: "3. ¿Cuántas citas gestionáis al mes?", name: "monthlyAppointments", type: "RADIO", required: true, options: ["Menos de 50", "50-100", "150-300", "Más de 300"] },
      { label: "4. ¿A qué sector pertenece tu empresa?", name: "sector", type: "TEXT", required: true, placeholder: "Respuesta corta" },
      { label: "5. ¿Qué impacto tendría automatizar esto?", name: "automationImpact", type: "MULTI_CHECKBOX", required: true, options: ["Más tiempo para clientes", "Menos errores", "Más reservas", "Más control del negocio"] },
      { label: "6. ¿Estás buscando una solución puntual o una mejora estructural de tu proceso comercial?", name: "improvementScope", type: "RADIO", required: true, options: ["Algo puntual", "Mejorar una parte concreta", "Restructurar todo el sistema"] },
      { label: "7. ¿Cuándo te gustaría tenerlo funcionando?", name: "implementationTimeline", type: "RADIO", required: true, options: ["En menos de 30 días", "En 1–3 meses", "Solo estoy explorando opciones"] },
      ...commonContactFields(false),
    ],
  },
  {
    name: "AImetos - Cualificación de leads",
    slug: "cualificacion-de-leads",
    description: "Formulario de diagnóstico para el servicio de cualificación de leads.",
    fields: [
      { label: "1. ¿Qué pasa cuando entra un nuevo lead?", name: "newLeadProcess", type: "RADIO", required: true, options: ["Lo llamamos cuando podemos", "Se pierde si no respondemos rápido", "No sabemos qué leads son realmente buenos", "Tenemos un proceso definido"] },
      { label: "2. ¿De dónde vienen la mayoría de vuestros leads?", name: "leadSources", type: "MULTI_CHECKBOX", required: true, options: ["Google Ads", "Meta Ads", "Orgánico", "Referencias", "No tenemos claro el canal"] },
      { label: "3. ¿Qué es lo que más os preocupa?", name: "leadConcerns", type: "MULTI_CHECKBOX", required: true, options: ["Perder oportunidades", "Perder tiempo con leads no cualificados", "Falta de seguimiento", "No saber qué canal convierte mejor"] },
      { label: "4. ¿Tenéis CRM actualmente?", name: "hasCrm", type: "RADIO", required: true, options: ["Sí", "No", "Usamos Excel / Otros formatos"] },
      { label: "5. ¿Estás buscando una solución puntual o una mejora estructural de tu proceso comercial?", name: "improvementScope", type: "RADIO", required: true, options: ["Algo puntual", "Mejorar una parte concreta", "Restructurar todo el sistema"] },
      { label: "6. ¿Cuándo te gustaría tenerlo funcionando?", name: "implementationTimeline", type: "RADIO", required: true, options: ["En menos de 30 días", "En 1–3 meses", "Solo estoy explorando opciones"] },
      { label: "7. Describe brevemente vuestro proceso actual de seguimiento", name: "currentFollowUpProcess", type: "TEXTAREA", required: true, placeholder: "Respuesta corta" },
      ...commonContactFields(),
    ],
  },
  {
    name: "AImetos - Integración total",
    slug: "integracion-total",
    description: "Formulario de diagnóstico para conectar el sistema comercial.",
    fields: [
      { label: "1. ¿Qué herramientas utilizáis actualmente?", name: "currentTools", type: "MULTI_CHECKBOX", required: true, options: ["CRM", "WhatsApp Business", "Google Calendar", "Email marketing", "Excel", "Varias herramientas desconectadas"] },
      { label: "2. ¿Dónde crees que se rompe el flujo comercial?", name: "flowBreaks", type: "MULTI_CHECKBOX", required: true, options: ["Asignación de leads", "Seguimiento", "Gestión de citas", "Reportes y métricas", "No tenemos claridad"] },
      { label: "3. ¿Qué consecuencia tiene esto hoy?", name: "currentConsequences", type: "MULTI_CHECKBOX", required: true, options: ["Leads perdidos", "Datos duplicados", "Tiempo perdido copiando información", "Falta de visibilidad"] },
      { label: "4. ¿Cuántas personas forman parte del equipo comercial?", name: "salesTeamSize", type: "RADIO", required: true, options: ["1 persona", "2-5 personas", "Más de 5"] },
      { label: "5. ¿Estás buscando una solución puntual o una mejora estructural de tu proceso comercial?", name: "improvementScope", type: "RADIO", required: true, options: ["Algo puntual", "Mejorar una parte concreta", "Restructurar todo el sistema"] },
      { label: "6. ¿Cuándo te gustaría tenerlo funcionando?", name: "implementationTimeline", type: "RADIO", required: true, options: ["En menos de 30 días", "En 1–3 meses", "Solo estoy explorando opciones"] },
      { label: "7. Describe brevemente vuestro sistema actual", name: "currentSystem", type: "TEXTAREA", required: true, placeholder: "Respuesta corta" },
      ...commonContactFields(),
    ],
  },
];

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
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const dateValue = (type: "year" | "month" | "day") => dateParts.find((part) => part.type === type)?.value;
  const documentPeriodKey = `${dateValue("year")}${dateValue("month")}${dateValue("day")}`;

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
          legalName: "Roger Arnau Bach",
          taxId: "45646645V",
          email: "hola@aimetos.com",
          website: "https://aimetos.com",
          address: "C/ Soler i Palet 15",
          city: "Terrassa",
          postalCode: "08222",
          country: "ES",
          currency,
          defaultTaxRateBps: 2100,
          paymentTermsDays: 30,
          timezone,
          quotePrefix: "PRE",
          quoteNumberLength: 2,
          quoteValidityDays: 30,
          quoteFollowUpDays: [3, 7, 14],
          invoicePrefix: "FAC",
          invoiceNumberLength: 2,
          invoiceDueDays: 30,
          invoiceReminderOffsetsDays: [-3, 0, 3, 7],
          stripeTestMode: true,
        },
        create: {
          organizationId: organization.id,
          tradeName: "AImetos",
          legalName: "Roger Arnau Bach",
          taxId: "45646645V",
          email: "hola@aimetos.com",
          website: "https://aimetos.com",
          address: "C/ Soler i Palet 15",
          city: "Terrassa",
          postalCode: "08222",
          country: "ES",
          currency,
          defaultTaxRateBps: 2100,
          paymentTermsDays: 30,
          timezone,
          quotePrefix: "PRE",
          quoteNumberLength: 2,
          quoteValidityDays: 30,
          quoteFollowUpDays: [3, 7, 14],
          invoicePrefix: "FAC",
          invoiceNumberLength: 2,
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
        update: { name: "Embudo Clientes", isDefault: true, isActive: true },
        create: {
          organizationId: organization.id,
          name: "Embudo Clientes",
          slug: "comercial",
          isDefault: true,
          isActive: true,
        },
      });

      const stageDefinitions = [
        { name: "Nuevo Lead", slug: "lead-nou", position: 0, type: "OPEN" as const, probability: 8, color: "#0e7490" },
        { name: "Contactado", slug: "contactat", position: 1, type: "OPEN" as const, probability: 15, color: "#0284c7" },
        { name: "Cita Confirmada", slug: "reunio-programada", position: 2, type: "OPEN" as const, probability: 23, color: "#2563eb" },
        { name: "Asistio a Llamada - Muy Interesado", slug: "qualificat", position: 3, type: "OPEN" as const, probability: 31, color: "#4f46e5" },
        { name: "Asistio a Llamada - Interes medio", slug: "interes-medio", position: 4, type: "OPEN" as const, probability: 38, color: "#7c3aed" },
        { name: "Asistio a Llamada - Interes bajo", slug: "interes-bajo", position: 5, type: "OPEN" as const, probability: 46, color: "#9333ea" },
        { name: "Reagendar", slug: "reagendar", position: 6, type: "OPEN" as const, probability: 54, color: "#c026d3" },
        { name: "Presupuesto enviado", slug: "proposta-enviada", position: 7, type: "OPEN" as const, probability: 62, color: "#db2777" },
        { name: "Seguimiento / negociación", slug: "negociacio", position: 8, type: "OPEN" as const, probability: 69, color: "#e11d48" },
        { name: "Ganado / pago anticipado", slug: "pago-anticipado", position: 9, type: "OPEN" as const, probability: 77, color: "#ea580c" },
        { name: "Pago completo/venta", slug: "guanyat", position: 10, type: "WON" as const, probability: 85, color: "#0f766e" },
        { name: "No cualificado / perdido", slug: "perdut", position: 11, type: "LOST" as const, probability: 92, color: "#64748b" },
      ];

      await tx.pipelineStage.updateMany({
        where: { pipelineId: pipeline.id },
        data: { position: { increment: 100 } },
      });

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
        { sku: "SETUP-GENERAL", name: "Setup general obligatori", description: "Alta de plataformes, APIs, credencials i estructura base. Pagament únic per client.", price: 19_000, billingType: "ONE_TIME" as const },
        { sku: "BACKOFFICE-SMART", name: "Pack 1 - Backoffice Smart", description: "Agent intern simple. Requereix manteniment Bàsic.", price: 90_000, billingType: "ONE_TIME" as const },
        { sku: "BACKOFFICE-CORE", name: "Pack 2 - Backoffice Core", description: "Agent intern crític o complex. Requereix manteniment Pro.", price: 290_000, billingType: "ONE_TIME" as const },
        { sku: "AGENT-TEXT", name: "Pack 3 - Text (WhatsApp/Web)", description: "Atenció i generació de leads. Requereix manteniment Mitjà.", price: 190_000, billingType: "ONE_TIME" as const },
        { sku: "AGENT-INBOUND", name: "Pack 4 - Inbound (Trucades)", description: "Recepció de trucades. Requereix manteniment Mitjà o Pro.", price: 160_000, billingType: "ONE_TIME" as const },
        { sku: "INBOUND-MULTILINGUAL", name: "Pack 4+ - Extensió multilingüe", description: "Complement multilingüe per al Pack Inbound.", price: 150_000, billingType: "ONE_TIME" as const },
        { sku: "AGENT-OUTBOUND", name: "Pack 5 - Outbound", description: "Trucades comercials. Requereix manteniment Pro.", price: 240_000, billingType: "ONE_TIME" as const },
        { sku: "PACK-AUTONOM", name: "Pack 6 - Autònom", description: "Generació de pressupostos i factures. Manteniment bàsic amb oferta del 50% segons acord comercial.", price: 49_500, billingType: "ONE_TIME" as const },
        { sku: "MAINT-BASIC", name: "Manteniment Bàsic", description: "Monitorització i ajustos mínims. Ideal per al Pack 1.", price: 9_000, billingType: "RECURRING" as const },
        { sku: "MAINT-MEDIUM", name: "Manteniment Mitjà", description: "Optimització i ajustos mensuals. Ideal per als Packs 3 i 4.", price: 19_000, billingType: "RECURRING" as const },
        { sku: "MAINT-PRO", name: "Manteniment Pro", description: "Prioritat, agents crítics i seguiment continu. Obligatori per als Packs 2 i 5.", price: 39_000, billingType: "RECURRING" as const },
        { sku: "VOLUME-BASIC", name: "Escalat +10 agents - Bàsic", description: "Preu per agent a partir de 10 agents amb Pla Bàsic.", price: 7_000, billingType: "RECURRING" as const },
        { sku: "VOLUME-MEDIUM", name: "Escalat +10 agents - Mitjà", description: "Preu per agent a partir de 10 agents amb Pla Mitjà.", price: 16_000, billingType: "RECURRING" as const },
        { sku: "MONTHLY-PACK-1", name: "Membresia Pack 1 - Backoffice Smart", description: "Modalitat mensual flexible equivalent al Pack 1.", price: 19_000, billingType: "RECURRING" as const },
        { sku: "MONTHLY-PACK-2", name: "Membresia Pack 2 - Backoffice Core", description: "Modalitat mensual flexible equivalent al Pack 2.", price: 79_000, billingType: "RECURRING" as const },
        { sku: "MONTHLY-PACK-3", name: "Membresia Pack 3 - Text", description: "Modalitat mensual flexible equivalent al Pack 3.", price: 42_000, billingType: "RECURRING" as const },
        { sku: "MONTHLY-PACK-4", name: "Membresia Pack 4 - Inbound", description: "Modalitat mensual flexible equivalent al Pack 4.", price: 39_000, billingType: "RECURRING" as const },
        { sku: "MONTHLY-PACK-4-PLUS", name: "Membresia Pack 4+ - Multilingüe", description: "Complement mensual multilingüe per al Pack Inbound.", price: 22_000, billingType: "RECURRING" as const },
        { sku: "MONTHLY-PACK-5", name: "Membresia Pack 5 - Outbound", description: "Modalitat mensual flexible equivalent al Pack 5.", price: 69_000, billingType: "RECURRING" as const },
        { sku: "MONTHLY-PACK-6", name: "Membresia Pack 6 - Autònom", description: "Modalitat mensual flexible per a pressupostos i factures.", price: 15_000, billingType: "RECURRING" as const },
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

      const consentText = "Al marcar esta casilla, doy mi consentimiento para recibir mensajes transaccionales relacionados con mi cuenta, pedidos o servicios que he solicitado. Estos mensajes pueden incluir recordatorios de citas, confirmaciones de pedidos y notificaciones de cuenta, entre otros. La frecuencia de los mensajes puede variar. Se pueden aplicar tarifas por mensajes y datos. Responda \"HELP\" para obtener ayuda o \"STOP\" para cancelar la suscripción.";
      for (const definition of serviceFormDefinitions) {
        const serviceForm = await tx.form.upsert({
          where: { slug: definition.slug },
          update: {
            organizationId: organization.id,
            name: definition.name,
            description: definition.description,
            isActive: true,
            pipelineId: pipeline.id,
            initialStageId: stageId("lead-nou"),
            ownerId: admin.id,
            successMessage: "Gracias. Hemos recibido tu solicitud y te contactaremos pronto.",
            submitLabel: "Confirmación demo 30'",
            consentText,
            createFollowUpTask: true,
            followUpTaskDelayHours: 24,
            webhookEnabled: false,
            archivedAt: null,
          },
          create: {
            organizationId: organization.id,
            name: definition.name,
            slug: definition.slug,
            description: definition.description,
            isActive: true,
            pipelineId: pipeline.id,
            initialStageId: stageId("lead-nou"),
            ownerId: admin.id,
            successMessage: "Gracias. Hemos recibido tu solicitud y te contactaremos pronto.",
            submitLabel: "Confirmación demo 30'",
            consentText,
            createFollowUpTask: true,
            followUpTaskDelayHours: 24,
            webhookEnabled: false,
          },
        });

        await tx.formField.deleteMany({ where: { formId: serviceForm.id } });
        await tx.formField.createMany({
          data: definition.fields.map((field, position) => ({
            organizationId: organization.id,
            formId: serviceForm.id,
            label: field.label,
            name: field.name,
            type: field.type,
            required: field.required,
            placeholder: field.placeholder,
            options: field.options ?? [],
            position,
          })),
        });
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
          webhookEnabled: false,
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
          webhookEnabled: false,
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
          organizationId_type_periodKey: {
            organizationId: organization.id,
            type: "QUOTE",
            periodKey: documentPeriodKey,
          },
        },
        update: { prefix: "PRE", padding: 2 },
        create: {
          organizationId: organization.id,
          type: "QUOTE",
          periodKey: documentPeriodKey,
          prefix: "PRE",
          padding: 2,
          nextValue: 2,
        },
      });

      await tx.documentSequence.upsert({
        where: {
          organizationId_type_periodKey: {
            organizationId: organization.id,
            type: "INVOICE",
            periodKey: documentPeriodKey,
          },
        },
        update: { prefix: "FAC", padding: 2 },
        create: {
          organizationId: organization.id,
          type: "INVOICE",
          periodKey: documentPeriodKey,
          prefix: "FAC",
          padding: 2,
          nextValue: 2,
        },
      });

      const quoteNumber = `PRE-${documentPeriodKey}-01`;
      const quotePublicToken = longSeedToken("quote", organization.id);
      const quote = await tx.quote.upsert({
        where: { publicToken: quotePublicToken },
        update: {
          number: quoteNumber,
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
          publicToken: quotePublicToken,
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
          publicToken: quotePublicToken,
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

      const invoiceNumber = `FAC-${documentPeriodKey}-01`;
      const invoicePublicToken = longSeedToken("invoice", organization.id);
      const invoice = await tx.invoice.upsert({
        where: { publicToken: invoicePublicToken },
        update: {
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
          publicToken: invoicePublicToken,
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
          publicToken: invoicePublicToken,
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
          after: { demoData: true, documentPeriodKey },
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
          after: { demoData: true, documentPeriodKey },
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
