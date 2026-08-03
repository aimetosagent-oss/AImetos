import { getDemoData } from "./demo-data";
import { getClockifyHours, type ClockifyPeriod } from "./integrations/clockify";
import { readSheetRange, rowsToRecords } from "./integrations/google-sheets";
import { getN8nAgents } from "./integrations/n8n";
import type { ControlCenterData, Incident, LeadSummary, ProjectRow, SourceState } from "./types";

const text = (value: unknown) => String(value ?? "").trim();
const number = (value: unknown) => {
  if (typeof value === "number") return value;
  const parsed = Number(text(value).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const percent = (value: unknown) => {
  if (typeof value === "number") return value <= 1 ? value * 100 : value;
  return number(value);
};
const date = (value: unknown) => {
  const parsed = new Date(text(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

function previousWeekBounds() {
  const today = new Date();
  const day = (today.getDay() + 6) % 7;
  const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day);
  const start = new Date(thisMonday.getTime() - 7 * 86_400_000);
  return { start, end: thisMonday };
}

async function loadProjects(base: ControlCenterData) {
  const records = rowsToRecords(await readSheetRange(process.env.PROJECTS_SHEET_ID, "PROJECTES!A1:AE1000"));
  const completionHeader = process.env.PROJECT_COMPLETION_DATE_HEADER || "DATA FINALITZACIÓ";
  const inactive = new Set(["finalitzat", "congelat", "latent", "cancel·lat", "cancelado"]);
  const rows: ProjectRow[] = records.filter((row) => text(row.ID)).map((row) => {
    const status = text(row.ESTAT);
    const urgency = text(row["RISC SISTÈMIC / URGÈNCIA REAL"]);
    const nextAction = text(row["NEXT ACTION"]);
    const completedAt = date(row[completionHeader])?.toISOString();
    return {
      id: text(row.ID),
      name: text(row["NOM DE PROJECTE"]),
      status,
      progress: percent(row["AVANÇ"]),
      nextAction,
      urgency,
      blocked: !inactive.has(status.toLowerCase()) && (!nextAction || status.toLowerCase().includes("bloque")),
      adjustedValue: number(row["€/DIA AJUSTAT"]) || undefined,
      completedAt,
    };
  });
  const activeRows = rows.filter((row) => !inactive.has(row.status.toLowerCase()));
  const completedTotal = rows.filter((row) => row.status.toLowerCase() === "finalitzat").length;
  const hasCompletionDates = rows.some((row) => row.completedAt);
  const { start, end } = previousWeekBounds();
  const completedPreviousWeek = hasCompletionDates
    ? rows.filter((row) => row.completedAt && new Date(row.completedAt) >= start && new Date(row.completedAt) < end).length
    : null;
  base.projects = {
    ...base.projects,
    active: activeRows.length,
    completedTotal,
    completedPreviousWeek,
    completedMetricNote: hasCompletionDates ? undefined : `Afegeix la columna “${completionHeader}” per calcular-ho amb exactitud.`,
    blocked: activeRows.filter((row) => row.blocked).length,
    projects: activeRows.sort((a, b) => Number(b.blocked) - Number(a.blocked) || b.progress - a.progress).slice(0, 12),
  };
}

async function loadLeads(base: ControlCenterData) {
  const [outboundValues, linkedinValues, ghValues] = await Promise.all([
    readSheetRange(process.env.OUTBOUND_SHEET_ID, "'Hoja 1'!A1:Y15000"),
    readSheetRange(process.env.LINKEDIN_SHEET_ID, "Leads!A1:P1500"),
    readSheetRange(process.env.GH_COMPUTE_SHEET_ID, "03_LEADS_CUALIFICADOS!A1:AB1500"),
  ]);
  const outbound = rowsToRecords(outboundValues).filter((row) => text(row.id));
  const linkedin = rowsToRecords(linkedinValues).filter((row) => text(row.ID));
  const gh = rowsToRecords(ghValues).filter((row) => text(row.lead_id));
  const cutoff = Date.now() - 7 * 86_400_000;
  const recentOutbound = outbound.filter((row) => (date(row.last_contact_date)?.getTime() || 0) >= cutoff).length;
  const recentLinkedin = linkedin.filter((row) => (date(row["Data captura"])?.getTime() || 0) >= cutoff).length;
  const recentGh = gh.filter((row) => (date(row.created_at)?.getTime() || 0) >= cutoff).length;
  const contacted = outbound.filter((row) => ["sent", "contacted"].includes(text(row.outreach_status).toLowerCase()) || text(row.lead_status).toLowerCase() === "contacted").length;
  const replies = outbound.filter((row) => !["", "pending_reply", "pending"].includes(text(row.reply_status).toLowerCase())).length;
  const enrichmentErrors = outbound.filter((row) => text(row.apollo_status).toLowerCase().includes("error")).length;
  const total = outbound.length + linkedin.length + gh.length;
  const recentBySource = [
    { label: "Outbound", value: recentOutbound },
    { label: "LinkedIn", value: recentLinkedin },
    { label: "Grasshopper", value: recentGh },
  ];
  const highlights = [
    recentGh > 0 ? { source: "Grasshopper", title: `${recentGh} lead${recentGh === 1 ? " nou" : "s nous"}`, detail: "Revisa els leads qualificats de l’última setmana.", href: "/leads?source=grasshopper" } : null,
    recentLinkedin > 0 ? { source: "LinkedIn", title: `${recentLinkedin} lead${recentLinkedin === 1 ? " nou" : "s nous"}`, detail: "Nous registres capturats durant els últims 7 dies.", href: "/leads?source=linkedin" } : null,
    recentOutbound > 0 ? { source: "Outbound", title: `${recentOutbound} activitat${recentOutbound === 1 ? " nova" : "s noves"}`, detail: "Contactes actualitzats durant els últims 7 dies.", href: "/leads?source=outbound" } : null,
  ].filter(Boolean) as LeadSummary["highlights"];
  base.leads = {
    total,
    newLast7Days: recentOutbound + recentLinkedin + recentGh,
    qualified: gh.length,
    contacted,
    replies,
    enrichmentErrors,
    bySource: [
      { label: "Outbound", value: outbound.length },
      { label: "LinkedIn", value: linkedin.length },
      { label: "Grasshopper", value: gh.length },
    ],
    recentBySource,
    highlights,
    trend: base.leads.trend,
  };
}

async function loadSocial(base: ControlCenterData) {
  const [reportValues, topValues, calendarValues] = await Promise.all([
    readSheetRange(process.env.SOCIAL_SHEET_ID, "01_Client_Report!A1:B50"),
    readSheetRange(process.env.SOCIAL_SHEET_ID, "02_Top_Content!A1:J100"),
    readSheetRange(process.env.SOCIAL_SHEET_ID, "04_Calendar!A1:F100"),
  ]);
  const report = new Map(reportValues.slice(1).map((row) => [text(row[0]), row[1]]));
  const top = rowsToRecords(topValues).filter((row) => text(row.Rank));
  const calendar = rowsToRecords(calendarValues);
  base.social = {
    winningChannel: text(report.get("Canal guanyador")) || "—",
    winningFormat: text(report.get("Format guanyador")) || "—",
    decision: text(report.get("Decisio")) || "Sense recomanació",
    readyToReview: calendar.filter((row) => text(row.Status) === "ready_to_review").length,
    draftsNeeded: calendar.filter((row) => text(row.Status) === "draft_needed").length,
    qualifiedLeads: top.reduce((sum, row) => sum + number(row["Qualified leads"]), 0),
    meetings: top.reduce((sum, row) => sum + number(row.Meetings), 0),
    topContent: top.slice(0, 8).map((row) => ({
      rank: number(row.Rank), title: text(row.Title), platform: text(row.Platform), format: text(row.Format),
      qualifiedLeads: number(row["Qualified leads"]), meetings: number(row.Meetings), score: number(row.Score),
    })),
  };
}

async function loadFinance(base: ControlCenterData) {
  if (!process.env.FINANCE_SHEET_ID) throw new Error("Falta la còpia nativa del full financer");
  const [movementValues, quarterValues] = await Promise.all([
    readSheetRange(process.env.FINANCE_SHEET_ID, "MOVIMENTS!A1:R2000"),
    readSheetRange(process.env.FINANCE_SHEET_ID, "TRIMESTRAL!A1:L100"),
  ]);
  const movements = rowsToRecords(movementValues);
  const quarterRows = rowsToRecords(quarterValues);
  const now = new Date();
  const quarter = `Q${Math.floor(now.getMonth() / 3) + 1}`;
  const current = quarterRows.find((row) => number(row.Any) === now.getFullYear() && text(row.Trimestre) === quarter);
  const realCash = movements.filter((row) => text(row["Real/Fictici"]).toLowerCase() === "real" && ["cobrat", "pagat"].includes(text(row.Estat).toLowerCase())).reduce((sum, row) => sum + number(row["Base €"]) + number(row["IVA €"]), 0);
  base.finance = {
    cashReal: Math.round(realCash * 100) / 100,
    cashForecast: current ? number(current["Flux caixa Real + Fictici"]) : null,
    quarterResult: current ? number(current["Benefici net"]) : null,
    taxEstimate: current ? number(current["Total a pagar aprox."]) : null,
    pendingIncome: movements.filter((row) => text(row.Tipus).toLowerCase().includes("ingrés") && text(row.Estat).toLowerCase() === "pendent").reduce((sum, row) => sum + number(row["Base €"]), 0),
    pendingExpenses: Math.abs(movements.filter((row) => text(row.Tipus).toLowerCase() === "despesa" && text(row.Estat).toLowerCase() === "pendent").reduce((sum, row) => sum + number(row["Base €"]), 0)),
    quarterLabel: `${quarter} ${now.getFullYear()}`,
    nativeSheetReady: true,
  };
}

function deriveIncidents(data: ControlCenterData) {
  const incidents: Incident[] = [];
  for (const agent of data.agents.filter((row) => row.health !== "ok")) incidents.push({
    id: `agent-${agent.id}`, severity: agent.health === "error" ? "high" : "medium", category: "agent",
    title: `${agent.name}: ${agent.health === "error" ? "error" : "revisió necessària"}`,
    detail: agent.error || "No s'ha executat dins la freqüència esperada.", occurredAt: agent.lastRun || data.generatedAt, href: "/agents",
  });
  if (data.projects.blocked) incidents.push({ id: "projects-blocked", severity: "medium", category: "project", title: `${data.projects.blocked} projectes bloquejats`, detail: "Revisa les pròximes accions i dependències.", occurredAt: data.generatedAt, href: "/projects" });
  if (data.leads.enrichmentErrors) incidents.push({ id: "lead-errors", severity: "medium", category: "lead", title: `${data.leads.enrichmentErrors} errors d'enriquiment`, detail: "Hi ha leads que Apollo o una altra font no ha pogut completar.", occurredAt: data.generatedAt, href: "/leads" });
  if (!data.finance.nativeSheetReady) incidents.push({ id: "finance-source", severity: "low", category: "finance", title: "Finances pendents de connexió nativa", detail: "Configura la còpia nativa de Google Sheets per activar els totals reals.", occurredAt: data.generatedAt, href: "/finances" });
  return incidents.slice(0, 8);
}

export async function getControlCenterData(options: { forceDemo?: boolean; clockifyPeriod?: ClockifyPeriod } | boolean = false): Promise<ControlCenterData> {
  const config = typeof options === "boolean" ? { forceDemo: options } : options;
  const data = getDemoData();
  if (config.forceDemo) return data;
  const allowDemoFallback = process.env.ALLOW_DEMO_FALLBACK === "true";
  data.mode = "live";
  const sources: SourceState[] = [];
  const tasks = [
    {
      id: "projects", label: "Projectes", task: () => loadProjects(data), onFailure: () => {
        data.projects = { ...data.projects, active: 0, completedTotal: 0, completedPreviousWeek: null, completedMetricNote: "Font de projectes no disponible.", blocked: 0, projects: [] };
      },
    },
    {
      id: "leads", label: "Leads", task: () => loadLeads(data), onFailure: () => {
        data.leads = { total: 0, newLast7Days: 0, qualified: 0, contacted: 0, replies: 0, enrichmentErrors: 0, bySource: [], recentBySource: [], highlights: [], trend: [] };
      },
    },
    {
      id: "social", label: "XXSS", task: () => loadSocial(data), onFailure: () => {
        data.social = { winningChannel: "—", winningFormat: "—", decision: "Font de xarxes socials no disponible.", readyToReview: 0, draftsNeeded: 0, qualifiedLeads: 0, meetings: 0, topContent: [] };
      },
    },
    {
      id: "finance", label: "Finances", task: () => loadFinance(data), onFailure: () => {
        data.finance = { cashReal: null, cashForecast: null, quarterResult: null, taxEstimate: null, pendingIncome: null, pendingExpenses: null, quarterLabel: "—", nativeSheetReady: false };
      },
    },
    {
      id: "n8n", label: "n8n", task: async () => { data.agents = await getN8nAgents(); }, onFailure: () => { data.agents = []; },
    },
    {
      id: "clockify", label: "Clockify", task: async () => { const hours = await getClockifyHours(config.clockifyPeriod || "31d"); data.projects.hours31Days = hours.total; data.projects.hoursByProject = hours.byProject; }, onFailure: () => {
        data.projects.hours31Days = null;
        data.projects.hoursByProject = [];
      },
    },
  ];
  const results = await Promise.allSettled(tasks.map((item) => item.task()));
  results.forEach((result, index) => {
    const item = tasks[index];
    if (result.status === "rejected" && !allowDemoFallback) item.onFailure();
    sources.push(result.status === "fulfilled"
      ? { id: item.id, label: item.label, health: "ok", detail: "Connectat", updatedAt: new Date().toISOString() }
      : { id: item.id, label: item.label, health: "error", detail: result.reason instanceof Error ? result.reason.message : "Error desconegut" });
  });
  if (results.some((result) => result.status === "rejected")) data.mode = "partial";
  data.generatedAt = new Date().toISOString();
  data.sources = sources;
  data.incidents = deriveIncidents(data);
  return data;
}

export function sanitizeForDemo(data: ControlCenterData): ControlCenterData {
  const demo = structuredClone(data);
  demo.mode = "demo";
  demo.finance = getDemoData().finance;
  demo.projects.projects = demo.projects.projects.map((project, index) => ({ ...project, id: String(index + 1), name: `Projecte ${String.fromCharCode(65 + index)}` }));
  demo.agents = demo.agents.map((agent, index) => ({ ...agent, id: String(index + 1), name: ["Agent outbound", "Agent LinkedIn", "Agent sectorial"][index] || `Agent ${index + 1}`, url: undefined, error: agent.error ? "Cal revisar la configuració de la font" : undefined }));
  demo.incidents = demo.incidents.map((incident) => ({
    ...incident,
    href: "/demo",
    title: incident.category === "agent" ? "Un agent necessita revisió" : incident.title,
    detail: incident.category === "agent" ? "Cal revisar la configuració d'una font de dades." : incident.detail,
  }));
  demo.sources = demo.sources.map((source) => ({ ...source, detail: source.health === "ok" ? "Connectat" : "Dades de mostra" }));
  return demo;
}
