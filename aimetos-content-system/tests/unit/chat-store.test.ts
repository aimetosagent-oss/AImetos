import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ChatConversationStore } from "../../packages/core/src/chat-store.ts";

test("conversation store supports create, continue, list and delete", () => {
  const directory = mkdtempSync(join(tmpdir(), "aimetos-chat-"));
  try {
    const file = join(directory, "conversations.json");
    const store = new ChatConversationStore(file);
    const created = store.create();
    store.append(created.id, "user", "Compara els últims posts.");
    store.append(created.id, "assistant", "LI-01 lidera visibilitat.");

    const reloaded = new ChatConversationStore(file).get(created.id);
    assert.equal(reloaded?.messages.length, 2);
    assert.equal(reloaded?.title, "Compara els últims posts.");
    assert.equal(store.list()[0]?.id, created.id);
    assert.equal(store.delete(created.id), true);
    assert.equal(store.get(created.id), undefined);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
