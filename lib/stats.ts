import type { CallActivity, Deal, Profile } from "@/lib/types";

export const answeredOutcomes = new Set([
  "answered",
  "demo_promised",
  "demo_sent",
  "call_later",
  "follow_up_done",
  "closed_won",
  "closed_lost"
]);

export type CallerStats = {
  profile: Profile;
  calls: number;
  answered: number;
  demosPromised: number;
  demosSent: number;
  followUpsCompleted: number;
  closedDeals: number;
  revenueCents: number;
  paidRevenueCents: number;
  unpaidRevenueCents: number;
  averageDealCents: number;
  answerRate: number;
  demoRate: number;
  closeRate: number;
  revenuePerCallCents: number;
  demoToCloseRate: number;
};

export function safePercent(numerator: number, denominator: number) {
  if (!denominator || !Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function buildCallerStats(
  profiles: Profile[],
  activities: CallActivity[],
  deals: Deal[]
): CallerStats[] {
  return profiles.map((profile) => {
    const callerActivities = activities.filter((activity) => activity.user_id === profile.id);
    const callerDeals = deals.filter((deal) => deal.closed_by === profile.id);
    const calls = callerActivities.length;
    const answered = callerActivities.filter((activity) => answeredOutcomes.has(activity.outcome)).length;
    const demosPromised = callerActivities.filter((activity) => activity.outcome === "demo_promised").length;
    const demosSent = callerActivities.filter((activity) => activity.outcome === "demo_sent").length;
    const followUpsCompleted = callerActivities.filter(
      (activity) => activity.outcome === "follow_up_done"
    ).length;
    const revenueCents = callerDeals.reduce((sum, deal) => sum + safeNumber(deal.amount_cents), 0);
    const paidRevenueCents = callerDeals
      .filter((deal) => deal.payment_status === "paid")
      .reduce((sum, deal) => sum + safeNumber(deal.amount_cents), 0);
    const unpaidRevenueCents = callerDeals
      .filter((deal) => deal.payment_status === "unpaid")
      .reduce((sum, deal) => sum + safeNumber(deal.amount_cents), 0);
    const closedDeals = callerDeals.length;

    return {
      profile,
      calls,
      answered,
      demosPromised,
      demosSent,
      followUpsCompleted,
      closedDeals,
      revenueCents,
      paidRevenueCents,
      unpaidRevenueCents,
      averageDealCents: closedDeals ? Math.round(revenueCents / closedDeals) : 0,
      answerRate: safePercent(answered, calls),
      demoRate: safePercent(demosPromised, calls),
      closeRate: safePercent(closedDeals, calls),
      revenuePerCallCents: calls ? Math.round(revenueCents / calls) : 0,
      demoToCloseRate: safePercent(closedDeals, demosPromised)
    };
  });
}

export function safeNumber(value: number | null | undefined) {
  return Number.isFinite(value ?? 0) ? Number(value ?? 0) : 0;
}
