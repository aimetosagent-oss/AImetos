import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../packages/config/src/env.ts";
import { buildConnectorRegistry } from "../../packages/connectors/src/registry.ts";

test("uses mock connectors when integrations are disabled", async () => {
  const connectors = buildConnectorRegistry(loadConfig());
  assert.ok(connectors.length >= 20);
  const health = await connectors[0].healthCheck();
  assert.equal(health.status, "disabled");
});
