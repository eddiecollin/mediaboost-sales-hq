"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Phone } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { formatDateTime, isOverdue, isToday } from "@/lib/dates";
import { euroToCents, formatEuro } from "@/lib/money";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { CallActivity, CallOutcome, Lead, LeadStatus, Profile, Team } from "@/lib/types";

const actions: { status: LeadStatus; outcome: CallOutcome; label: string }[] = [
  { status: "no_answer", outcome: "no_answer", label: "No answer" },
  { status: "answered", outcome: "answered", label: "Answered" },
  { status: "not_interested", outcome: "not_interested", label: "Not interested" },
  { status: "has_website", outcome: "answered", label: "Has website" },
  { status: "wrong_number", outcome: "wrong_number", label: "Wrong number" },
  { status: "call_later", outcome: "call_later", label: "Call later" },
  { status: "demo_promised", outcome: "demo_promised", label: "Demo promised" },
  { status: "demo_sent", outcome: "demo_sent", label: "Demo sent" },
  { status: "follow_up_booked", outcome: "call_later", label: "Follow-up booked" },
  { status: "closed_won", outcome: "closed_won", label: "Closed won" },
  { status: "closed_lost", outcome: "closed_lost", label: "Closed lost" }
];

export default function CallModePage() {
  return (
    <AppShell title="Call Mode">
      {(context) => <CallModeContent {...context} />}
    </AppShell>
  );
}

function CallModeContent({
  client,
  profile,
  team
}: {
  client: AppSupabaseClient;
  profile: Profile;
  team: Team;
  members: Profile[];
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<CallActivity[]>([]);
  const [index, setIndex] = useState(0);
  const [notes, setNotes] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [dealAmount, setDealAmount] = useState("");
  const [commission, setCommission] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error: loadError } = await client
      .from("leads")
      .select("*")
      .eq("team_id", team.id)
      .not("status", "in", "(closed_won,closed_lost,archived)")
      .order("next_follow_up_at", { ascending: true, nullsFirst: false });
    setLeads(((data as Lead[] | null) ?? []).sort((a, b) => priority(a, profile.id) - priority(b, profile.id)));
    setError(loadError?.message ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id, profile.id]);

  const current = leads[index] ?? null;

  useEffect(() => {
    async function loadActivity() {
      if (!current) {
        setActivities([]);
        return;
      }
      const { data } = await client
        .from("call_activities")
        .select("*")
        .eq("lead_id", current.id)
        .order("created_at", { ascending: false })
        .limit(8);
      setActivities((data as CallActivity[] | null) ?? []);
      setNextFollowUp(toInputDateTime(current.next_follow_up_at));
      setDemoUrl(current.demo_url ?? "");
      setNotes("");
      setDealAmount("");
      setCommission("");
    }
    void loadActivity();
  }, [client, current]);

  const queueLabel = useMemo(() => {
    if (!current) return "";
    const score = priority(current, profile.id);
    if (score === 1) return "Overdue follow-up";
    if (score === 2) return "Due today";
    if (score === 3) return "Assigned new lead";
    return "Unassigned new lead";
  }, [current, profile.id]);

  async function recordAction(status: LeadStatus, outcome: CallOutcome) {
    if (!current) return;
    if (status === "closed_won" && !dealAmount) {
      setError("Enter the deal amount before marking closed won.");
      return;
    }

    setSaving(true);
    setError(null);
    const leadUpdate = {
      status,
      notes: appendNote(current.notes, notes),
      next_follow_up_at: nextFollowUp ? new Date(nextFollowUp).toISOString() : null,
      demo_url: demoUrl || null,
      assigned_to: current.assigned_to || profile.id
    };

    const activityInsert = {
      team_id: team.id,
      lead_id: current.id,
      user_id: profile.id,
      outcome,
      notes: notes || null
    };

    const [leadResult, activityResult] = await Promise.all([
      client.from("leads").update(leadUpdate).eq("id", current.id),
      client.from("call_activities").insert(activityInsert)
    ]);

    if (leadResult.error || activityResult.error) {
      setError(leadResult.error?.message ?? activityResult.error?.message ?? "Could not save call.");
      setSaving(false);
      return;
    }

    if (status === "closed_won") {
      const { error: dealError } = await client.from("deals").insert({
        team_id: team.id,
        lead_id: current.id,
        closed_by: profile.id,
        client_name: current.company_name,
        amount_cents: euroToCents(dealAmount),
        commission_cents: euroToCents(commission),
        payment_status: "unpaid",
        billing_type: "upfront"
      });
      if (dealError) {
        setError(dealError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setLeads((existing) => existing.filter((lead) => lead.id !== current.id));
    setIndex(0);
  }

  if (loading) return <Card>Loading call queue.</Card>;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Card title="Current Lead" action={current ? <Badge tone="blue">{queueLabel}</Badge> : null}>
        {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-danger">{error}</p> : null}
        {current ? (
          <div className="grid gap-5">
            <div>
              <h2 className="text-3xl font-bold text-ink">{current.company_name}</h2>
              <p className="mt-2 text-steel">{[current.city, current.industry].filter(Boolean).join(" · ") || "No city or industry set"}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Phone" value={current.phone ? <a className="inline-flex items-center gap-2 font-bold underline" href={`tel:${current.phone}`}><Phone size={16} /> {current.phone}</a> : "No phone"} />
              <Info label="Email" value={current.email || "No email"} />
              <Info label="Finder.fi" value={current.finder_url ? <a className="inline-flex items-center gap-2 underline" target="_blank" href={current.finder_url}>Open <ExternalLink size={14} /></a> : "Not set"} />
              <Info label="Website" value={current.website_url ? <a className="inline-flex items-center gap-2 underline" target="_blank" href={current.website_url}>Open <ExternalLink size={14} /></a> : "Not set"} />
              <Info label="Next follow-up" value={formatDateTime(current.next_follow_up_at)} />
              <Info label="Demo URL" value={current.demo_url || "Not set"} />
            </div>

            <div className="rounded-md border border-line bg-gray-50 p-4">
              <p className="text-xs font-bold uppercase text-steel">Notes</p>
              <p className="mt-2 whitespace-pre-line text-sm text-ink">{current.notes || "No notes yet."}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Optional call notes"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
              <div className="grid gap-4">
                <Field label="Next follow-up"><Input type="datetime-local" value={nextFollowUp} onChange={(event) => setNextFollowUp(event.target.value)} /></Field>
                <Field label="Demo URL"><Input value={demoUrl} onChange={(event) => setDemoUrl(event.target.value)} /></Field>
              </div>
            </div>

            <div className="grid gap-4 rounded-md border border-line p-4 md:grid-cols-2">
              <Field label="Closed won amount (€)"><Input inputMode="decimal" value={dealAmount} onChange={(event) => setDealAmount(event.target.value)} /></Field>
              <Field label="Commission (€)"><Input inputMode="decimal" value={commission} onChange={(event) => setCommission(event.target.value)} /></Field>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {actions.map((action) => (
                <Button
                  key={action.status}
                  variant={action.status === "closed_lost" ? "danger" : action.status === "closed_won" ? "primary" : "secondary"}
                  disabled={saving}
                  onClick={() => recordAction(action.status, action.outcome)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title="No leads in your call queue">Assigned follow-ups and new leads will appear here.</EmptyState>
        )}
      </Card>

      <Card title="Previous Activity">
        {activities.length ? (
          <div className="grid gap-3">
            {activities.map((activity) => (
              <div key={activity.id} className="rounded-md border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge>{activity.outcome.replaceAll("_", " ")}</Badge>
                  <span className="text-xs text-steel">{formatDateTime(activity.created_at)}</span>
                </div>
                {activity.notes ? <p className="mt-2 text-sm text-steel">{activity.notes}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No activity yet" />
        )}
        <div className="mt-5 rounded-md bg-gray-50 p-3 text-sm text-steel">
          Queue position {current ? index + 1 : 0} of {leads.length}. Deal amount preview: {formatEuro(euroToCents(dealAmount))}
        </div>
      </Card>
    </div>
  );
}

function priority(lead: Lead, userId: string) {
  const assignedToUser = lead.assigned_to === userId;
  if (assignedToUser && isOverdue(lead.next_follow_up_at)) return 1;
  if (assignedToUser && isToday(lead.next_follow_up_at)) return 2;
  if (assignedToUser && lead.status === "new") return 3;
  if (!lead.assigned_to && lead.status === "new") return 4;
  return 5;
}

function appendNote(existing: string | null, note: string) {
  if (!note.trim()) return existing;
  const stamped = `[${new Date().toLocaleString()}] ${note.trim()}`;
  return [existing, stamped].filter(Boolean).join("\n\n");
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line p-3">
      <p className="text-xs font-bold uppercase text-steel">{label}</p>
      <div className="mt-1 text-sm text-ink">{value}</div>
    </div>
  );
}

function toInputDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}
