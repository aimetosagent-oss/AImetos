import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { RealContentRecord } from "../../shared/src/domain.ts";
import type { ClientMonthlyReport } from "./pipeline.ts";
import type { EditorialState } from "./editorial-state.ts";
import type { ContentDecision } from "./content-decision-engine.ts";
import {
  OpenAIIntegrationError,
  OpenAIResponsesClient,
  type OpenAIResponsesClientOptions
} from "./openai-client.ts";

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

export type ContentDirectorSection =
  | "scope"
  | "recommendation"
  | "performance"
  | "snapshots"
  | "timing"
  | "commercial"
  | "audience"
  | "editorial_memory"
  | "temporal"
  | "data_quality"
  | "channels"
  | "generation"
  | "learning";

type ContextPost = {
  id: string;
  title: string;
  platform: string;
  family: string;
  funnel: string;
  format: string;
  publishedAt?: string;
  metricsStatus?: string;
  audience?: RealContentRecord["audience"];
  qualitativeSignals?: string[];
  snapshots: RealContentRecord["snapshots"];
};

export type ContentDirectorContext = {
  query: string;
  selectedSections: ContentDirectorSection[];
  scopeAllowed: boolean;
  generatedAt: string;
  languages: { ui: "ca"; content: "es" };
  mode: "debate";
  canonicalState: EditorialState;
  deterministicDecision: ContentDecision;
  recommendation?: {
    title: string;
    reason: string;
    postCopy: string;
    cta: string;
    funnel: string;
    family: string;
    publishTime: string;
    timingLabel: string;
    imagePrompt: string;
    alternatives: Array<{ title: string; family: string; funnel: string }>;
  };
  performance?: {
    confidence: string;
    comparablePosts: number;
    posts: ContextPost[];
    winners: ClientMonthlyReport["realIntelligence"]["winners"];
  };
  timing?: ClientMonthlyReport["realIntelligence"]["timing"] & { recommendationReason: string };
  commercial?: ClientMonthlyReport["realIntelligence"]["commercialSignals"];
  audience?: ClientMonthlyReport["realIntelligence"]["audience"];
  editorial?: {
    recentFamilies: Array<{ contentId: string; family: string; publishedAt?: string }>;
    memory: Array<{ topic: string; editorialFamily: string; status: string }>;
    marketSignals: Array<{ type: string; topic: string; description: string }>;
  };
  temporal?: {
    currentContext?: string;
    date: string;
    calendar: ClientMonthlyReport["calendar"];
  };
  dataQuality?: ClientMonthlyReport["realIntelligence"]["dataQuality"];
  channels?: ClientMonthlyReport["socialDistribution"];
  learning?: {
    executiveReading: string[];
    weeklyComparisons: ClientMonthlyReport["realIntelligence"]["weeklyComparisons"];
  };
};

export type BuildContentDirectorContextInput = {
  query: string;
  history?: ChatMessage[];
  report: ClientMonthlyReport;
  records: RealContentRecord[];
  now?: Date;
};

export interface ChatProvider {
  readonly name: "mock" | "openai";
  reply(messages: ChatMessage[], context: ContentDirectorContext): Promise<string>;
}

export class ChatProviderError extends Error {
  readonly code: "credential_missing" | "timeout" | "unavailable" | "empty_response";

  constructor(
    message: string,
    code: "credential_missing" | "timeout" | "unavailable" | "empty_response"
  ) {
    super(message);
    this.code = code;
  }
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function publishedAt(record: RealContentRecord): string | undefined {
  return record.publishedAtExport || record.publishedAt || record.publishedAtManual;
}

function recentLinkedIn(records: RealContentRecord[], limit: number): RealContentRecord[] {
  return records
    .filter((record) => record.platform === "linkedin" && !record.isBaseline && publishedAt(record))
    .sort((a, b) => publishedAt(b)!.localeCompare(publishedAt(a)!))
    .slice(0, limit);
}

function compactPost(record: RealContentRecord, includeAllSnapshots: boolean): ContextPost {
  const snapshots = includeAllSnapshots ? record.snapshots : record.snapshots.slice(-2);
  return {
    id: record.id,
    title: record.title,
    platform: record.platform,
    family: record.editorialFamily,
    funnel: record.funnelStage,
    format: record.format,
    publishedAt: publishedAt(record),
    metricsStatus: record.metricsStatus,
    audience: record.audience,
    qualitativeSignals: record.qualitativeSignals,
    snapshots
  };
}

function requestedContentIds(query: string): string[] {
  return [...new Set(query.toUpperCase().match(/(?:LI|IG)-\d{2}/g) || [])];
}

function isClearlyOutOfScope(query: string): boolean {
  const normalized = normalize(query);
  const domainTerms = [
    "contingut",
    "contenido",
    "post",
    "linkedin",
    "instagram",
    "meta",
    "facebook",
    "metrica",
    "audiencia",
    "lead",
    "reunio",
    "funnel",
    "tofu",
    "mofu",
    "bofu",
    "cta",
    "public",
    "aimetos",
    "estrateg",
    "horari",
    "hora",
    "vacan",
    "agent",
    "automatitz"
  ];
  if (includesAny(normalized, domainTerms)) return false;
  return includesAny(normalized, ["temps fara", "meteorologia", "recepta", "futbol", "programa en", "codi python", "diagnostic medic"]);
}

function addSection(sections: ContentDirectorSection[], section: ContentDirectorSection): void {
  if (!sections.includes(section)) sections.push(section);
}

export function buildContentDirectorContext({
  query,
  history = [],
  report,
  records,
  now = new Date()
}: BuildContentDirectorContextInput): ContentDirectorContext {
  const normalized = normalize(query);
  const recentHistory = normalize(history.slice(-4).map((message) => message.content).join(" "));
  const contextualQuery = `${recentHistory} ${normalized}`.trim();
  const sections: ContentDirectorSection[] = [];
  const scopeAllowed = !isClearlyOutOfScope(query);

  if (!scopeAllowed) addSection(sections, "scope");
  const wantsRecommendation = includesAny(contextualQuery, ["que public", "publicaries", "demà", "dema", "recoman", "quina idea", "quin repet"]);
  const wantsComparison = includesAny(contextualQuery, ["compar", "evoluc", "ultims posts", "últims posts", "rendiment", "ha funcionat", "millor post"]);
  const wantsSnapshot =
    requestedContentIds(contextualQuery).length > 0 ||
    includesAny(contextualQuery, ["snapshot", "24h", "72h", "7d", "30d", "post d'ahir", "post de ayer"]);
  const wantsTiming = includesAny(contextualQuery, ["hora", "horari", "franja", "quan publicar"]);
  const wantsCommercial = includesAny(contextualQuery, ["comercial", "lead", "reunio", "oportunitat", "negoci", "conversio"]);
  const wantsFunnel = includesAny(contextualQuery, ["funnel", "tofu", "mofu", "bofu"]);
  const wantsAudience = includesAny(contextualQuery, ["audiencia", "decisor", "carrec", "sector", "empresa", "ubicacio"]);
  const wantsEditorial = wantsRecommendation || includesAny(contextualQuery, ["repet", "famil", "satur", "agent", "varietat", "angle"]);
  const wantsTemporal = wantsRecommendation || includesAny(contextualQuery, ["temporal", "vacan", "agost", "nadal", "sant joan", "setmana santa", "aquesta setmana"]);
  const wantsDataQuality = includesAny(contextualQuery, ["dades falten", "dada falta", "pendent", "conflict", "fiabil", "confiança", "mostra"]);
  const wantsGeneration = includesAny(normalized, ["genera", "escriu", "text final", "adapta", "hashtag", "hook", "cta", "prompt d'imatge", "carrusel"]);
  const wantsChannels = wantsGeneration || includesAny(contextualQuery, ["meta", "instagram", "facebook", "canal"]);
  const wantsLearning = includesAny(contextualQuery, [
    "aprenent",
    "apres",
    "últimes 4",
    "ultimes 4",
    "patro",
    "conclusio",
    "comentari"
  ]);

  if (wantsRecommendation || wantsGeneration || sections.length === 0) addSection(sections, "recommendation");
  if (wantsComparison || wantsSnapshot || wantsLearning || (wantsFunnel && requestedContentIds(contextualQuery).length > 0)) {
    addSection(sections, "performance");
  }
  if (wantsSnapshot) addSection(sections, "snapshots");
  if (wantsTiming) addSection(sections, "timing");
  if (wantsCommercial) addSection(sections, "commercial");
  if (wantsAudience || wantsCommercial) addSection(sections, "audience");
  if (wantsEditorial || wantsLearning) addSection(sections, "editorial_memory");
  if (wantsTemporal) addSection(sections, "temporal");
  if (wantsDataQuality || wantsSnapshot) addSection(sections, "data_quality");
  if (wantsChannels) addSection(sections, "channels");
  if (wantsGeneration) addSection(sections, "generation");
  if (wantsLearning) addSection(sections, "learning");

  const context: ContentDirectorContext = {
    query,
    selectedSections: sections,
    scopeAllowed,
    generatedAt: now.toISOString(),
    languages: { ui: "ca", content: "es" },
    mode: "debate",
    canonicalState: report.editorialState,
    deterministicDecision: report.contentDecision
  };

  if (sections.includes("recommendation") || sections.includes("generation")) {
    const recommendation = report.recommendations[0];
    if (recommendation) {
      context.recommendation = {
        title: recommendation.title,
        reason: recommendation.whyRecommended,
        postCopy: recommendation.postCopy,
        cta: recommendation.cta,
        funnel: recommendation.funnelStage,
        family: recommendation.editorialFamily,
        publishTime: recommendation.bestPublishTime,
        timingLabel: recommendation.publishTimeLabel,
        imagePrompt: recommendation.imagePrompt,
        alternatives: report.recommendations.slice(1, 3).map((item) => ({
          title: item.title,
          family: item.editorialFamily,
          funnel: item.funnelStage
        }))
      };
    }
  }

  if (sections.includes("performance") || sections.includes("snapshots")) {
    const ids = requestedContentIds(`${history.slice(-4).map((message) => message.content).join(" ")} ${query}`);
    const selectedRecords = ids.length > 0
      ? records.filter((record) => ids.includes(record.id))
      : recentLinkedIn(records, wantsComparison ? 4 : 1);
    context.performance = {
      confidence: report.realIntelligence.confidence.label,
      comparablePosts: report.realIntelligence.confidence.comparablePosts,
      posts: selectedRecords.map((record) => compactPost(record, sections.includes("snapshots"))),
      winners: report.realIntelligence.winners
    };
  }

  if (sections.includes("timing")) {
    context.timing = {
      ...report.realIntelligence.timing,
      recommendationReason: report.decision.timing_reason
    };
  }
  if (sections.includes("commercial")) context.commercial = report.realIntelligence.commercialSignals;
  if (sections.includes("audience")) context.audience = report.realIntelligence.audience;
  if (sections.includes("editorial_memory")) {
    context.editorial = {
      recentFamilies: recentLinkedIn(records, 5).map((record) => ({
        contentId: record.id,
        family: record.editorialFamily,
        publishedAt: publishedAt(record)
      })),
      memory: report.realIntelligence.editorialMemory.slice(-8).map((item) => ({
        topic: item.topic,
        editorialFamily: item.editorialFamily,
        status: item.status
      })),
      marketSignals: report.realIntelligence.marketSignals.slice(0, 6).map((signal) => ({
        type: signal.signalType,
        topic: signal.affectedTopic,
        description: signal.description
      }))
    };
  }
  if (sections.includes("temporal")) {
    context.temporal = {
      currentContext: report.decision.temporalContext,
      date: now.toISOString().slice(0, 10),
      calendar: report.calendar.slice(0, 4)
    };
  }
  if (sections.includes("data_quality")) context.dataQuality = report.realIntelligence.dataQuality;
  if (sections.includes("channels")) context.channels = report.socialDistribution.slice(0, 4);
  if (sections.includes("learning")) {
    context.learning = {
      executiveReading: report.executiveReading,
      weeklyComparisons: report.realIntelligence.weeklyComparisons
    };
  }

  return context;
}

function first24h(post: ContextPost): RealContentRecord["snapshots"][number] | undefined {
  return post.snapshots.find((snapshot) => snapshot.period === "24h");
}

function postReference(post: ContextPost): string {
  const date = post.publishedAt?.slice(0, 10).split("-");
  const formattedDate = date?.length === 3 ? `${date[2]}/${date[1]}/${date[0]}` : "Sense data";
  const shortTitle = post.title.length > 58 ? `${post.title.slice(0, 55)}...` : post.title;
  return `${formattedDate} · “${shortTitle}” (${post.id})`;
}

function chatVariableLabel(value: string): string {
  const labels: Record<string, string> = {
    topic: "el tema",
    hook: "el hook",
    visual: "el visual",
    time: "l'hora",
    day: "el dia",
    format: "el format",
    length: "la longitud",
    cta: "la CTA"
  };
  return labels[value] || value.replaceAll("_", " ");
}

function chatConfidenceLabel(value: string): string {
  const labels: Record<string, string> = {
    insufficient_data: "dades insuficients",
    early_signal: "senyal inicial",
    developing_pattern: "patró en desenvolupament",
    moderate_evidence: "evidència moderada",
    strong_pattern: "patró fort",
    validated_pattern: "patró validat"
  };
  return labels[value] || value.replaceAll("_", " ");
}

function cadenceLabel(value: number): string {
  if (value === 0) return "cap publicació aquesta setmana";
  if (value === 1) return "una publicació aquesta setmana";
  return `${value} publicacions aquesta setmana`;
}

function mockComparison(context: ContentDirectorContext): string {
  const posts = context.performance?.posts || [];
  const comparable = posts
    .map((post) => ({ post, snapshot: first24h(post) }))
    .filter((item) => item.snapshot && typeof item.snapshot.impressions === "number");
  if (comparable.length < 2) {
    return "Encara no puc fer una comparació temporal homogènia. Falten almenys dos snapshots del mateix moment, per exemple a 24 h. No barrejaria una captura a 24 h amb un resultat final.";
  }
  const visibility = [...comparable].sort((a, b) => (b.snapshot!.impressions || 0) - (a.snapshot!.impressions || 0))[0];
  const conversation = [...comparable].sort((a, b) => (b.snapshot!.comments || 0) - (a.snapshot!.comments || 0))[0];
  return `Conclusió: ${postReference(visibility.post)} lidera visibilitat inicial amb ${visibility.snapshot!.impressions} impressions a 24 h. ${postReference(conversation.post)} lidera conversa amb ${conversation.snapshot!.comments || 0} comentaris a 24 h. No repetiria automàticament el de més impressions: l'elecció depèn de si busquem abast o autoritat i conversa. Amb aquesta mostra és un senyal inicial, no un patró validat.`;
}

export class MockChatProvider implements ChatProvider {
  readonly name = "mock" as const;

  async reply(messages: ChatMessage[], context: ContentDirectorContext): Promise<string> {
    const question = normalize(messages.at(-1)?.content || "");
    if (!context.scopeAllowed) {
      return "Aquest Director està especialitzat en contingut, dades i estratègia digital d’AImetos. Puc ajudar-te amb publicacions, mètriques, audiència, funnel, temporalitat o decisions editorials.";
    }
    if (includesAny(question, ["no seria millor", "que et sembla aquesta idea", "et proposo"])) {
      if (question.includes("trucada") && question.includes("email")) {
        return "Sí, aquest angle és més concret i més humà que una publicació genèrica sobre IA. Parteix d'una fricció recognoscible: dues persones entren en una trucada sense context perquè la persona responsable no ha deixat clar què cal resoldre.\n\nLa tesi de negoci seria: no cal posar IA a tot arreu; sovint un procés mínim ben dissenyat evita més pèrdua de temps que una automatització sofisticada.\n\nHo convertiria en una peça amb aquest títol: “No necesitas IA en todas partes. A veces necesitas dejar contexto antes de irte.” Mantindria un exemple breu de la trucada, explicaria que un correu estructurat hauria estat suficient i tancaria amb una CTA suau sobre detectar si un problema necessita IA, automatització o simplement criteri operatiu.";
      }
      return "Sí, val la pena valorar aquesta alternativa. Per decidir si substitueix la recomanació actual compararia tres coses: concreció del problema, rellevància per al decisor i diferència respecte de les últimes publicacions. En mode local puc aplicar aquests criteris, però una conversa semàntica oberta requereix activar el proveïdor OpenAI.";
    }
    if (context.selectedSections.includes("generation") && context.recommendation) {
      if (question.includes("meta")) {
        const meta = context.channels?.find((item) => item.channel === "meta");
        return `Adaptació per a Meta, en castellà:\n\n${meta?.adaptation || context.recommendation.postCopy}\n\nCTA: ${context.recommendation.cta}`;
      }
      return `Text final per a LinkedIn, en castellà:\n\n${context.recommendation.postCopy}\n\nCTA: ${context.recommendation.cta}`;
    }
    if (includesAny(question, ["funnel", "tofu", "mofu", "bofu"])) {
      const post = context.performance?.posts[0];
      const funnel = post?.funnel || context.recommendation?.funnel;
      const title = post ? postReference(post) : `la idea “${context.recommendation?.title}”`;
      return `${title} és ${funnel || "pendent de classificar"}. El criteri és l'objectiu: TOFU identifica el problema, MOFU ajuda a decidir o diagnosticar i BOFU aporta prova o una proposta comercial concreta.`;
    }
    if (question.includes("repet") && context.performance?.posts.length) {
      const conversationPost = [...context.performance.posts]
        .map((post) => ({ post, comments: first24h(post)?.comments || 0 }))
        .sort((a, b) => b.comments - a.comments)[0];
      const visibilityPost = [...context.performance.posts]
        .map((post) => ({ post, impressions: first24h(post)?.impressions || 0 }))
        .sort((a, b) => b.impressions - a.impressions)[0];
      return `Repetiria el principi de ${postReference(conversationPost.post)}, no el text literal: ha generat la millor conversa inicial dels posts comparats. Mantindria el problema i el criteri humà, però canviaria l'exemple per evitar fatiga editorial. Si l'objectiu fos només abast, triaria l'aprenentatge de ${postReference(visibilityPost.post)}; per autoritat i conversa, em quedo amb ${postReference(conversationPost.post)}.`;
    }
    if (context.selectedSections.includes("snapshots") || context.selectedSections.includes("performance")) {
      return mockComparison(context);
    }
    if (includesAny(question, ["hora", "horari", "franja", "quan publicar"]) && context.timing) {
      return `Mantindria l'hora actual. Confiança horària: ${chatConfidenceLabel(context.timing.timing_confidence)}. ${context.timing.recommendationReason}`;
    }
    if (context.selectedSections.includes("commercial") && context.commercial) {
      return `El senyal comercial encara és inicial: ${context.commercial.leads} leads i ${context.commercial.meetings} reunions confirmades. Les ${context.commercial.probableAttributedConnections} invitacions atribuïdes probablement indiquen interès, però no són leads. Acció: continuar mesurant visites al perfil, converses i reunions abans d'afirmar retorn comercial.`;
    }
    if (context.selectedSections.includes("data_quality") && context.dataQuality) {
      return `Abans d'una conclusió forta falten mètriques de ${context.dataQuality.pendingContentIds.join(", ") || "cap publicació"}. També hi ha ${context.dataQuality.conflicts.length} conflicte(s) de dades. Compararia només snapshots equivalents i mantindria la confiança com a senyal inicial.`;
    }
    if (context.selectedSections.includes("learning") && context.learning) {
      return `Aprenentatge principal: ${context.learning.executiveReading.slice(0, 2).join(" ")} Encara no hi ha prou mostra per validar causalitat. Mantindria ${cadenceLabel(context.deterministicDecision.weekly_cadence)} i canviaria una sola variable cada vegada.`;
    }
    if (context.recommendation) {
      const decision = context.deterministicDecision;
      return `Publicaria “${decision.hook}”.\n\nPer què: ${decision.reason_to_publish}\n\nQuè estem provant: ${chatVariableLabel(decision.experiment.primary_variable)}. Hipòtesi: ${decision.experiment.hypothesis}\n\nQuè sabem: Project Management va madurar de 110 a 267 impressions i la propagació continua limitada. Què no sabem: la millor hora, el millor format i el millor estil visual encara no estan validats.\n\nConfiança: contingut amb ${chatConfidenceLabel(decision.confidence.content)}; horari amb ${chatConfidenceLabel(decision.confidence.timing)}. Mantindria ${decision.recommended_time} com a hora de referència, no com a hora guanyadora, i mesuraria a 24 h, 72 h i 7 dies.`;
    }
    return "No hi ha prou context seleccionat per donar una resposta fiable. Formula la consulta sobre una publicació, mètrica, idea, canal o període concret.";
  }
}

export type OpenAIChatProviderOptions = OpenAIResponsesClientOptions & {
  client?: OpenAIResponsesClient;
};

export class OpenAIChatProvider implements ChatProvider {
  readonly name = "openai" as const;
  readonly instructions: string;
  private readonly client: OpenAIResponsesClient;

  constructor(
    instructions: string,
    options: OpenAIChatProviderOptions = {}
  ) {
    this.instructions = instructions;
    this.client = options.client || new OpenAIResponsesClient(options);
  }

  async reply(messages: ChatMessage[], context: ContentDirectorContext): Promise<string> {
    try {
      return await this.client.requestText({
        kind: "chat",
        instructions: `${this.instructions}\n\nCONTEXT DEL DASHBOARD SELECCIONAT:\n${JSON.stringify(context)}`,
        input: messages.slice(-12).map((message) => ({ role: message.role, content: message.content })),
        maxOutputTokens: 900
      });
    } catch (error) {
      if (error instanceof OpenAIIntegrationError) {
        const messagesByCode = {
          credential_missing: "Xat preparat. Falta configurar la credencial d’OpenAI.",
          timeout: "El Director ha trigat massa. Torna-ho a provar.",
          unavailable: "El Director no està disponible ara mateix. El dashboard continua funcionant.",
          empty_response: "El Director no ha retornat cap resposta.",
          invalid_response: "El Director ha retornat una resposta invàlida."
        } as const;
        const code = error.code === "invalid_response" ? "unavailable" : error.code;
        throw new ChatProviderError(messagesByCode[error.code], code);
      }
      throw new ChatProviderError("El Director no està disponible ara mateix. El dashboard continua funcionant.", "unavailable");
    }
  }
}

export async function replySafely(
  provider: ChatProvider,
  messages: ChatMessage[],
  context: ContentDirectorContext
): Promise<{ reply: string; providerFailed: boolean; errorCode?: ChatProviderError["code"] }> {
  try {
    const reply = await provider.reply(messages, context);
    return { reply, providerFailed: false };
  } catch (error) {
    if (error instanceof ChatProviderError) {
      return { reply: error.message, providerFailed: true, errorCode: error.code };
    }
    return {
      reply: "El Director no està disponible ara mateix. El dashboard continua funcionant.",
      providerFailed: true,
      errorCode: "unavailable"
    };
  }
}

export function loadContentDirectorInstructions(): string {
  return readFileSync(fileURLToPath(new URL("../../../prompts/content-director.md", import.meta.url)), "utf8");
}

export function createChatProvider(
  provider: "mock" | "openai",
  options: OpenAIChatProviderOptions = {}
): ChatProvider {
  const instructions = loadContentDirectorInstructions();
  return provider === "openai" ? new OpenAIChatProvider(instructions, options) : new MockChatProvider();
}
