"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { formatDateTime, isOverdue, isToday } from "@/lib/dates";
import { formatEuro } from "@/lib/money";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { CallActivity, Deal, Lead, LeadStatus, Profile, Team } from "@/lib/types";

export default function FollowUpsPage() {
  return (
    <AppShell title="Follow-ups">
      {(context) => <FollowUpsContent {...context} />}
    </AppShell>
  );
}

function FollowUpsContent({
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<CallActivity[]>([]);
  const [note, setNote] = useState("");
  const [reschedule, setReschedule] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [leadResult, dealResult, activityResult] = await Promise.all([
      client.from("leads").select("*").eq("team_id", team.id).order("next_follow_up_at", { ascending: true }),
      client.from("deals").select("*").eq("team_id", team.id).order("closed_at", { ascending: false }),
      client.from("call_activities").select("*").eq("team_id", team.id).order("created_at", { ascending: false }).limit(500)
    ]);
    setError(leadResult.error?.message ?? dealResult.error?.message ?? activityResult.error?.message ?? null);
    setLeads((leadResult.data as Lead[] | null) ?? []);
    setDeals((dealResult.data as Deal[] | null) ?? []);
    setActivities((activityResult.data as CallActivity[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id]);

  async function quickAction(lead: Lead, status: LeadStatus, outcome = "follow_up_done") {
    const update: Partial<Lead> = {
      status,
      notes: note ? [lead.notes, `[${new Date().toLocaleString()}] ${note}`].filter(Boolean).join("\n\n") : lead.notes,
      next_follow_up_at: reschedule ? new Date(reschedule).toISOString() : lead.next_follow_up_at
    };
    const [leadResult, activityResult] = await Promise.all([
      client.from("leads").update(update).eq("id", lead.id),
      client.from("call_activities").insert({
        team_id: team.id,
        lead_id: lead.id,
        user_id: profile.id,
        outcome,
        notes: note || null
      })
    ]);
    if (leadResult.error || activityResult.error) {
      setError(leadResult.error?.message ?? activityResult.error?.message ?? "Could not save action.");
      return;
    }
    setNote("");
    setReschedule("");
    await load();
  }

  const visibleLeads = profile.role === "admin" ? leads : leads.filter((lead) => !lead.assigned_to || lead.assigned_to === profile.id);
  const dueToday = visibleLeads.filter((lead) => isToday(lead.next_follow_up_at));
  const overdue = visibleLeads.filter((lead) => isOverdue(lead.next_follow_up_at));
  const upcoming = visibleLeads.filter((lead) => lead.next_follow_up_at && !isToday(lead.next_follow_up_at) && !isOverdue(lead.next_follow_up_at));
  const demoSent = visibleLeads.filter((lead) => lead.status === "demo_sent");
  const negotiation = visibleLeads.filter((lead) => lead.status === "negotiation");
  const unpaidDeals = deals.filter((deal) => deal.payment_status === "unpaid" || deal.payment_status === "partly_paid");

  if (loading) return <Card>Loading follow-ups.</Card>;

  return (
    <div className="grid gap-5">
      {error ? <Card><p className="text-sm text-danger">{error}</p></Card> : null}
      <Card title="Quick action details">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Note for next action"><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field>
          <Field label="Reschedule follow-up"><Input type="datetime-local" value={reschedule} onChange={(event) => setReschedule(event.target.value)} /></Field>
        </div>
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <LeadSection title="Due today" leads={dueToday} members={members} activities={activities} onAction={quickAction} />
        <LeadSection title="Overdue" leads={overdue} members={members} activities={activities} onAction={quickAction} danger />
        <LeadSection title="Upcoming" leads={upcoming} members={members} activities={activities} onAction={quickAction} />
        <LeadSection title="Demo sent but not closed" leads={demoSent} members={members} activities={activities} onAction={quickAction} />
        <LeadSection title="Negotiation" leads={negotiation} members={members} activities={activities} onAction={quickAction} />
        <Card title="Invoice/payment pending">
          {unpaidDeals.length ? (
            <div className="grid gap-3">
              {unpaidDeals.map((deal) => (
                <div key={deal.id} className="rounded-md border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-ink">{deal.client_name}</p>
                      <p className="text-sm text-steel">{formatEuro(deal.amount_cents)} · {deal.payment_status.replace("_", " ")}</p>
                    </div>
                    <Badge tone="amber">{deal.billing_type}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No unpaid deals" />
          )}
        </Card>
      </div>
    </div>
  );
}

function LeadSection({
  title,
  leads,
  members,
  activities,
  onAction,
  danger = false
}: {
  title: string;
  leads: Lead[];
  members: Profile[];
  activities: CallActivity[];
  onAction: (lead: Lead, status: LeadStatus, outcome?: string) => Promise<void>;
  danger?: boolean;
}) {
  const memberName = (id: string | null) => members.find((member) => member.id === id)?.full_name || members.find((member) => member.id === id)?.email || "Unassigned";

  return (
    <Card title={title} action={<Badge tone={danger ? "red" : "neutral"}>{leads.length}</Badge>}>
      {leads.length ? (
        <div className="grid gap-3">
          {leads.slice(0, 12).map((lead) => {
            const last = activities.find((activity) => activity.lead_id === lead.id);
            return (
              <div key={lead.id} className="rounded-md border border-line p-3">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink">{lead.company_name}</p>
                    <p className="text-sm text-steel">{memberName(lead.assigned_to)} · {lead.status.replaceAll("_", " ")}</p>
                    <p className="text-sm text-steel">Follow-up: {formatDateTime(lead.next_follow_up_at)}</p>
                    <p className="mt-2 text-sm text-steel">Last activity: {last ? `${last.outcome.replaceAll("_", " ")} · ${formatDateTime(last.created_at)}` : "None"}</p>
                    {lead.notes ? <p className="mt-2 text-sm text-steel">{lead.notes.slice(0, 160)}</p> : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => onAction(lead, "answered")}>Mark follow-up done</Button>
                  <Button variant="secondary" onClick={() => onAction(lead, "call_later", "call_later")}>Reschedule</Button>
                  <Button variant="secondary" onClick={() => onAction(lead, "demo_sent", "demo_sent")}>Demo sent</Button>
                  <Button variant="primary" onClick={() => onAction(lead, "closed_won", "closed_won")}>Closed won</Button>
                  <Button variant="danger" onClick={() => onAction(lead, "closed_lost", "closed_lost")}>Closed lost</Button>
                  <Button variant="secondary" onClick={() => onAction(lead, lead.status)}>Add note</Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Nothing here" />
      )}
    </Card>
  );
}
