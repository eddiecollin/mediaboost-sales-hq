export const importColumns = [
  "company_name",
  "company_form",
  "industry",
  "city",
  "phone",
  "email",
  "finder_url",
  "website_url",
  "notes"
] as const;

export type ImportColumn = (typeof importColumns)[number];

export const alternateColumnMap: Record<string, ImportColumn> = {
  area: "city",
  finder: "finder_url",
  website: "website_url",
  company: "company_name",
  name: "company_name"
};

export function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

export function guessMapping(headers: string[]) {
  const mapping: Record<ImportColumn, string> = {
    company_name: "",
    company_form: "",
    industry: "",
    city: "",
    phone: "",
    email: "",
    finder_url: "",
    website_url: "",
    notes: ""
  };

  headers.forEach((header) => {
    const normalized = normalizeHeader(header);
    if (importColumns.includes(normalized as ImportColumn)) {
      mapping[normalized as ImportColumn] = header;
    } else if (alternateColumnMap[normalized]) {
      mapping[alternateColumnMap[normalized]] = header;
    }
  });

  return mapping;
}

export function rowIsEmpty(row: Record<string, unknown>) {
  return Object.values(row).every((value) => String(value ?? "").trim() === "");
}

export function readMappedValue(row: Record<string, unknown>, header: string) {
  if (!header) return "";
  return String(row[header] ?? "").trim();
}
