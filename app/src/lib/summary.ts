import type { ActivityId, HourRisk } from "@afuera/engine";

// Only leaves the phone through the share sheet. No names, nothing sent to a server.
export interface SessionSummary {
  /** Forecast clock (the demo day's clock in demo mode). */
  start: Date;
  end: Date;
  minutes: number;
  activity: ActivityId;
  place: string;
  highest: HourRisk;
  breaksDue: number;
  breaksLogged: number;
  /** Started inside the lower-risk window the coach sent from the share card. */
  moved: boolean;
  cancelled: boolean;
}

/** A Live session counts as moved if it starts within 30 minutes of the window that was sent. */
export function startedInMovedWindow(movedTo: { start: string; end: string } | null, start: Date): boolean {
  if (!movedTo) return false;
  const from = Date.parse(movedTo.start) - 30 * 60_000;
  const to = Date.parse(movedTo.end);
  return start.getTime() >= from && start.getTime() < to;
}
