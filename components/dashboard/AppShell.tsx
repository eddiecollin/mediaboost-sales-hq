"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Crown,
  FileUp,
  Gauge,
  Headphones,
  LogOut,
  Settings,
  Trophy,
  WalletCards
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useWorkspace } from "@/lib/useWorkspace";
import type { Profile, Team } from "@/lib/types";
import type { AppSupabaseClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/leads", label: "Leads", icon: ClipboardList },
  { href: "/import", label: "CSV Import", icon: FileUp, adminOnly: true },
  { href: "/call-mode", label: "Call Mode", icon: Headphones },
  { href: "/follow-ups", label: "Follow-ups", icon: BarChart3 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/deals", label: "Deals", icon: WalletCards },
  { href: "/admin", label: "Admin", icon: Settings, adminOnly: true }
];

type AppContext = {
  client: AppSupabaseClient;
  profile: Profile;
  team: Team;
  members: Profile[];
  refreshWorkspace: () => Promise<void>;
};

export function AppShell({
  title,
  children,
  adminOnly = false
}: {
  title: string;
  adminOnly?: boolean;
  children: (context: AppContext) => React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const workspace = useWorkspace(true);

  async function signOut() {
    await workspace.client?.auth.signOut();
    router.replace("/login");
  }

  if (workspace.loading) {
    return <CenteredMessage title="Loading Sales HQ" body="Connecting to your Mediaboost workspace." />;
  }

  if (workspace.error || !workspace.client) {
    return <CenteredMessage title="Setup needed" body={workspace.error ?? "Supabase is not configured."} />;
  }

  if (!workspace.profile || !workspace.team) {
    return (
      <CenteredMessage
        title="Finish team setup"
        body="Create a Mediaboost team or join one with an invite code before entering the dashboard."
      />
    );
  }

  if (adminOnly && workspace.profile.role !== "admin") {
    return <CenteredMessage title="Admin access only" body="This page is available to team admins." />;
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-money">Mediaboost</p>
            <h1 className="text-xl font-bold text-ink">Sales HQ</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-steel">
            <span className="rounded-md border border-line px-3 py-2">
              {workspace.team.name} · {workspace.profile.role}
            </span>
            <Button variant="ghost" onClick={signOut}>
              <LogOut size={16} /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[230px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <nav className="grid gap-1 rounded-lg border border-line bg-white p-2 shadow-panel">
            {navItems
              .filter((item) => !item.adminOnly || workspace.profile?.role === "admin")
              .map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold ${
                      active ? "bg-ink text-white" : "text-steel hover:bg-gray-100"
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
          </nav>
        </aside>

        <main className="grid gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-ink">{title}</h1>
              <p className="mt-1 text-sm text-steel">
                {workspace.profile.full_name || workspace.profile.email || "Team member"}
              </p>
            </div>
            {workspace.profile.role === "admin" ? (
              <div className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-steel">
                <Crown size={16} /> Invite {workspace.team.invite_code}
              </div>
            ) : null}
          </div>
          {children({
            client: workspace.client,
            profile: workspace.profile,
            team: workspace.team,
            members: workspace.members,
            refreshWorkspace: workspace.refresh
          })}
        </main>
      </div>
    </div>
  );
}

function CenteredMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f6f8] p-4">
      <Card title={title} className="max-w-lg">
        <p className="text-sm text-steel">{body}</p>
        <div className="mt-4 flex gap-3">
          <Link className="text-sm font-bold text-ink underline" href="/login">
            Login
          </Link>
          <Link className="text-sm font-bold text-ink underline" href="/signup">
            Sign up
          </Link>
        </div>
      </Card>
    </main>
  );
}
