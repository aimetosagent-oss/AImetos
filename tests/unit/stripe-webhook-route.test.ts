import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructStripeWebhookEvent: vi.fn(),
  processStripeEvent: vi.fn(),
  log: vi.fn(),
}));

vi.mock("@/modules/integrations/stripe", () => ({
  constructStripeWebhookEvent: mocks.constructStripeWebhookEvent,
  processStripeEvent: mocks.processStripeEvent,
}));

vi.mock("@/lib/logger", () => ({ log: mocks.log }));

import { POST } from "@/app/api/webhooks/stripe/route";

describe("Stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acknowledges an unowned handled event with 2xx so Stripe does not retry it", async () => {
    const event = { id: "evt_unowned", type: "payment_intent.succeeded" };
    mocks.constructStripeWebhookEvent.mockReturnValue(event);
    mocks.processStripeEvent.mockResolvedValue({
      eventId: event.id,
      status: "IGNORED",
      reason: "unowned_handled_event",
      duplicate: false,
      persisted: false,
    });
    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=signature" },
      body: "raw-body",
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      status: "IGNORED",
      reason: "unowned_handled_event",
      persisted: false,
    });
    expect(mocks.constructStripeWebhookEvent).toHaveBeenCalledWith("raw-body", "t=1,v1=signature");
  });
});
