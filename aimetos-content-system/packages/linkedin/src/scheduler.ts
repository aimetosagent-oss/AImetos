import type { LinkedInSyncService } from "./sync.ts";

export function startLinkedInScheduler(service: LinkedInSyncService, intervalMs: number) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await service.syncLinkedIn("scheduler"); }
    finally { running = false; }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  return { tick, stop: () => clearInterval(timer) };
}
