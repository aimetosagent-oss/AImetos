import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ContentIdea, MetricRecord } from "../../shared/src/domain.ts";
import { loadConfig, type RuntimeConfig } from "../../config/src/env.ts";
import { analyzePerformance } from "../../analytics/src/performance.ts";
import { generateFiveIdeas, selectBestIdeas } from "../../strategy/src/ideation.ts";
import { generateContentForIdea } from "../../content/src/generator.ts";
import { publishMock, scheduleContent } from "../../publishing/src/scheduler.ts";
import { buildConnectorRegistry } from "../../connectors/src/registry.ts";
import { transitionPath } from "./state-machine.ts";
import { validateIdea, validateMetric } from "../../validation/src/schemas.ts";

export type MockFlowReport = {
  runId: string;
  mode: string;
  scenario: string;
  analysis: ReturnType<typeof analyzePerformance>;
  generatedIdeas: ContentIdea[];
  selectedIdeas: ContentIdea[];
  approvedIdeas: ContentIdea[];
  contents: ReturnType<typeof generateContentForIdea>[];
  publications: ReturnType<typeof publishMock>[];
  auditLog: ReturnType<typeof transitionPath>;
  connectorHealth: Array<{ name: string; status: string; ok: boolean; message: string }>;
  metricsCollected: boolean;
  report: {
    summary: string;
    recommendations: string[];
  };
};

export type ClientContentRecommendation = {
  title: string;
  format: string;
  channel: string;
  displayFormat: string;
  displayChannel: string;
  reason: string;
  recommended: boolean;
  whyRecommended: string;
  hook: string;
  postCopy: string;
  bestPublishTime: string;
  metricsToTrack: string[];
  publicationStatus: "pending_publish" | "published" | "metrics_24h" | "metrics_72h" | "validated";
  productionBrief: string;
  visualBrief: string;
  imageAsset: string;
  imagePrompt: string;
  cta: string;
  effort: "low" | "medium" | "high";
};

export type ClientMonthlyReport = {
  reportId: string;
  clientName: string;
  period: string;
  generatedAt: string;
  executiveSummary: string;
  businessObjective: string;
  strategy: {
    quarterly: string;
    monthly: string;
    publication: string;
  };
  decision: {
    nextBestFormat: string;
    nextBestChannel: string;
    nextAction: string;
    confidence: "low" | "medium" | "high";
    confidenceLabel: string;
    confidenceNote: string;
  };
  weeklyValidation: {
    period: string;
    status: "initial_positive" | "needs_adjustment" | "validated";
    summary: string;
    totals: {
      posts: number;
      impressions: number;
      reach: number;
      profileVisits: number;
      reactions: number;
      comments: number;
      shares: number;
      saves: number;
      newFollowers: number;
      probableInvitations: number;
      qualifiedLeads: number;
      meetings: number;
    };
    visibilityWinner: { title: string; reason: string };
    audienceQualityWinner: { title: string; reason: string };
    commercialSignal: string;
    nextDecision: string;
  };
  topContent: Array<{
    rank: number;
    title: string;
    platform: string;
    format: string;
    topic: string;
    whyItWorked: string;
    metrics: {
      reach: number;
      views: number;
      impressions?: number;
      reactions?: number;
      comments?: number;
      profileVisits?: number;
      saves: number;
      shares: number;
      qualifiedLeads: number;
      meetings: number;
      score: number;
    };
  }>;
  formatInsights: Array<{
    format: string;
    score: number;
    recommendation: string;
  }>;
  recommendations: ClientContentRecommendation[];
  socialDistribution: Array<{
    channel: "linkedin" | "instagram" | "facebook";
    label: string;
    recommendation: "publish_now" | "adapt_and_publish" | "reuse_and_publish";
    format: string;
    publishTime: string;
    status: "pending_publish" | "scheduled" | "published" | "validated";
    adaptation: string;
    coherenceRule: string;
    metricsToTrack: string[];
  }>;
  calendar: Array<{
    day: string;
    title: string;
    format: string;
    channel: string;
    owner: string;
    status: "ready_to_review" | "draft_needed" | "scheduled";
  }>;
  technicalStatus: {
    mode: string;
    dataSource: string;
    credentialsRequiredNow: boolean;
    n8nWorkflowsValidated: number;
  };
};

function rootPath(relPath: string): string {
  return fileURLToPath(new URL("../../../" + relPath, import.meta.url));
}

function readJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(rootPath(relPath), "utf8")) as T;
}

function applyScenario(records: MetricRecord[], scenario: string): MetricRecord[] {
  if (scenario === "missing_data") {
    return records.map((record, index) => (index % 4 === 0 ? { ...record, clicks: 0, ctr: 0 } : record));
  }
  if (scenario === "partial_metrics") {
    return records.filter((_, index) => index % 3 !== 0);
  }
  if (scenario === "high_performance") {
    return records.map((record) => ({
      ...record,
      leads: record.leads + 2,
      qualifiedLeads: record.qualifiedLeads + 1,
      meetings: record.meetings + (record.platform === "linkedin" ? 1 : 0),
      attributedRevenue: record.attributedRevenue + 2500
    }));
  }
  if (scenario === "low_performance" || scenario === "no_qualified_ideas") {
    return records.map((record) => ({
      ...record,
      leads: Math.floor(record.leads / 2),
      qualifiedLeads: 0,
      meetings: 0,
      attributedRevenue: 0,
      ctr: Number((record.ctr / 2).toFixed(4))
    }));
  }
  return records;
}

function contentScore(record: MetricRecord): number {
  return Number(
    (
      record.qualifiedLeads * 28 +
      record.meetings * 35 +
      record.saves * 4 +
      record.shares * 5 +
      record.comments * 2 +
      record.retention * 30 +
      record.ctr * 250
    ).toFixed(2)
  );
}

function clientTitle(record: MetricRecord): string {
  const topic = record.topic.replace(/-/g, " ");
  const format = record.format.replace(/-/g, " ");
  if (record.platform === "instagram") return "Peça visual sobre " + topic + " (" + format + ")";
  if (record.platform === "youtube") return "Vídeo explicatiu sobre " + topic;
  if (record.platform === "linkedin") return "Post de decisió sobre " + topic;
  return "Contingut sobre " + topic;
}

function whyItWorked(record: MetricRecord): string {
  const signals = [];
  if (record.qualifiedLeads > 0) signals.push("ha generat leads qualificats");
  if (record.meetings > 0) signals.push("ha acabat en reunions");
  if (record.saves >= 5) signals.push("s'ha guardat com a referència");
  if (record.shares >= 4) signals.push("s'ha compartit dins equips");
  if (record.retention >= 0.55) signals.push("ha mantingut bona retenció");
  return signals.length > 0
    ? "Funciona perquè " + signals.join(", ") + "."
    : "Funciona com a peça de suport, però encara necessita un CTA més clar.";
}

function formatScores(records: MetricRecord[]): Array<{ format: string; score: number; recommendation: string }> {
  const scores = new Map<string, number>();
  for (const record of records) {
    scores.set(record.format, Number(((scores.get(record.format) || 0) + contentScore(record)).toFixed(2)));
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([format, score], index) => ({
      format,
      score,
      recommendation:
        index === 0
          ? "Format prioritari del mes vinent. Repetir angle i adaptar-lo a 2 canals."
          : "Mantenir com a suport si encaixa amb el tema guanyador."
    }));
}

type LinkedInPostInput = {
  id: string;
  url: string;
  topic: string;
  format: string;
  knownFromUrl: string[];
  manualMetrics: {
    impressions: number | null;
    reach?: number | null;
    reactions: number | null;
    comments: number | null;
    shares: number | null;
    saves?: number | null;
    profileVisits: number | null;
    newFollowers?: number | null;
    leads: number | null;
    meetings: number | null;
  };
};

type LinkedInWeeklyReportInput = {
  period: string;
  status: "initial_positive" | "needs_adjustment" | "validated";
  summary: string;
  totals: ClientMonthlyReport["weeklyValidation"]["totals"];
  posts: Array<{ id: string; title: string; reading: string }>;
  visibilityWinnerId: string;
  audienceQualityWinnerId: string;
  commercialSignal: string;
  nextDecision: string;
};

function hasLinkedInMetrics(posts: LinkedInPostInput[]): boolean {
  return posts.every((post) => typeof post.manualMetrics.impressions === "number");
}

function linkedInScore(post: LinkedInPostInput): number {
  const metrics = post.manualMetrics;
  return Number(
    (
      (metrics.impressions || 0) * 0.03 +
      (metrics.reactions || 0) * 2 +
      (metrics.comments || 0) * 8 +
      (metrics.shares || 0) * 12 +
      (metrics.profileVisits || 0) * 3 +
      (metrics.newFollowers || 0) * 15 +
      (metrics.leads || 0) * 30 +
      (metrics.meetings || 0) * 45
    ).toFixed(2)
  );
}

function linkedInTitle(post: LinkedInPostInput): string {
  if (post.topic.includes("transformaciondigital")) return "Transformacio digital, IA i PIMEs";
  if (post.topic.includes("engineering")) return "Workflows de disseny parametric i hardware";
  if (post.topic.includes("projectmanagement")) return "Planificacio basica de projectes";
  return post.topic.replace(/-/g, " ");
}

function linkedInWhyItWorked(post: LinkedInPostInput): string {
  const metrics = post.manualMetrics;
  const parts = [];
  if ((metrics.impressions || 0) >= 1500) parts.push("ha tingut bon abast");
  if ((metrics.comments || 0) >= 5) parts.push("ha generat conversa");
  if ((metrics.shares || 0) > 0) parts.push("s'ha compartit");
  if ((metrics.profileVisits || 0) >= 20) parts.push("ha portat visites al perfil");
  if ((metrics.newFollowers || 0) > 0) parts.push("ha generat nous seguidors");
  return parts.length > 0
    ? "Funciona perquè " + parts.join(", ") + "."
    : "Encara és una peça de senyal baix; serveix com a mostra, però no com a patró fort.";
}

export async function buildClientMonthlyReport(overrides: Partial<RuntimeConfig> = {}): Promise<ClientMonthlyReport> {
  const flow = await runMockContentFlow(overrides);
  const rawMetrics = readJson<MetricRecord[]>("data/fixtures/content-performance.json");
  const linkedInPosts = readJson<LinkedInPostInput[]>("data/fixtures/linkedin-posts.json");
  const weeklyInput = readJson<LinkedInWeeklyReportInput>("data/fixtures/linkedin-weekly-report.json");
  const config = { ...loadConfig(), ...overrides };
  const metrics = applyScenario(rawMetrics, config.mockScenario);
  const topContent = hasLinkedInMetrics(linkedInPosts)
    ? linkedInPosts
        .map((post) => ({ post, score: linkedInScore(post) }))
        .sort((a, b) => b.score - a.score)
        .map(({ post, score }, index) => ({
          rank: index + 1,
          title: linkedInTitle(post),
          platform: "linkedin",
          format: post.format,
          topic: post.topic,
          whyItWorked: linkedInWhyItWorked(post),
          metrics: {
            reach: post.manualMetrics.reach || 0,
            views: post.manualMetrics.impressions || 0,
            impressions: post.manualMetrics.impressions || 0,
            reactions: post.manualMetrics.reactions || 0,
            comments: post.manualMetrics.comments || 0,
            profileVisits: post.manualMetrics.profileVisits || 0,
            saves: post.manualMetrics.saves || 0,
            shares: post.manualMetrics.shares || 0,
            qualifiedLeads: post.manualMetrics.leads || 0,
            meetings: post.manualMetrics.meetings || 0,
            score
          }
        }))
    : metrics
        .map((record) => ({ record, score: contentScore(record) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(({ record, score }, index) => ({
          rank: index + 1,
          title: clientTitle(record),
          platform: record.platform,
          format: record.format,
          topic: record.topic,
          whyItWorked: whyItWorked(record),
          metrics: {
            reach: record.reach,
            views: record.views,
            saves: record.saves,
            shares: record.shares,
            qualifiedLeads: record.qualifiedLeads,
            meetings: record.meetings,
            score
          }
        }));

  const insights = formatScores(metrics);
  const imageAssets = [
    "/assets/linkedin-option-2-errors-n8n.png",
    "",
    ""
  ];
  const visualBriefs = [
    "Imatge tipus playbook operatiu: tres passos 'Error', 'Log' i 'Retry' per explicar que un workflow robust no nomes funciona una vegada. Inclou el logo AImetos en petit.",
    "Imatge tipus full de ruta: cinc passos ordenats 'Dades', 'Camps', 'Alertes', 'Workflows' i 'IA'. Inclou el logo AImetos en petit.",
    "Imatge de decisió amb dues columnes: 'Quan sí' i 'Quan no' per a un agent de WhatsApp. Inclou el logo AImetos en petit."
  ];
  const imagePrompts = [
    "Crea una imatge professional per LinkedIn, format 1200x627, estil B2B modern i net. Tema: automatitzacions n8n robustes. Titular: 'Un workflow no esta acabat quan funciona un cop'. Subtitol: 'Si no registra errors, no es pot escalar'. Tres blocs: 'Error', 'Log', 'Retry'. Paleta clara amb verd petrol, blau i gris. Inclou el logo AImetos en petit a una cantonada, sense modificar-lo. Sense persones artificials ni estil stock.",
    "Crea una imatge professional per LinkedIn, format 1200x627, estil de consultoria tecnològica B2B, net i sobri. Titular: 'Abans d'afegir IA al CRM, ordena això'. Mostra una seqüència clara de cinc passos: Dades, Camps, Alertes, Workflows i IA. Paleta blanca, verd petroli, blau i gris. Inclou el logo AImetos original en petit a una cantonada. Sense persones, sense estil stock i sense text petit.",
    "Crea una imatge professional per LinkedIn, format 1200x627, estil de consultoria tecnològica B2B. Titular: 'Agent de WhatsApp: quan suma i quan afegeix soroll'. Composició comparativa amb dues columnes, 'Quan sí' i 'Quan no', i tres criteris breus per columna. Paleta blanca, verd petroli, blau i gris. Inclou el logo AImetos original en petit a una cantonada. Sense persones ni estil stock."
  ];
  const bestPublishTimes = [
    "Dimarts a les 08:40",
    "Dimecres a les 09:10",
    "Dijous a les 08:50"
  ];
  const postCopies = [
    "Un workflow no esta acabat quan funciona un cop.\n\nEsta acabat quan tambe saps que passa quan falla.\n\nPer mi, una automatitzacio minimament robusta hauria de tenir 3 coses:\n\n1. Error clar: saber quin pas ha fallat.\n2. Log: guardar prou context per entendre el problema.\n3. Retry: poder repetir sense trencar el proces.\n\nAixo no es complicar el sistema. Es preparar-lo per treballar en condicions reals.\n\nSi vols, puc compartir una checklist basica per revisar automatitzacions abans de posar-les en produccio.",
    "Afegir IA a un CRM desordenat no resol el problema. L'accelera.\n\nAbans d'incorporar un agent, jo revisaria cinc capes:\n\n1. Dades mínimes completes.\n2. Camps que reflecteixen el procés real.\n3. Alertes per als seguiments crítics.\n4. Workflows repetibles.\n5. IA per decidir o assistir on aporta valor.\n\nLa IA comercial funciona millor quan el sistema ja sap què ha de passar després.\n\nSi vols, puc compartir aquesta seqüència en format checklist.",
    "Un agent de WhatsApp no arregla un procés comercial desordenat.\n\nTé sentit quan les consultes són repetitives, hi ha una resposta clara i cada conversa acaba registrada.\n\nAfegeix soroll quan ningú sap qui continua el lead, les dades queden disperses o cada cas necessita una decisió diferent.\n\nPrimer procés, després canal i finalment agent.\n\nSi vols, puc compartir un esquema simple per decidir si cal agent, CRM o redissenyar el procés."
  ];
  const displayFormats = [
    "Post LinkedIn",
    "Carrusel LinkedIn",
    "Document LinkedIn"
  ];
  const metricsToTrack = [
    "Impressions",
    "Reaccions",
    "Comentaris",
    "Comparticions",
    "Visites al perfil",
    "Nous seguidors",
    "Leads",
    "Reunions"
  ];
  const nextIdeaIds = ["idea_n8n_failures", "idea_crm_ai", "idea_whatsapp_agent"];
  const nextIdeas = nextIdeaIds
    .map((id) => flow.generatedIdeas.find((idea) => idea.id === id))
    .filter((idea): idea is ContentIdea => Boolean(idea));
  const nextContents = nextIdeas.map(generateContentForIdea);
  const recommendations = nextIdeas.map((idea, index): ClientContentRecommendation => {
    const content = nextContents[index];
    const reel = content?.adaptations.find((item) => item.channel === "reels");
    const visual = content?.adaptations.find((item) => item.channel === "visual");
    return {
      title: index === 0 ? "Un workflow no està acabat quan funciona un cop" : idea.title,
      format: index === 0 ? "linkedin-post" : index === 1 ? "linkedin-carousel" : "linkedin-document",
      channel: "linkedin",
      displayFormat: displayFormats[index] || "Post LinkedIn",
      displayChannel: "LinkedIn",
      reason: idea.justification,
      recommended: index === 0,
      whyRecommended:
        index === 0
          ? "És la millor opció perquè manté un problema empresarial concret i demostra robustesa tècnica, sense repetir els dos temes ja publicats."
          : "Opció de suport per continuar provant angles de decisió empresarial amb autoritat tècnica.",
      hook: idea.pain,
      postCopy: postCopies[index] || postCopies[0],
      bestPublishTime: bestPublishTimes[index] || bestPublishTimes[0],
      metricsToTrack,
      publicationStatus: "pending_publish",
      productionBrief: reel?.content || visual?.content || idea.mainMessage,
      visualBrief: visualBriefs[index] || "Visual net, professional i relacionat amb el problema principal del post. Inclou el logo AImetos en petit.",
      imageAsset: imageAssets[index] || "",
      imagePrompt: imagePrompts[index] || imagePrompts[0],
      cta: idea.cta,
      effort: idea.estimatedEffort <= 2 ? "low" : idea.estimatedEffort === 3 ? "medium" : "high"
    };
  });
  const socialDistribution: ClientMonthlyReport["socialDistribution"] = [
    {
      channel: "linkedin",
      label: "LinkedIn",
      recommendation: "publish_now",
      format: "Post amb imatge",
      publishTime: "Dimarts a les 08:40",
      status: "pending_publish",
      adaptation: "Publicació reflexiva i professional: explicar per què una automatització també s'ha de dissenyar per fallar bé, amb CTA suau cap a una checklist.",
      coherenceRule: "Mantenir el concepte central: un workflow no està acabat fins que gestiona errors, logs i reintents.",
      metricsToTrack
    },
    {
      channel: "instagram",
      label: "Instagram",
      recommendation: "adapt_and_publish",
      format: "Carrusel 4-5 slides",
      publishTime: "Dimecres a les 12:30",
      status: "pending_publish",
      adaptation: "Convertir Error, Log i Retry en slides visuals: portada, un criteri per slide i tancament amb checklist.",
      coherenceRule: "Mateix missatge i mateixa identitat visual, però menys text i més lectura ràpida.",
      metricsToTrack: ["Abast", "M'agrada", "Comentaris", "Desats", "Comparticions", "Visites al perfil", "Leads"]
    },
    {
      channel: "facebook",
      label: "Facebook",
      recommendation: "reuse_and_publish",
      format: "Post curt amb imatge",
      publishTime: "Dijous a les 18:15",
      status: "pending_publish",
      adaptation: "Fer el text més directe i proper: explicar que una automatització fiable també preveu què passa quan alguna dada falla.",
      coherenceRule: "Mateixa imatge i mateixa promesa, amb un to més divulgatiu i menys consultiu.",
      metricsToTrack: ["Abast", "Reaccions", "Comentaris", "Comparticions", "Clics", "Missatges", "Leads"]
    }
  ];

  return {
    reportId: "client_report_" + Date.now(),
    clientName: "Client demo AImetos",
    period: "Setmana del 14 al 19 de juliol",
    generatedAt: new Date().toISOString(),
    executiveSummary: weeklyInput.summary,
    businessObjective: "Convertir autoritat a LinkedIn en converses comercials: visites al perfil, leads qualificats i reunions.",
    strategy: {
      quarterly: "Construir autoritat en automatitzacio, IA aplicada i sistemes de decisio per PIMEs.",
      monthly: "Validar quin angle genera més senyal comercial a LinkedIn abans d'escalar a altres xarxes.",
      publication: "Mantenir dues peces setmanals: decisió empresarial i demostració tècnica, amb lectura a 24h, 72h i 7 dies."
    },
    decision: {
      nextBestFormat: "Post LinkedIn",
      nextBestChannel: "LinkedIn",
      nextAction: "Publicar una peça sobre els errors que fan fràgil una automatització, mantenint una CTA suau i mesurant també la qualitat de l'audiència.",
      confidence: "medium",
      confidenceLabel: "Hipòtesi amb senyal positiu",
      confidenceNote:
        "Mostra petita: 2 publicacions de la nova línia. La direcció és prometedora, però el patró no quedarà validat fins que generi senyals repetibles de conversa o negoci."
    },
    weeklyValidation: {
      period: weeklyInput.period,
      status: weeklyInput.status,
      summary: weeklyInput.summary,
      totals: weeklyInput.totals,
      visibilityWinner: {
        title: weeklyInput.posts.find((post) => post.id === weeklyInput.visibilityWinnerId)?.title || "-",
        reason: weeklyInput.posts.find((post) => post.id === weeklyInput.visibilityWinnerId)?.reading || "-"
      },
      audienceQualityWinner: {
        title: weeklyInput.posts.find((post) => post.id === weeklyInput.audienceQualityWinnerId)?.title || "-",
        reason: weeklyInput.posts.find((post) => post.id === weeklyInput.audienceQualityWinnerId)?.reading || "-"
      },
      commercialSignal: weeklyInput.commercialSignal,
      nextDecision: weeklyInput.nextDecision
    },
    topContent,
    formatInsights: insights,
    recommendations,
    socialDistribution,
    calendar: recommendations.map((item, index) => ({
      day: "Setmana " + (index + 1),
      title: item.title,
      format: item.format,
      channel: item.channel,
      owner: "AImetos",
      status: index === 0 ? "ready_to_review" : "draft_needed"
    })),
    technicalStatus: {
      mode: flow.mode,
      dataSource: hasLinkedInMetrics(linkedInPosts) ? "LinkedIn manual: 3 posts històrics + 2 posts setmanals" : "LinkedIn URLs pendents de mètriques",
      credentialsRequiredNow: false,
      n8nWorkflowsValidated: 28
    }
  };
}

export async function runMockContentFlow(overrides: Partial<RuntimeConfig> = {}): Promise<MockFlowReport> {
  const baseConfig = loadConfig();
  const config = { ...baseConfig, ...overrides, connectors: { ...baseConfig.connectors, ...(overrides.connectors || {}) } };
  const runId = "content_flow_" + Date.now();
  const rawMetrics = readJson<MetricRecord[]>("data/fixtures/content-performance.json");
  for (const metric of rawMetrics) {
    const result = validateMetric(metric);
    if (!result.ok) {
      throw new Error("Invalid metric fixture: " + JSON.stringify(result.issues));
    }
  }
  const metrics = applyScenario(rawMetrics, config.mockScenario);
  const analysis = analyzePerformance(metrics, config);
  const generatedIdeas = generateFiveIdeas(analysis, config.mockScenario);
  for (const idea of generatedIdeas) {
    const result = validateIdea(idea);
    if (!result.ok) {
      throw new Error("Invalid generated idea: " + JSON.stringify(result.issues));
    }
  }
  const selectedIdeas = selectBestIdeas(generatedIdeas, config);
  const approvedIdeas = selectedIdeas.slice(0, Math.min(3, selectedIdeas.length)).map((idea) => ({
    ...idea,
    status: "APPROVED" as const
  }));
  const contents = approvedIdeas.map(generateContentForIdea);
  const publications = approvedIdeas.map((idea, index) =>
    publishMock(scheduleContent(idea, contents[index], "2026-07-" + String(14 + index).padStart(2, "0") + "T09:00:00.000Z"), config.mockScenario)
  );
  const connectorHealth = await Promise.all(
    buildConnectorRegistry(config).map(async (connector) => {
      const health = await connector.healthCheck();
      return { name: connector.name, status: health.status, ok: health.ok, message: health.message };
    })
  );
  const auditLog = approvedIdeas.flatMap(() =>
    transitionPath([
      "DRAFT_IDEA",
      "ANALYZED",
      "PRIORITIZED",
      "SELECTED",
      "CONTENT_DRAFTED",
      "IN_REVIEW",
      "APPROVED",
      "FORMATS_GENERATED",
      "SCHEDULED",
      "PUBLISHED",
      "METRICS_PENDING",
      "METRICS_COLLECTED",
      "ARCHIVED"
    ])
  );
  const report: MockFlowReport = {
    runId,
    mode: config.appMode,
    scenario: config.mockScenario,
    analysis,
    generatedIdeas,
    selectedIdeas,
    approvedIdeas,
    contents,
    publications,
    auditLog,
    connectorHealth,
    metricsCollected: publications.every((item) => item.status === "published"),
    report: {
      summary:
        selectedIdeas.length === 0
          ? "No idea passed the configured quality threshold."
          : "Mock flow completed with " + selectedIdeas.length + " selected ideas and " + publications.length + " publication plans.",
      recommendations: selectedIdeas.map((idea) => idea.title)
    }
  };
  return report;
}

export function writeReport(report: MockFlowReport, relPath = "data/exports/latest-report.json"): string {
  const target = rootPath(relPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(report, null, 2) + "\n", "utf8");
  return target;
}
