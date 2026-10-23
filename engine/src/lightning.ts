// NWS/FHSAA rule: stay inside until 30 minutes after the last thunder.
export const LIGHTNING_WAIT_MINUTES = 30;

export interface LightningWait {
  remainingMs: number;
  done: boolean;
}

export function lightningWait(lastThunderMs: number, nowMs: number): LightningWait {
  const remainingMs = Math.max(0, lastThunderMs + LIGHTNING_WAIT_MINUTES * 60_000 - nowMs);
  return { remainingMs, done: remainingMs === 0 };
}
