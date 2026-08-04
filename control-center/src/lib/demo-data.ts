import type { ControlCenterData } from "./types";

const now = new Date();
const isoAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

export function getDemoData(): ControlCenterData {
  return {
    generatedAt: now.toISOString(),
    mode: "demo",
    agents: [
      { id: "outbound", name: "Outbound diari", cadence: "Laborables · 08:00", health: "ok", active: true, lastRun: isoAgo(2), nextExpected: isoAgo(-22), processed: 84 },
      { id: "linkedin", name: "LinkedIn Leads", cadence: "Cada dia · 11:30", health: "ok", active: true, lastRun: isoAgo(5), nextExpected: isoAgo(-19), processed: 25 },
      { id: "grasshopper", name: "Grasshopper", cadence: "Dilluns · 07:00", health: "warning", active: true, lastRun: isoAgo(190), nextExpected: isoAgo(22), processed: 4, error: "Una font no té endpoint configurat" },
    ],
    leads: {
      total: 1_284,
      newLast7Days: 109,
      qualified: 18,
      contacted: 71,
      replies: 6,
      enrichmentErrors: 7,
      bySource: [
        { label: "Outbound", value: 72 },
        { label: "LinkedIn", value: 25 },
        { label: "Grasshopper", value: 12 },
      ],
      recentBySource: [
        { label: "Outbound", value: 72 },
        { label: "LinkedIn", value: 25 },
        { label: "Grasshopper", value: 12 },
      ],
      highlights: [
        { source: "Grasshopper", title: "1 lead nou interessant", detail: "Revisa el lead qualificat més recent.", href: "/demo" },
        { source: "LinkedIn", title: "5 leads nous", detail: "Nous registres capturats aquesta setmana.", href: "/demo" },
      ],
      trend: [
        { label: "Dl", value: 12 }, { label: "Dt", value: 18 }, { label: "Dc", value: 14 },
        { label: "Dj", value: 21 }, { label: "Dv", value: 17 }, { label: "Ds", value: 10 }, { label: "Dg", value: 17 },
      ],
    },
    projects: {
      active: 14,
      completedTotal: 6,
      completedPreviousWeek: 3,
      blocked: 2,
      hours31Days: 47.5,
      projects: [
        { id: "84", name: "Sistema outbound AImetos", status: "En curs", progress: 68, nextAction: "Validar les respostes positives", urgency: "Alta", blocked: false, hours31Days: 13.5 },
        { id: "91", name: "Dashboard de control", status: "En curs", progress: 35, nextAction: "Connectar fonts de lectura", urgency: "Alta", blocked: false, hours31Days: 11 },
        { id: "76", name: "Agents de veu en català", status: "Bloquejat", progress: 42, nextAction: "Esperar mostres de veu", urgency: "Mitjana", blocked: true, hours31Days: 7.25 },
        { id: "63", name: "Content Intelligence MVP", status: "En curs", progress: 74, nextAction: "Revisar calendari de continguts", urgency: "Mitjana", blocked: false, hours31Days: 9.75 },
      ],
      hoursByProject: [
        { label: "Outbound", value: 13.5 }, { label: "Control Center", value: 11 },
        { label: "Contingut", value: 9.75 }, { label: "Veu", value: 7.25 }, { label: "Altres", value: 6 },
      ],
    },
    finance: {
      cashReal: 1_434.02,
      cashForecast: 2_180.5,
      quarterResult: -480.67,
      taxEstimate: -45.15,
      pendingIncome: 920,
      pendingExpenses: 173.4,
      quarterLabel: "Q2 2026",
      nativeSheetReady: false,
    },
    social: {
      winningChannel: "LinkedIn",
      winningFormat: "Technical post",
      decision: "Produir un technical post i adaptar-lo a reel curt",
      readyToReview: 1,
      draftsNeeded: 2,
      qualifiedLeads: 6,
      meetings: 4,
      topContent: [
        { rank: 1, title: "Decisió sobre voice agents", platform: "LinkedIn", format: "Technical post", qualifiedLeads: 3, meetings: 2, score: 347.48 },
        { rank: 2, title: "Errors habituals en automatitzacions", platform: "Instagram", format: "Carrusel", qualifiedLeads: 2, meetings: 1, score: 286.2 },
        { rank: 3, title: "Dashboards de decisió", platform: "YouTube", format: "Vídeo curt", qualifiedLeads: 1, meetings: 1, score: 214.8 },
      ],
    },
    incidents: [
      { id: "i1", severity: "high", category: "agent", title: "Grasshopper necessita revisió", detail: "L’última execució va ometre una font sense endpoint configurat.", occurredAt: isoAgo(9) },
      { id: "i2", severity: "medium", category: "project", title: "2 projectes bloquejats", detail: "Hi ha projectes actius sense una següent acció executable.", occurredAt: isoAgo(18) },
      { id: "i3", severity: "low", category: "lead", title: "18 leads qualificats", detail: "Sis leads nous superen el criteri de prioritat aquesta setmana.", occurredAt: isoAgo(25) },
    ],
    sources: [
      { id: "n8n", label: "n8n", health: "warning", detail: "Dades demostració" },
      { id: "sheets", label: "Google Sheets", health: "ok", detail: "Dades demostració" },
      { id: "clockify", label: "Clockify", health: "ok", detail: "Dades demostració" },
    ],
  };
}
