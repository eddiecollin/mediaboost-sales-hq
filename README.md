# Mediaboost Sales HQ

Internal cold-calling management app for Mediaboost sales teams. Built with Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth/Database, PapaParse CSV import, and Recharts leaderboards.

## 1. Create a Supabase project

1. Go to [Supabase](https://supabase.com/) and create a new project.
2. In **Authentication > Providers > Email**, keep email/password enabled.
3. For the simplest first setup, disable email confirmation while testing locally. If email confirmation is enabled, users will confirm by email, sign in, then finish creating or joining a team.
4. Go to **Project Settings > API** and copy:
   - Project URL
   - anon public key

Do not put a Supabase service role key in this app. It is not needed and must never be exposed to the browser.

## 2. Run the SQL schema

1. Open **Supabase > SQL Editor**.
2. Paste the full contents of `supabase/schema.sql`.
3. Run it.

The schema creates:

- `teams`
- `profiles`
- `leads`
- `call_activities`
- `deals`
- `goals`
- team onboarding RPC functions
- simple Row Level Security policies scoped by `team_id`

## 3. Add environment variables locally

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 4. Add environment variables to Vercel

In Vercel:

1. Open the project.
2. Go to **Settings > Environment Variables**.
3. Add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Apply them to Production, Preview, and Development as needed.

## 5. Deploy to Vercel

Push the repository to GitHub, then import it in Vercel.

Vercel will run:

```bash
npm install
npm run build
```

The app does not use SQLite, local-only storage, hardcoded users, service role keys in the browser, or production filesystem writes.

## App Areas

- Login and signup with Supabase email/password
- Create a Mediaboost team or join by invite code
- Dashboard with calls, demos, closes, revenue, targets, leaderboard preview, and follow-ups
- Leads table with filters, sorting, assignment, status updates, and admin lead management
- Admin CSV import with preview, column mapping, duplicate skipping, and optional assignment
- Call Mode with one-lead-at-a-time actions, activity logging, follow-up scheduling, demo URL updates, and deal creation on closed-won
- Follow-ups for due, overdue, upcoming, demo sent, negotiation, and unpaid deals
- Leaderboards for revenue, activity, and conversion across today, week, month, and all time
- Deals page with payment status, billing type, commissions, and admin delete
- Admin settings for users, roles, goals, invite code, team name, and lead assignment

## Quality checks

Run before deploy:

```bash
npm run lint
npm run build
```

If environment variables are missing, the app shows a setup message instead of crashing.
