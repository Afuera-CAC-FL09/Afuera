import { DurableObject } from "cloudflare:workers";

export interface Limits {
  perIpPerMinute: number;
  perIpPerDay: number;
  dailyBudgetUsd: number;
}

export type Admission = "ok" | "rate_limited" | "budget";

/** Counters for one UTC day. Pure so it can be tested without Cloudflare. */
export class LimiterState {
  day = "";
  spentUsd = 0;
  private minute = new Map<string, number[]>();
  private daily = new Map<string, number>();

  constructor(private limits: Limits) {}

  admit(ip: string, now: number): Admission {
    this.rollDay(now);
    if (this.spentUsd >= this.limits.dailyBudgetUsd) return "budget";

    const recent = (this.minute.get(ip) ?? []).filter((t) => now - t < 60_000);
    const today = this.daily.get(ip) ?? 0;
    if (recent.length >= this.limits.perIpPerMinute || today >= this.limits.perIpPerDay) return "rate_limited";

    recent.push(now);
    this.minute.set(ip, recent);
    this.daily.set(ip, today + 1);
    return "ok";
  }

  /** Picks up the day's spend saved before a restart. */
  restore(spentUsd: number, now: number) {
    this.rollDay(now);
    this.spentUsd = spentUsd;
  }

  charge(usd: number, now: number) {
    this.rollDay(now);
    this.spentUsd += usd;
  }

  private rollDay(now: number) {
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== this.day) {
      this.day = day;
      this.spentUsd = 0;
      this.minute.clear();
      this.daily.clear();
    }
  }
}

// One global instance. Spend is saved so a restart can't reset the budget.
export class Limiter extends DurableObject<{ PER_IP_PER_MINUTE: string; PER_IP_PER_DAY: string; DAILY_BUDGET_USD: string }> {
  private state: LimiterState;
  private loaded = false;

  constructor(ctx: DurableObjectState, env: Limiter["env"]) {
    super(ctx, env);
    this.state = new LimiterState({
      perIpPerMinute: Number(env.PER_IP_PER_MINUTE),
      perIpPerDay: Number(env.PER_IP_PER_DAY),
      dailyBudgetUsd: Number(env.DAILY_BUDGET_USD),
    });
  }

  private async load(now: number) {
    if (this.loaded) return;
    const day = new Date(now).toISOString().slice(0, 10);
    this.state.restore((await this.ctx.storage.get<number>(`spend:${day}`)) ?? 0, now);
    this.loaded = true;
  }

  async admit(ip: string): Promise<Admission> {
    const now = Date.now();
    await this.load(now);
    return this.state.admit(ip, now);
  }

  async charge(usd: number): Promise<number> {
    const now = Date.now();
    await this.load(now);
    this.state.charge(usd, now);
    await this.ctx.storage.put(`spend:${this.state.day}`, this.state.spentUsd);
    return this.state.spentUsd;
  }
}
