"use client";

import { useEffect, useMemo, useState } from "react";
import { PhoneCall, Target, TrendingUp, Trophy } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { endOfToday, formatDateTime, iso, isOverdue, isToday, startOfMonth, startOfToday, startOfWeekMonday } from "@/lib/dates";
import { formatEuro } from "@/lib/money";
import { answeredOutcomes, buildCallerStats } from "@/lib/stats";
import type { CallActivity, Deal, Goal, Lead } from "@/lib/types";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { Profile, Team } from "@/lib/types";

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      {(context) => <DashboardContent {...context} />}
    </AppShell>
  );
}

function DashboardContent({
  client,
  profile,
  team,
  members
}: {
  client: AppSupabaseClient;
  profile: Profile;
  team: Team;
  members: Profile[];
}) {
  const [activities, setActivities] = useState<CallActivity[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const monthStartIso = iso(startOfMonth());
      const [activityResult, dealResult, leadResult, goalResult] = await Promise.all([
        client
          .from("call_activities")
          .select("*")
          .eq("team_id", team.id)
          .gte("created_at", monthStartIso)
          .order("created_at", { ascending: false }),
        client.from("deals").select("*").eq("team_id", team.id).order("closed_at", { ascending: false }),
        client.from("leads").select("*").eq("team_id", team.id).order("next_follow_up_at", { ascending: true }),
        client.from("goals").select("*").eq("team_id", team.id)
      ]);

      const firstError =
        activityResult.error?.message ??
        dealResult.error?.message ??
        leadResult.error?.message ??
        goalResult.error?.message ??
        null;
      setError(firstError);
      setActivities((activityResult.data as CallActivity[] | null) ?? []);
      setDeals((dealResult.data as Deal[] | null) ?? []);
      setLeads((leadResult.data as Lead[] | null) ?? []);
      setGoals((goalResult.data as Goal[] | null) ?? []);
      setLoading(false);
    }
    void load();
  }, [client, team.id]);

  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const weekStart = startOfWeekMonday();
  const monthStartDate = startOfMonth();

  const todayActivities = activities.filter((activity) => {
    const date = new Date(activity.created_at);
    return date >= todayStart && date <= todayEnd;
  });
  const todayDeals = deals.filter((deal) => {
    const date = new Date(deal.closed_at);
    return date >= todayStart && date <= todayEnd;
  });
  const weeklyDeals = deals.filter((deal) => new Date(deal.closed_at) >= weekStart);
  const monthlyDeals = deals.filter((deal) => new Date(deal.closed_at) >= monthStartDate);
  const weeklyRevenue = weeklyDeals.reduce((sum, deal) => sum + deal.amount_cents, 0);
  const monthlyRevenue = monthlyDeals.reduce((sum, deal) => sum + deal.amount_cents, 0);
  const weeklyGoal = goals.find((goal) => goal.period === "weekly" && goal.goal_type === "revenue");
  const weeklyTargetCents = (weeklyGoal?.target_number ?? 0) * 100;
  const weeklyProgress = weeklyTargetCents ? Math.min(100, Math.round((weeklyRevenue / weeklyTargetCents) * 100)) : 0;

  const stats = useMemo(() => buildCallerStats(members, activities, deals), [members, activities, deals]);
  const currentUserStats = stats.find((item) => item.profile.id === profile.id);
  const topThree = [...stats].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 3);
  const dueToday = leads.filter((lead) => isToday(lead.next_follow_up_at));
  const overdue = leads.filter((lead) => isOverdue(lead.next_follow_up_at));

  if (loading) return <Card>Loading dashboard metrics.</Card>;
  if (error) return <Card><p className="text-sm text-danger">{error}</p></Card>;

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Today's calls" value={todayActivities.length} icon={<PhoneCall size={18} />} />
        <Metric
          title="Answered calls"
          value={todayActivities.filter((activity) => answeredOutcomes.has(activity.outcome)).length}
          icon={<PhoneCall size={18} />}
        />
        <Metric
          title="Demos promised"
          value={todayActivities.filter((activity) => activity.outcome === "demo_promised").length}
          icon={<Target size={18} />}
        />
        <Metric
          title="Today's revenue"
          value={formatEuro(todayDeals.reduce((sum, deal) => sum + deal.amount_cents, 0))}
          icon={<TrendingUp size={18} />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card title="Revenue Pace">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatLabel label="Today closes" value={todayDeals.length} />
            <StatLabel label="Weekly revenue" value={formatEuro(weeklyRevenue)} />
            <StatLabel label="Monthly revenue" value={formatEuro(monthlyRevenue)} />
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-steel">Weekly revenue target</span>
              <span className="font-bold text-ink">{weeklyProgress}%</span>
            </div>
            <div className="h-3 rounded-full bg-gray-100">
              <div className="h-3 rounded-full bg-money" style={{ width: `${weeklyProgress}%` }} />
            </div>
            <p className="mt-2 text-sm text-steel">
              {weeklyGoal ? `${formatEuro(weeklyRevenue)} of ${formatEuro(weeklyTargetCents)}` : "Set a weekly revenue goal in Admin."}
            </p>
          </div>
        </Card>

        <Card title="Your Stats">
          {currentUserStats ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <StatLabel label="Calls" value={currentUserStats.calls} />
              <StatLabel label="Revenue" value={formatEuro(currentUserStats.revenueCents)} />
              <StatLabel label="Answer rate" value={`${currentUserStats.answerRate}%`} />
              <StatLabel label="Close rate" value={`${currentUserStats.closeRate}%`} />
            </div>
          ) : (
            <EmptyState title="No stats yet">Make your first call to start tracking performance.</EmptyState>
          )}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Top 3 Revenue Leaderboard" action={<Trophy size={18} className="text-money" />}>
          {topThree.length ? (
            <div className="grid gap-3">
              {topThree.map((item, index) => (
                <div key={item.profile.id} className="flex items-center justify-between rounded-md border border-line p-3">
                  <div>
                    <p className="font-bold text-ink">#{index + 1} {item.profile.full_name || item.profile.email}</p>
                    <p className="text-sm text-steel">{item.calls} calls · {item.closedDeals} closed deals</p>
                  </div>
                  <Badge tone={index === 0 ? "green" : "neutral"}>{formatEuro(item.revenueCents)}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No leaderboard data yet" />
          )}
        </Card>

        <Card title="Follow-ups">
          <div className="grid gap-4 sm:grid-cols-2">
            <FollowupList title="Due today" leads={dueToday} />
            <FollowupList title="Overdue" leads={overdue} danger />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-steel">{title}</p>
          <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
        </div>
        <span className="rounded-md bg-gray-100 p-2 text-ink">{icon}</span>
      </div>
    </Card>
  );
}

function StatLabel({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-steel">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}

function FollowupList({ title, leads, danger = false }: { title: string; leads: Lead[]; danger?: boolean }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <Badge tone={danger ? "red" : "amber"}>{leads.length}</Badge>
      </div>
      <div className="grid gap-2">
        {leads.slice(0, 4).map((lead) => (
          <div key={lead.id} className="rounded-md border border-line p-3">
            <p className="font-semibold text-ink">{lead.company_name}</p>
            <p className="text-xs text-steel">{formatDateTime(lead.next_follow_up_at)}</p>
          </div>
        ))}
        {!leads.length ? <p className="text-sm text-steel">Nothing queued.</p> : null}
      </div>
    </div>
  );
}
