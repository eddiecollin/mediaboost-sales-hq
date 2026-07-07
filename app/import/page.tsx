"use client";

import Papa from "papaparse";
import { useState } from "react";
import { FileUp } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { guessMapping, importColumns, readMappedValue, rowIsEmpty, type ImportColumn } from "@/lib/csv";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { Lead, Profile, Team } from "@/lib/types";

export default function ImportPage() {
  return (
    <AppShell title="CSV Import" adminOnly>
      {(context) => <ImportContent {...context} />}
    </AppShell>
  );
}

function ImportContent({
  client,
  team,
  members
}: {
  client: AppSupabaseClient;
  profile: Profile;
  team: Team;
  members: Profile[];
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<ImportColumn, string>>(guessMapping([]));
  const [assignedTo, setAssignedTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function parseFile(file: File) {
    setError(null);
    setResult(null);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const cleanRows = parsed.data.filter((row) => !rowIsEmpty(row));
        const parsedHeaders = parsed.meta.fields ?? [];
        setRows(cleanRows);
        setHeaders(parsedHeaders);
        setMapping(guessMapping(parsedHeaders));
      },
      error: (parseError) => setError(parseError.message)
    });
  }

  async function importLeads() {
    setLoading(true);
    setError(null);
    setResult(null);

    const { data: existingData, error: existingError } = await client
      .from("leads")
      .select("company_name, city, phone")
      .eq("team_id", team.id);

    if (existingError) {
      setError(existingError.message);
      setLoading(false);
      return;
    }

    const existing = (existingData as Pick<Lead, "company_name" | "city" | "phone">[] | null) ?? [];
    const keys = new Set(existing.flatMap((lead) => duplicateKeys(lead.company_name, lead.city, lead.phone)));
    const payload = [];
    let skipped = 0;

    for (const row of rows) {
      const company = readMappedValue(row, mapping.company_name);
      const city = readMappedValue(row, mapping.city);
      const phone = readMappedValue(row, mapping.phone);
      if (!company) {
        skipped += 1;
        continue;
      }
      const rowKeys = duplicateKeys(company, city, phone);
      if (rowKeys.some((key) => keys.has(key))) {
        skipped += 1;
        continue;
      }
      rowKeys.forEach((key) => keys.add(key));
      payload.push({
        team_id: team.id,
        company_name: company,
        company_form: readMappedValue(row, mapping.company_form) || null,
        industry: readMappedValue(row, mapping.industry) || null,
        city: city || null,
        phone: phone || null,
        email: readMappedValue(row, mapping.email) || null,
        finder_url: readMappedValue(row, mapping.finder_url) || null,
        website_url: readMappedValue(row, mapping.website_url) || null,
        notes: readMappedValue(row, mapping.notes) || null,
        assigned_to: assignedTo || null,
        status: "new",
        priority: "normal"
      });
    }

    if (payload.length) {
      const { error: insertError } = await client.from("leads").insert(payload);
      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }
    }

    setResult(`Imported ${payload.length} leads. Skipped ${skipped} empty or duplicate rows.`);
    setLoading(false);
  }

  return (
    <div className="grid gap-5">
      <Card title="Upload leads">
        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <label className="grid cursor-pointer place-items-center rounded-lg border border-dashed border-line bg-gray-50 p-8 text-center">
            <FileUp className="mb-3 text-steel" size={28} />
            <span className="font-bold text-ink">Choose CSV file</span>
            <span className="mt-1 text-sm text-steel">Supported columns include company_name, phone, city, industry, finder_url, website_url, notes.</span>
            <input
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) parseFile(file);
              }}
            />
          </label>
          <Field label="Assign imported leads to">
            <Select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
              <option value="">Nobody</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.full_name || member.email}</option>
              ))}
            </Select>
          </Field>
        </div>
        {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-danger">{error}</p> : null}
        {result ? <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{result}</p> : null}
      </Card>

      <Card title="Column mapping">
        {headers.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {importColumns.map((column) => (
              <Field key={column} label={column}>
                <Select
                  value={mapping[column]}
                  onChange={(event) => setMapping({ ...mapping, [column]: event.target.value })}
                >
                  <option value="">Not mapped</option>
                  {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                </Select>
              </Field>
            ))}
          </div>
        ) : (
          <EmptyState title="Upload a CSV to map columns" />
        )}
      </Card>

      <Card
        title={`Preview ${rows.length ? `(${rows.length} rows)` : ""}`}
        action={<Button disabled={!rows.length || loading || !mapping.company_name} onClick={importLeads}>{loading ? "Importing" : "Import leads"}</Button>}
      >
        {rows.length ? (
          <div className="table-wrap">
            <table className="sales-table">
              <thead>
                <tr>
                  {importColumns.map((column) => <th key={column}>{column}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, index) => (
                  <tr key={index}>
                    {importColumns.map((column) => (
                      <td key={column}>{readMappedValue(row, mapping[column]) || "-"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No CSV rows loaded" />
        )}
      </Card>
    </div>
  );
}

function duplicateKeys(company: string | null | undefined, city: string | null | undefined, phone: string | null | undefined) {
  const keys: string[] = [];
  const cleanPhone = String(phone ?? "").replace(/\s+/g, "");
  if (cleanPhone) keys.push(`phone:${cleanPhone}`);
  const cleanCompany = String(company ?? "").trim().toLowerCase();
  const cleanCity = String(city ?? "").trim().toLowerCase();
  if (cleanCompany && cleanCity) keys.push(`company-city:${cleanCompany}:${cleanCity}`);
  return keys;
}
