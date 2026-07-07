"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/dashboard/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { iso, startOfMonth, startOfToday, startOfWeekMonday } from "@/lib/dates";
import { formatEuro } from "@/lib/money";
import { buildCallerStats } from "@/lib/stats";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { CallActivity, Deal, Profile, Team } from "@/lib/types";

type Range = "today" | "week" | "month" | "all";
type Tab = "revenue" | "activity" | "conversion";

export default function LeaderboardPage() {
  return (
    <AppShell title="Leaderboard">
      {(context) => <LeaderboardContent {...context} />}
    </AppShell>
  );
}

function LeaderboardContent({
  client,
  team,
  members
}: {
  client: AppSupabaseClient;
  profile: Profile;
  team: Team;
  members: Profile[];
}) {
  const [range, setRange] = useState<Range>("week");
  const [tab, setTab] = useState<Tab>("revenue");
  const [activities, setActivities] = useState<CallActivity[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const start = rangeStart(range);
      let activityQuery = client.from("call_activities").select("*").eq("team_id", team.id).order("created_at", { ascending: false });
      let dealQuery = client.from("deals").select("*").eq("team_id", team.id).order("closed_at", { ascending: false });
      if (start) {
        activityQuery = activityQuery.gte("created_at", iso(start));
        dealQuery = dealQuery.gte("closed_at", iso(start));
      }
      const [activityResult, dealResult] = await Promise.all([activityQuery, dealQuery]);
      setActivities((activityResult.data as CallActivity[] | null) ?? []);
      setDeals((dealResult.data as Deal[] | null) ?? []);
      setError(activityResult.error?.message ?? dealResult.error?.message ?? null);
      setLoading(false);
    }
    void load();
  }, [client, range, team.id]);

  const stats = useMemo(() => buildCallerStats(members, activities, deals), [members, activities, deals]);
  const revenueRows = [...stats].sort((a, b) => b.revenueCents - a.revenueCents);
  const activityRows = [...stats].sort((a, b) => b.calls - a.calls);
  const conversionRows = [...stats].sort((a, b) => b.closeRate - a.closeRate || b.revenuePerCallCents - a.revenuePerCallCents);
  const chartData = revenueRows.slice(0, 8).map((row) => ({
    name: row.profile.full_name || row.profile.email || "Caller",
    revenue: row.revenueCents / 100
  }));

  return (
    <div className="grid gap-5">
      <Card title="Weekly Revenue Race">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["today", "week", "month", "all"] as Range[]).map((item) => (
            <Button key={item} variant={range === item ? "primary" : "secondary"} onClick={() => setRange(item)}>
              {item === "week" ? "This week" : item === "month" ? "This month" : item === "all" ? "All time" : "Today"}
            </Button>
          ))}
        </div>
        {chartData.length ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatEuro(Number(value) * 100)} />
                <Bar dataKey="revenue" fill="#0f8a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="No revenue yet for this period" />
        )}
      </Card>

      <Card title={tabTitle(tab)}>
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant={tab === "revenue" ? "primary" : "secondary"} onClick={() => setTab("revenue")}>Revenue Leaderboard</Button>
          <Button variant={tab === "activity" ? "primary" : "secondary"} onClick={() => setTab("activity")}>Activity Leaderboard</Button>
          <Button variant={tab === "conversion" ? "primary" : "secondary"} onClick={() => setTab("conversion")}>Conversion Leaderboard</Button>
        </div>
        {loading ? <p className="text-sm text-steel">Loading leaderboard.</p> : null}
        {error ? <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-danger">{error}</p> : null}
        {tab === "revenue" ? <RevenueTable rows={revenueRows} /> : null}
        {tab === "activity" ? <ActivityTable rows={activityRows} /> : null}
        {tab === "conversion" ? <ConversionTable rows={conversionRows} /> : null}
      </Card>
    </div>
  );
}

function RevenueTable({ rows }: { rows: ReturnType<typeof buildCallerStats> }) {
  return (
    <div className="table-wrap">
      <table className="sales-table">
        <thead><tr><th>Rank</th><th>Caller</th><th>Revenue</th><th>Closed deals</th><th>Average deal</th><th>Paid revenue</th><th>Unpaid revenue</th><th>Calls</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.profile.id}>
              <td><Badge tone={index === 0 ? "green" : "neutral"}>#{index + 1}</Badge></td>
              <td className="font-bold">{row.profile.full_name || row.profile.email}</td>
              <td>{formatEuro(row.revenueCents)}</td>
              <td>{row.closedDeals}</td>
              <td>{formatEuro(row.averageDealCents)}</td>
              <td>{formatEuro(row.paidRevenueCents)}</td>
              <td>{formatEuro(row.unpaidRevenueCents)}</td>
              <td>{row.calls}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTable({ rows }: { rows: ReturnType<typeof buildCallerStats> }) {
  return (
    <div className="table-wrap">
      <table className="sales-table">
        <thead><tr><th>Rank</th><th>Caller</th><th>Calls</th><th>Answered calls</th><th>Demos promised</th><th>Demos sent</th><th>Follow-ups completed</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.profile.id}>
              <td>#{index + 1}</td>
              <td className="font-bold">{row.profile.full_name || row.profile.email}</td>
              <td>{row.calls}</td>
              <td>{row.answered}</td>
              <td>{row.demosPromised}</td>
              <td>{row.demosSent}</td>
              <td>{row.followUpsCompleted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConversionTable({ rows }: { rows: ReturnType<typeof buildCallerStats> }) {
  return (
    <div className="table-wrap">
      <table className="sales-table">
        <thead><tr><th>Rank</th><th>Caller</th><th>Answer rate</th><th>Demo rate</th><th>Close rate</th><th>Revenue per call</th><th>Demo-to-close</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.profile.id}>
              <td>#{index + 1}</td>
              <td className="font-bold">{row.profile.full_name || row.profile.email}</td>
              <td>{row.answerRate}%</td>
              <td>{row.demoRate}%</td>
              <td>{row.closeRate}%</td>
              <td>{formatEuro(row.revenuePerCallCents)}</td>
              <td>{row.demoToCloseRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function rangeStart(range: Range) {
  if (range === "today") return startOfToday();
  if (range === "week") return startOfWeekMonday();
  if (range === "month") return startOfMonth();
  return null;
}

function tabTitle(tab: Tab) {
  if (tab === "activity") return "Activity Leaderboard";
  if (tab === "conversion") return "Conversion Leaderboard";
  return "Revenue Leaderboard";
}
