export function retryDelayMs(attempt: number) {
  const boundedAttempt = Math.max(1, Math.min(attempt, 10));
  return Math.min(60 * 60 * 1000, 2 ** (boundedAttempt - 1) * 30_000);
}

export function nextRetryAt(attempt: number, now = new Date()) {
  return new Date(now.getTime() + retryDelayMs(attempt));
}
