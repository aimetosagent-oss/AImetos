export type ContentDirectorContext = {
  recommendedIdea: string;
  recommendationReason: string;
  confidence: string;
  comparablePosts: number;
  temporalContext?: string;
  executiveReading: string[];
  commercialSignals: {
    leads: number;
    meetings: number;
    probableAttributedConnections: number;
  };
  dataConflicts: Array<{ contentId: string; note: string }>;
  pendingContentIds: string[];
  snapshotInventory: Array<{ contentId: string; count: number; latestLabel: string }>;
  marketSignals: string[];
  editorialMemory: string[];
  candidateIdeas: Array<{ title: string; family: string; recommended: boolean }>;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export interface ChatProvider {
  readonly name: "mock" | "openai";
  reply(messages: ChatMessage[], context: ContentDirectorContext): Promise<string>;
}

export class MockChatProvider implements ChatProvider {
  readonly name = "mock" as const;

  async reply(messages: ChatMessage[], context: ContentDirectorContext): Promise<string> {
    const question = messages.at(-1)?.content.toLowerCase() || "";
    if (question.includes("per què") || question.includes("recoman")) {
      return `${context.recommendedIdea}\n\n${context.recommendationReason} Confiança: ${context.confidence}, amb ${context.comparablePosts} publicacions comparables.`;
    }
    if (question.includes("temporal") || question.includes("agost") || question.includes("vacan")) {
      return context.temporalContext
        ? `${context.temporalContext}. És un bonus de prioritat limitat, no una obligació de publicar. La idea caduca quan acaba el període útil.`
        : "Ara no hi ha cap context temporal prou rellevant per modificar la prioritat editorial.";
    }
    if (question.includes("lead") || question.includes("negoci") || question.includes("comercial")) {
      return `Hi ha ${context.commercialSignals.leads} leads i ${context.commercialSignals.meetings} reunions confirmades. Les ${context.commercialSignals.probableAttributedConnections} connexions atribuïdes probablement són un senyal, però no compten com a leads.`;
    }
    if (question.includes("dada") || question.includes("conflicte") || question.includes("pendent")) {
      const conflicts = context.dataConflicts.map((item) => `${item.contentId}: ${item.note}`).join(" ") || "No hi ha conflictes registrats.";
      const snapshotCount = context.snapshotInventory.reduce((total, item) => total + item.count, 0);
      return `${conflicts} Mètriques pendents: ${context.pendingContentIds.join(", ") || "cap"}. Hi ha ${snapshotCount} snapshots conservats.`;
    }
    if (question.includes("blog") || question.includes("article")) {
      return "El blog és opcional. Només convé ampliar una idea si és evergreen, aporta profunditat real, té rellevància comercial i no duplica el post social.";
    }
    return `La decisió actual és: ${context.recommendedIdea}. ${context.executiveReading.slice(0, 2).join(" ")} Pots preguntar-me per la recomanació, les dades, el negoci, la temporalitat o el blog.`;
  }
}

export class OpenAIChatProvider implements ChatProvider {
  readonly name = "openai" as const;
  readonly instructions: string;

  constructor(instructions: string) {
    this.instructions = instructions;
  }

  async reply(): Promise<string> {
    throw new Error("OpenAIChatProvider està preparat però desactivat. No s'ha configurat cap API key ni cap crida externa.");
  }
}

export function loadContentDirectorInstructions(): string {
  return readFileSync(fileURLToPath(new URL("../../../prompts/content-director.md", import.meta.url)), "utf8");
}

export function createChatProvider(provider: "mock" | "openai"): ChatProvider {
  const instructions = loadContentDirectorInstructions();
  return provider === "openai" ? new OpenAIChatProvider(instructions) : new MockChatProvider();
}
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
