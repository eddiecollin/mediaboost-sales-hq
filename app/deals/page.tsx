"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/dates";
import { euroToCents, formatEuro } from "@/lib/money";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { BillingType, Deal, Lead, PaymentStatus, Profile, Team } from "@/lib/types";

type DealForm = {
  id?: string;
  lead_id: string;
  closed_by: string;
  client_name: string;
  amount: string;
  commission: string;
  payment_status: PaymentStatus;
  billing_type: BillingType;
  closed_at: string;
};

const emptyDeal: DealForm = {
  lead_id: "",
  closed_by: "",
  client_name: "",
  amount: "",
  commission: "",
  payment_status: "unpaid",
  billing_type: "upfront",
  closed_at: ""
};

export default function DealsPage() {
  return (
    <AppShell title="Deals">
      {(context) => <DealsContent {...context} />}
    </AppShell>
  );
}

function DealsContent({
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
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [form, setForm] = useState<DealForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = profile.role === "admin";

  async function load() {
    setLoading(true);
    const [dealResult, leadResult] = await Promise.all([
      client.from("deals").select("*").eq("team_id", team.id).order("closed_at", { ascending: false }),
      client.from("leads").select("*").eq("team_id", team.id).order("company_name")
    ]);
    setDeals((dealResult.data as Deal[] | null) ?? []);
    setLeads((leadResult.data as Lead[] | null) ?? []);
    setError(dealResult.error?.message ?? leadResult.error?.message ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id]);

  function edit(deal: Deal) {
    setForm({
      id: deal.id,
      lead_id: deal.lead_id ?? "",
      closed_by: deal.closed_by ?? "",
      client_name: deal.client_name,
      amount: String(deal.amount_cents / 100),
      commission: String(deal.commission_cents / 100),
      payment_status: deal.payment_status,
      billing_type: deal.billing_type,
      closed_at: deal.closed_at.slice(0, 10)
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    const payload = {
      team_id: team.id,
      lead_id: form.lead_id || null,
      closed_by: form.closed_by || profile.id,
      client_name: form.client_name,
      amount_cents: euroToCents(form.amount),
      commission_cents: euroToCents(form.commission),
      payment_status: form.payment_status,
      billing_type: form.billing_type,
      closed_at: form.closed_at ? new Date(form.closed_at).toISOString() : new Date().toISOString()
    };
    const result = form.id
      ? await client.from("deals").update(payload).eq("id", form.id)
      : await client.from("deals").insert(payload);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setForm(null);
    await load();
  }

  async function remove(deal: Deal) {
    if (!isAdmin || !window.confirm(`Delete deal for ${deal.client_name}?`)) return;
    const { error: deleteError } = await client.from("deals").delete().eq("id", deal.id);
    if (deleteError) setError(deleteError.message);
    await load();
  }

  async function updatePayment(deal: Deal, payment_status: PaymentStatus) {
    const { error: updateError } = await client.from("deals").update({ payment_status }).eq("id", deal.id);
    if (updateError) setError(updateError.message);
    await load();
  }

  const memberName = (id: string | null) => members.find((member) => member.id === id)?.full_name || members.find((member) => member.id === id)?.email || "Unknown";
  const leadName = (id: string | null) => leads.find((lead) => lead.id === id)?.company_name || "-";

  return (
    <div className="grid gap-5">
      <Card
        title="Closed deals"
        action={<Button onClick={() => setForm({ ...emptyDeal, closed_by: profile.id })}><Plus size={16} /> Add deal</Button>}
      >
        {error ? <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-danger">{error}</p> : null}
        {loading ? <p className="text-sm text-steel">Loading deals.</p> : null}
        {!loading && deals.length ? (
          <div className="table-wrap">
            <table className="sales-table">
              <thead>
                <tr><th>Client</th><th>Closed by</th><th>Amount</th><th>Commission</th><th>Billing</th><th>Payment</th><th>Closed date</th><th>Linked lead</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id}>
                    <td className="font-bold">{deal.client_name}</td>
                    <td>{memberName(deal.closed_by)}</td>
                    <td>{formatEuro(deal.amount_cents)}</td>
                    <td>{formatEuro(deal.commission_cents)}</td>
                    <td>{deal.billing_type}</td>
                    <td>
                      <Select value={deal.payment_status} onChange={(event) => updatePayment(deal, event.target.value as PaymentStatus)}>
                        <option value="unpaid">unpaid</option>
                        <option value="paid">paid</option>
                        <option value="partly_paid">partly paid</option>
                      </Select>
                    </td>
                    <td>{formatDate(deal.closed_at)}</td>
                    <td>{leadName(deal.lead_id)}</td>
                    <td>
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => edit(deal)} aria-label="Edit deal"><Pencil size={15} /></Button>
                        {isAdmin ? <Button variant="danger" onClick={() => remove(deal)} aria-label="Delete deal"><Trash2 size={15} /></Button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!loading && !deals.length ? <EmptyState title="No closed deals yet" /> : null}
      </Card>

      {form ? (
        <Modal title={form.id ? "Edit deal" : "Add deal"} onClose={() => setForm(null)}>
          <form className="grid gap-4" onSubmit={save}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Client name"><Input required value={form.client_name} onChange={(event) => setForm({ ...form, client_name: event.target.value })} /></Field>
              <Field label="Linked lead">
                <Select value={form.lead_id} onChange={(event) => {
                  const lead = leads.find((item) => item.id === event.target.value);
                  setForm({ ...form, lead_id: event.target.value, client_name: lead?.company_name || form.client_name });
                }}>
                  <option value="">No linked lead</option>
                  {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.company_name}</option>)}
                </Select>
              </Field>
              <Field label="Closed by">
                <Select value={form.closed_by} onChange={(event) => setForm({ ...form, closed_by: event.target.value })} disabled={!isAdmin}>
                  {members.map((member) => <option key={member.id} value={member.id}>{member.full_name || member.email}</option>)}
                </Select>
              </Field>
              <Field label="Amount (€)"><Input required inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></Field>
              <Field label="Commission (€)"><Input inputMode="decimal" value={form.commission} onChange={(event) => setForm({ ...form, commission: event.target.value })} /></Field>
              <Field label="Billing type">
                <Select value={form.billing_type} onChange={(event) => setForm({ ...form, billing_type: event.target.value as BillingType })}>
                  <option value="upfront">upfront</option><option value="monthly">monthly</option><option value="yearly">yearly</option><option value="other">other</option>
                </Select>
              </Field>
              <Field label="Payment status">
                <Select value={form.payment_status} onChange={(event) => setForm({ ...form, payment_status: event.target.value as PaymentStatus })}>
                  <option value="unpaid">unpaid</option><option value="paid">paid</option><option value="partly_paid">partly paid</option>
                </Select>
              </Field>
              <Field label="Closed date"><Input type="date" value={form.closed_at} onChange={(event) => setForm({ ...form, closed_at: event.target.value })} /></Field>
            </div>
            <div className="rounded-md bg-gray-50 p-3 text-sm text-steel">
              Revenue preview <Badge tone="green">{formatEuro(euroToCents(form.amount))}</Badge>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button>Save deal</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
