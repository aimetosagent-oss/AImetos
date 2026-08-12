import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { RealContentRecord } from "../../shared/src/domain.ts";
import type { ClientMonthlyReport } from "./pipeline.ts";

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

type OpenAIResponsePayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
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
    languages: { ui: "ca", content: "es" }
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
  return `Conclusió: ${visibility.post.id} lidera visibilitat inicial amb ${visibility.snapshot!.impressions} impressions a 24 h. ${conversation.post.id} lidera conversa amb ${conversation.snapshot!.comments || 0} comentaris a 24 h. No repetiria automàticament el de més impressions: l'elecció depèn de si busquem abast o autoritat i conversa. Amb aquesta mostra és un senyal inicial, no un patró validat.`;
}

export class MockChatProvider implements ChatProvider {
  readonly name = "mock" as const;

  async reply(messages: ChatMessage[], context: ContentDirectorContext): Promise<string> {
    const question = normalize(messages.at(-1)?.content || "");
    if (!context.scopeAllowed) {
      return "Aquest Director està especialitzat en contingut, dades i estratègia digital d’AImetos. Puc ajudar-te amb publicacions, mètriques, audiència, funnel, temporalitat o decisions editorials.";
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
      const title = post ? `${post.id} (“${post.title}”)` : `la idea “${context.recommendation?.title}”`;
      return `${title} és ${funnel || "pendent de classificar"}. El criteri és l'objectiu: TOFU identifica el problema, MOFU ajuda a decidir o diagnosticar i BOFU aporta prova o una proposta comercial concreta.`;
    }
    if (question.includes("repet") && context.performance?.posts.length) {
      const conversationPost = [...context.performance.posts]
        .map((post) => ({ post, comments: first24h(post)?.comments || 0 }))
        .sort((a, b) => b.comments - a.comments)[0];
      return `Repetiria el principi de ${conversationPost.post.id}, no el text literal: ha generat la millor conversa inicial dels posts comparats. Mantindria el problema i el criteri humà, però canviaria l'exemple per evitar fatiga editorial. Si l'objectiu fos només abast, triaria l'aprenentatge de LI-01; per autoritat i conversa, em quedo amb ${conversationPost.post.id}.`;
    }
    if (context.selectedSections.includes("snapshots") || context.selectedSections.includes("performance")) {
      return mockComparison(context);
    }
    if (context.selectedSections.includes("timing") && context.timing) {
      return `Mantindria l'hora actual. Confiança horària: ${context.timing.timing_confidence}. ${context.timing.recommendationReason}`;
    }
    if (context.selectedSections.includes("commercial") && context.commercial) {
      return `El senyal comercial encara és inicial: ${context.commercial.leads} leads i ${context.commercial.meetings} reunions confirmades. Les ${context.commercial.probableAttributedConnections} invitacions atribuïdes probablement indiquen interès, però no són leads. Acció: continuar mesurant visites al perfil, converses i reunions abans d'afirmar retorn comercial.`;
    }
    if (context.selectedSections.includes("data_quality") && context.dataQuality) {
      return `Abans d'una conclusió forta falten mètriques de ${context.dataQuality.pendingContentIds.join(", ") || "cap publicació"}. També hi ha ${context.dataQuality.conflicts.length} conflicte(s) de dades. Compararia només snapshots equivalents i mantindria la confiança com a senyal inicial.`;
    }
    if (context.selectedSections.includes("learning") && context.learning) {
      return `Aprenentatge principal: ${context.learning.executiveReading.slice(0, 2).join(" ")} Encara no hi ha prou mostra per validar causalitat. Mantindria dues peces setmanals i canviaria una sola variable cada vegada.`;
    }
    if (context.recommendation) {
      return `Publicaria “${context.recommendation.title}”.\n\nPer què: ${context.recommendation.reason}\n\nDades: confiança editorial limitada i varietat respecte a les famílies recents.\n\nAcció: ${context.recommendation.timingLabel.toLowerCase()}, ${context.recommendation.publishTime}; mesurar a 24 h, 72 h i 7 dies.`;
    }
    return "No hi ha prou context seleccionat per donar una resposta fiable. Formula la consulta sobre una publicació, mètrica, idea, canal o període concret.";
  }
}

export type OpenAIChatProviderOptions = {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export class OpenAIChatProvider implements ChatProvider {
  readonly name = "openai" as const;
  readonly instructions: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(
    instructions: string,
    options: OpenAIChatProviderOptions = {}
  ) {
    this.instructions = instructions;
    this.apiKey = options.apiKey;
    this.model = options.model || "gpt-5-mini";
    this.timeoutMs = options.timeoutMs || 20_000;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async reply(messages: ChatMessage[], context: ContentDirectorContext): Promise<string> {
    if (!this.apiKey) {
      throw new ChatProviderError("Xat preparat. Falta configurar la credencial d’OpenAI.", "credential_missing");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          store: false,
          max_output_tokens: 900,
          instructions: `${this.instructions}\n\nCONTEXT DEL DASHBOARD SELECCIONAT:\n${JSON.stringify(context)}`,
          input: messages.slice(-12).map((message) => ({ role: message.role, content: message.content }))
        }),
        signal: controller.signal
      });
      const payload = (await response.json()) as OpenAIResponsePayload;
      if (!response.ok) {
        throw new ChatProviderError(payload.error?.message || "OpenAI no està disponible ara mateix.", "unavailable");
      }
      const reply = payload.output_text || payload.output
        ?.flatMap((item) => item.content || [])
        .find((item) => item.type === "output_text")?.text;
      if (!reply?.trim()) throw new ChatProviderError("El Director no ha retornat cap resposta.", "empty_response");
      return reply.trim();
    } catch (error) {
      if (error instanceof ChatProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ChatProviderError("El Director ha trigat massa. Torna-ho a provar.", "timeout");
      }
      throw new ChatProviderError("El Director no està disponible ara mateix. El dashboard continua funcionant.", "unavailable");
    } finally {
      clearTimeout(timeout);
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
