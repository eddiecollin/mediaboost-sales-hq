export type Role = "admin" | "caller";

export type LeadStatus =
  | "new"
  | "no_answer"
  | "answered"
  | "not_interested"
  | "has_website"
  | "wrong_number"
  | "call_later"
  | "demo_promised"
  | "demo_sent"
  | "follow_up_booked"
  | "negotiation"
  | "closed_won"
  | "closed_lost"
  | "archived";

export type CallOutcome =
  | "no_answer"
  | "answered"
  | "not_interested"
  | "wrong_number"
  | "call_later"
  | "demo_promised"
  | "demo_sent"
  | "follow_up_done"
  | "closed_won"
  | "closed_lost";

export type PaymentStatus = "unpaid" | "paid" | "partly_paid";
export type BillingType = "upfront" | "monthly" | "yearly" | "other";
export type GoalPeriod = "daily" | "weekly" | "monthly";

export type Team = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  team_id: string | null;
  full_name: string | null;
  email: string | null;
  role: Role;
  created_at: string;
};

export type Lead = {
  id: string;
  team_id: string;
  company_name: string;
  company_form: string | null;
  industry: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  finder_url: string | null;
  website_url: string | null;
  assigned_to: string | null;
  status: LeadStatus;
  priority: string | null;
  notes: string | null;
  next_follow_up_at: string | null;
  demo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CallActivity = {
  id: string;
  team_id: string;
  lead_id: string | null;
  user_id: string | null;
  outcome: CallOutcome;
  notes: string | null;
  created_at: string;
};

export type Deal = {
  id: string;
  team_id: string;
  lead_id: string | null;
  closed_by: string | null;
  client_name: string;
  amount_cents: number;
  commission_cents: number;
  payment_status: PaymentStatus;
  billing_type: BillingType;
  closed_at: string;
  created_at: string;
};

export type Goal = {
  id: string;
  team_id: string;
  user_id: string | null;
  goal_type: string;
  target_number: number;
  period: GoalPeriod;
  created_at: string;
};

export const leadStatuses: LeadStatus[] = [
  "new",
  "no_answer",
  "answered",
  "not_interested",
  "has_website",
  "wrong_number",
  "call_later",
  "demo_promised",
  "demo_sent",
  "follow_up_booked",
  "negotiation",
  "closed_won",
  "closed_lost",
  "archived"
];

export const callOutcomes: CallOutcome[] = [
  "no_answer",
  "answered",
  "not_interested",
  "wrong_number",
  "call_later",
  "demo_promised",
  "demo_sent",
  "follow_up_done",
  "closed_won",
  "closed_lost"
];
