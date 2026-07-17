import { afterEach, describe, expect, it, vi } from "vitest";
import { getDemoData } from "./demo-data";
import { getControlCenterData, sanitizeForDemo } from "./data";

afterEach(() => vi.unstubAllEnvs());

describe("demo sanitization", () => {
  it("removes operational project and workflow names", () => {
    const live = getDemoData();
    const demo = sanitizeForDemo(live);
    expect(demo.projects.projects[0].name).toBe("Projecte A");
    expect(demo.agents[0].name).toBe("Agent outbound");
    expect(demo.agents[0].url).toBeUndefined();
    expect(demo.incidents[0].title).toBe("Un agent necessita revisió");
    expect(demo.incidents.every((incident) => incident.href === "/demo")).toBe(true);
  });

  it("does not mix sample metrics into the private view when sources fail", async () => {
    vi.stubEnv("ALLOW_DEMO_FALLBACK", "false");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "");
    vi.stubEnv("N8N_BASE_URL", "");
    vi.stubEnv("N8N_API_KEY", "");
    vi.stubEnv("CLOCKIFY_API_KEY", "");
    vi.stubEnv("CLOCKIFY_WORKSPACE_ID", "");
    vi.stubEnv("CLOCKIFY_USER_ID", "");

    const data = await getControlCenterData();

    expect(data.mode).toBe("partial");
    expect(data.leads.total).toBe(0);
    expect(data.projects.active).toBe(0);
    expect(data.projects.hours31Days).toBeNull();
    expect(data.finance.cashReal).toBeNull();
    expect(data.agents).toEqual([]);
  });
});
