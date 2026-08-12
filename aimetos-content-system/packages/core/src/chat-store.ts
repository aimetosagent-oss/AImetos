import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { ChatMessage } from "./content-director.ts";

export type ChatConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Required<Pick<ChatMessage, "id" | "role" | "content" | "createdAt">>[];
};

type ChatStoreData = { conversations: ChatConversation[] };

const EMPTY_STORE: ChatStoreData = { conversations: [] };

export class ChatConversationStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private read(): ChatStoreData {
    if (!existsSync(this.filePath)) return structuredClone(EMPTY_STORE);
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as ChatStoreData;
      return { conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [] };
    } catch {
      return structuredClone(EMPTY_STORE);
    }
  }

  private write(data: ChatStoreData): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    writeFileSync(temporary, JSON.stringify(data, null, 2) + "\n", "utf8");
    renameSync(temporary, this.filePath);
  }

  list(): ChatConversation[] {
    return this.read().conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(id: string): ChatConversation | undefined {
    return this.read().conversations.find((conversation) => conversation.id === id);
  }

  create(): ChatConversation {
    const data = this.read();
    const now = new Date().toISOString();
    const conversation: ChatConversation = {
      id: randomUUID(),
      title: "Nova conversa",
      createdAt: now,
      updatedAt: now,
      messages: []
    };
    data.conversations.unshift(conversation);
    data.conversations = data.conversations.slice(0, 30);
    this.write(data);
    return conversation;
  }

  append(id: string, role: "user" | "assistant", content: string): ChatConversation {
    const data = this.read();
    const conversation = data.conversations.find((item) => item.id === id);
    if (!conversation) throw new Error("Conversa no trobada.");
    const now = new Date().toISOString();
    conversation.messages.push({ id: randomUUID(), role, content, createdAt: now });
    conversation.messages = conversation.messages.slice(-40);
    conversation.updatedAt = now;
    if (conversation.title === "Nova conversa" && role === "user") {
      conversation.title = content.length > 48 ? `${content.slice(0, 45)}...` : content;
    }
    this.write(data);
    return conversation;
  }

  delete(id: string): boolean {
    const data = this.read();
    const next = data.conversations.filter((conversation) => conversation.id !== id);
    if (next.length === data.conversations.length) return false;
    data.conversations = next;
    this.write(data);
    return true;
  }
}
