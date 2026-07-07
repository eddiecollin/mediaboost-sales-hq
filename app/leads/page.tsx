"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { formatDateTime } from "@/lib/dates";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { Lead, LeadStatus, Profile, Team } from "@/lib/types";
import { leadStatuses } from "@/lib/types";

type LeadForm = {
  id?: string;
  company_name: string;
  company_form: string;
  industry: string;
  city: string;
  phone: string;
  email: string;
  finder_url: string;
  website_url: string;
  assigned_to: string;
  status: LeadStatus;
  priority: string;
  notes: string;
  next_follow_up_at: string;
  demo_url: string;
};

const emptyForm: LeadForm = {
  company_name: "",
  company_form: "",
  industry: "",
  city: "",
  phone: "",
  email: "",
  finder_url: "",
  website_url: "",
  assigned_to: "",
  status: "new",
  priority: "normal",
  notes: "",
  next_follow_up_at: "",
  demo_url: ""
};

export default function LeadsPage() {
  return (
    <AppShell title="Leads">
      {(context) => <LeadsContent {...context} />}
    </AppShell>
  );
}

function LeadsContent({
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [assigned, setAssigned] = useState("all");
  const [city, setCity] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [sort, setSort] = useState("newest");
  const [form, setForm] = useState<LeadForm | null>(null);
  const isAdmin = profile.role === "admin";

  async function load() {
    setLoading(true);
    const { data, error: loadError } = await client
      .from("leads")
      .select("*")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false });
    setLeads((data as Lead[] | null) ?? []);
    setError(loadError?.message ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id]);

  const cities = unique(leads.map((lead) => lead.city).filter(Boolean) as string[]);
  const industries = unique(leads.map((lead) => lead.industry).filter(Boolean) as string[]);
  const memberName = useCallback(
    (id: string | null) =>
      members.find((member) => member.id === id)?.full_name ||
      members.find((member) => member.id === id)?.email ||
      "Unassigned",
    [members]
  );

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const list = leads.filter((lead) => {
      const haystack = [lead.company_name, lead.city, lead.industry, lead.phone, lead.email, lead.notes]
        .join(" ")
        .toLowerCase();
      return (
        (!term || haystack.includes(term)) &&
        (status === "all" || lead.status === status) &&
        (assigned === "all" || (assigned === "unassigned" ? !lead.assigned_to : lead.assigned_to === assigned)) &&
        (city === "all" || lead.city === city) &&
        (industry === "all" || lead.industry === industry)
      );
    });

    return list.sort((a, b) => {
      if (sort === "followup") return (a.next_follow_up_at ?? "").localeCompare(b.next_follow_up_at ?? "");
      if (sort === "status") return a.status.localeCompare(b.status);
      if (sort === "assigned") return memberName(a.assigned_to).localeCompare(memberName(b.assigned_to));
      return b.created_at.localeCompare(a.created_at);
    });
  }, [assigned, city, industry, leads, memberName, search, sort, status]);

  function editLead(lead: Lead) {
    setForm({
      id: lead.id,
      company_name: lead.company_name,
      company_form: lead.company_form ?? "",
      industry: lead.industry ?? "",
      city: lead.city ?? "",
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      finder_url: lead.finder_url ?? "",
      website_url: lead.website_url ?? "",
      assigned_to: lead.assigned_to ?? "",
      status: lead.status,
      priority: lead.priority ?? "normal",
      notes: lead.notes ?? "",
      next_follow_up_at: toInputDateTime(lead.next_follow_up_at),
      demo_url: lead.demo_url ?? ""
    });
  }

  async function saveLead(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    const payload = {
      team_id: team.id,
      company_name: form.company_name,
      company_form: form.company_form || null,
      industry: form.industry || null,
      city: form.city || null,
      phone: form.phone || null,
      email: form.email || null,
      finder_url: form.finder_url || null,
      website_url: form.website_url || null,
      assigned_to: form.assigned_to || null,
      status: form.status,
      priority: form.priority || "normal",
      notes: form.notes || null,
      next_follow_up_at: form.next_follow_up_at ? new Date(form.next_follow_up_at).toISOString() : null,
      demo_url: form.demo_url || null
    };

    const result = form.id
      ? await client.from("leads").update(payload).eq("id", form.id)
      : await client.from("leads").insert(payload);

    if (result.error) {
      setError(result.error.message);
      return;
    }
    setForm(null);
    await load();
  }

  async function deleteLead(lead: Lead) {
    if (!isAdmin || !window.confirm(`Delete ${lead.company_name}? This cannot be undone.`)) return;
    const { error: deleteError } = await client.from("leads").delete().eq("id", lead.id);
    if (deleteError) setError(deleteError.message);
    await load();
  }

  return (
    <div className="grid gap-5">
      <Card
        title="Lead Pipeline"
        action={
          isAdmin ? (
            <Button onClick={() => setForm(emptyForm)}>
              <Plus size={16} /> Add lead
            </Button>
          ) : null
        }
      >
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input placeholder="Search leads" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {leadStatuses.map((item) => (
              <option key={item} value={item}>{label(item)}</option>
            ))}
          </Select>
          <Select value={assigned} onChange={(event) => setAssigned(event.target.value)}>
            <option value="all">All callers</option>
            <option value="unassigned">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.full_name || member.email}</option>
            ))}
          </Select>
          <Select value={city} onChange={(event) => setCity(event.target.value)}>
            <option value="all">All cities</option>
            {cities.map((item) => <option key={item}>{item}</option>)}
          </Select>
          <Select value={industry} onChange={(event) => setIndustry(event.target.value)}>
            <option value="all">All industries</option>
            {industries.map((item) => <option key={item}>{item}</option>)}
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest</option>
            <option value="followup">Follow-up date</option>
            <option value="status">Status</option>
            <option value="assigned">Assigned caller</option>
          </Select>
        </div>
      </Card>

      <Card>
        {error ? <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-danger">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-steel">Loading leads.</p>
        ) : filtered.length ? (
          <div className="table-wrap">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>City</th>
                  <th>Industry</th>
                  <th>Phone</th>
                  <th>Assigned</th>
                  <th>Status</th>
                  <th>Next follow-up</th>
                  <th>Links</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead.id}>
                    <td className="font-semibold text-ink">{lead.company_name}</td>
                    <td>{lead.city || "-"}</td>
                    <td>{lead.industry || "-"}</td>
                    <td>{lead.phone ? <a className="font-semibold underline" href={`tel:${lead.phone}`}>{lead.phone}</a> : "-"}</td>
                    <td>{memberName(lead.assigned_to)}</td>
                    <td><Badge tone={statusTone(lead.status)}>{label(lead.status)}</Badge></td>
                    <td>{formatDateTime(lead.next_follow_up_at)}</td>
                    <td className="space-y-1 text-sm">
                      {lead.demo_url ? <a className="block underline" href={lead.demo_url} target="_blank">Demo</a> : null}
                      {lead.finder_url ? <a className="block underline" href={lead.finder_url} target="_blank">Finder.fi</a> : null}
                    </td>
                    <td className="max-w-xs text-sm text-steel">{lead.notes ? `${lead.notes.slice(0, 120)}${lead.notes.length > 120 ? "..." : ""}` : "-"}</td>
                    <td>
                      <div className="flex gap-2">
                        {(isAdmin || lead.assigned_to === profile.id || !lead.assigned_to) ? (
                          <Button variant="secondary" onClick={() => editLead(lead)} aria-label="Edit lead">
                            <Pencil size={15} />
                          </Button>
                        ) : null}
                        {isAdmin ? (
                          <Button variant="danger" onClick={() => deleteLead(lead)} aria-label="Delete lead">
                            <Trash2 size={15} />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No leads match the current filters" />
        )}
      </Card>

      {form ? (
        <Modal title={form.id ? "Edit lead" : "Add lead"} onClose={() => setForm(null)}>
          <form className="grid gap-4" onSubmit={saveLead}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Company name"><Input required value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} /></Field>
              <Field label="Company form"><Input value={form.company_form} onChange={(event) => setForm({ ...form, company_form: event.target.value })} /></Field>
              <Field label="Industry"><Input value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} /></Field>
              <Field label="City"><Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
              <Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
              <Field label="Finder.fi URL"><Input value={form.finder_url} onChange={(event) => setForm({ ...form, finder_url: event.target.value })} /></Field>
              <Field label="Website URL"><Input value={form.website_url} onChange={(event) => setForm({ ...form, website_url: event.target.value })} /></Field>
              <Field label="Assigned caller">
                <Select value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })} disabled={!isAdmin}>
                  <option value="">Unassigned</option>
                  {members.map((member) => <option key={member.id} value={member.id}>{member.full_name || member.email}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LeadStatus })}>
                  {leadStatuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}
                </Select>
              </Field>
              <Field label="Priority"><Input value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} /></Field>
              <Field label="Next follow-up"><Input type="datetime-local" value={form.next_follow_up_at} onChange={(event) => setForm({ ...form, next_follow_up_at: event.target.value })} /></Field>
              <Field label="Demo URL"><Input value={form.demo_url} onChange={(event) => setForm({ ...form, demo_url: event.target.value })} /></Field>
            </div>
            <Field label="Notes"><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button>Save lead</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort();
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

function statusTone(status: LeadStatus) {
  if (status === "closed_won") return "green";
  if (status === "closed_lost" || status === "wrong_number") return "red";
  if (status.includes("demo") || status === "negotiation") return "blue";
  if (status.includes("follow") || status === "call_later") return "amber";
  return "neutral";
}

function toInputDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}
