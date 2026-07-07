"use client";

import { useEffect, useState } from "react";
import { Copy, Save } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { Goal, Lead, Profile, Role, Team } from "@/lib/types";

export default function AdminPage() {
  return (
    <AppShell title="Admin Settings" adminOnly>
      {(context) => <AdminContent {...context} />}
    </AppShell>
  );
}

function AdminContent({
  client,
  profile,
  team,
  members,
  refreshWorkspace
}: {
  client: AppSupabaseClient;
  profile: Profile;
  team: Team;
  members: Profile[];
  refreshWorkspace: () => Promise<void>;
}) {
  const [teamName, setTeamName] = useState(team.name);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dailyCalls, setDailyCalls] = useState("");
  const [weeklyRevenue, setWeeklyRevenue] = useState("");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [assignCaller, setAssignCaller] = useState("");
  const [assignStatus, setAssignStatus] = useState("new");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [goalResult, leadResult] = await Promise.all([
      client.from("goals").select("*").eq("team_id", team.id),
      client.from("leads").select("*").eq("team_id", team.id).order("created_at", { ascending: true })
    ]);
    const loadedGoals = (goalResult.data as Goal[] | null) ?? [];
    setGoals(loadedGoals);
    setLeads((leadResult.data as Lead[] | null) ?? []);
    setDailyCalls(String(loadedGoals.find((goal) => goal.goal_type === "calls" && goal.period === "daily")?.target_number ?? ""));
    setWeeklyRevenue(String(loadedGoals.find((goal) => goal.goal_type === "revenue" && goal.period === "weekly")?.target_number ?? ""));
    setMonthlyRevenue(String(loadedGoals.find((goal) => goal.goal_type === "revenue" && goal.period === "monthly")?.target_number ?? ""));
    setError(goalResult.error?.message ?? leadResult.error?.message ?? null);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id]);

  async function updateRole(member: Profile, role: Role) {
    if (member.id === profile.id && role !== "admin") {
      setError("You cannot remove your own admin role.");
      return;
    }
    const { error: updateError } = await client.from("profiles").update({ role }).eq("id", member.id);
    if (updateError) setError(updateError.message);
    await refreshWorkspace();
  }

  async function saveTeam() {
    const { error: updateError } = await client.from("teams").update({ name: teamName }).eq("id", team.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotice("Team settings saved.");
    await refreshWorkspace();
  }

  async function upsertGoal(goal_type: string, period: "daily" | "weekly" | "monthly", target: string) {
    const existing = goals.find((goal) => goal.goal_type === goal_type && goal.period === period && !goal.user_id);
    const payload = { team_id: team.id, goal_type, period, target_number: Math.max(0, Math.round(Number(target) || 0)) };
    const result = existing
      ? await client.from("goals").update(payload).eq("id", existing.id)
      : await client.from("goals").insert(payload);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }

  async function saveGoals() {
    const ok = await Promise.all([
      upsertGoal("calls", "daily", dailyCalls),
      upsertGoal("revenue", "weekly", weeklyRevenue),
      upsertGoal("revenue", "monthly", monthlyRevenue)
    ]);
    if (ok.every(Boolean)) {
      setNotice("Goals saved.");
      await load();
    }
  }

  async function assignLeads() {
    if (!assignCaller) {
      setError("Choose a caller before assigning leads.");
      return;
    }
    const { error: updateError } = await client
      .from("leads")
      .update({ assigned_to: assignCaller })
      .eq("team_id", team.id)
      .eq("status", assignStatus)
      .is("assigned_to", null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotice("Matching unassigned leads were assigned.");
    await load();
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(team.invite_code);
    setNotice("Invite code copied.");
  }

  return (
    <div className="grid gap-5">
      {notice ? <Card><p className="text-sm text-emerald-800">{notice}</p></Card> : null}
      {error ? <Card><p className="text-sm text-danger">{error}</p></Card> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Team settings">
          <div className="grid gap-4">
            <Field label="Team name"><Input value={teamName} onChange={(event) => setTeamName(event.target.value)} /></Field>
            <div className="rounded-md border border-line p-4">
              <p className="text-xs font-bold uppercase text-steel">Invite code</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Badge tone="blue">{team.invite_code}</Badge>
                <Button variant="secondary" onClick={copyInvite}><Copy size={16} /> Copy</Button>
              </div>
            </div>
            <Button onClick={saveTeam}><Save size={16} /> Save team settings</Button>
          </div>
        </Card>

        <Card title="Team goals">
          <div className="grid gap-4">
            <Field label="Daily call goal"><Input inputMode="numeric" value={dailyCalls} onChange={(event) => setDailyCalls(event.target.value)} /></Field>
            <Field label="Weekly revenue goal (€)"><Input inputMode="numeric" value={weeklyRevenue} onChange={(event) => setWeeklyRevenue(event.target.value)} /></Field>
            <Field label="Monthly revenue goal (€)"><Input inputMode="numeric" value={monthlyRevenue} onChange={(event) => setMonthlyRevenue(event.target.value)} /></Field>
            <Button onClick={saveGoals}>Save goals</Button>
          </div>
        </Card>
      </div>

      <Card title="Team members">
        <div className="table-wrap">
          <table className="sales-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="font-bold">{member.full_name || "-"}</td>
                  <td>{member.email}</td>
                  <td>
                    <Select value={member.role} onChange={(event) => updateRole(member, event.target.value as Role)}>
                      <option value="admin">admin</option>
                      <option value="caller">caller</option>
                    </Select>
                  </td>
                  <td>{new Date(member.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Assign leads to callers">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <Field label="Caller">
            <Select value={assignCaller} onChange={(event) => setAssignCaller(event.target.value)}>
              <option value="">Choose caller</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.full_name || member.email}</option>)}
            </Select>
          </Field>
          <Field label="Lead status">
            <Select value={assignStatus} onChange={(event) => setAssignStatus(event.target.value)}>
              <option value="new">new</option>
              <option value="call_later">call later</option>
              <option value="demo_promised">demo promised</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button onClick={assignLeads}>Assign unassigned leads</Button>
          </div>
        </div>
        <p className="mt-3 text-sm text-steel">
          {leads.filter((lead) => !lead.assigned_to).length} unassigned leads are currently available.
        </p>
      </Card>
    </div>
  );
}
