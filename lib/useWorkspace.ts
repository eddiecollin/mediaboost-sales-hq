"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseConfig, type AppSupabaseClient } from "@/lib/supabase/client";
import type { Profile, Team } from "@/lib/types";

type WorkspaceState = {
  client: AppSupabaseClient | null;
  user: User | null;
  profile: Profile | null;
  team: Team | null;
  members: Profile[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useWorkspace(requireTeam = true): WorkspaceState {
  const router = useRouter();
  const pathname = usePathname();
  const config = useMemo(() => getSupabaseConfig(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(config.error);

  async function loadWorkspace() {
    if (!config.client) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const {
      data: { user: activeUser },
      error: authError
    } = await config.client.auth.getUser();

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!activeUser) {
      setLoading(false);
      if (!pathname?.startsWith("/login") && !pathname?.startsWith("/signup")) {
        router.replace("/login");
      }
      return;
    }

    setUser(activeUser);

    const { data: profileData, error: profileError } = await config.client
      .from("profiles")
      .select("*")
      .eq("id", activeUser.id)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    setProfile((profileData as Profile | null) ?? null);

    if (requireTeam && !profileData?.team_id) {
      setLoading(false);
      router.replace("/signup?finish=1");
      return;
    }

    if (profileData?.team_id) {
      const [{ data: teamData, error: teamError }, { data: memberData, error: memberError }] =
        await Promise.all([
          config.client.from("teams").select("*").eq("id", profileData.team_id).maybeSingle(),
          config.client
            .from("profiles")
            .select("*")
            .eq("team_id", profileData.team_id)
            .order("created_at", { ascending: true })
        ]);

      if (teamError || memberError) {
        setError(teamError?.message ?? memberError?.message ?? "Could not load workspace.");
        setLoading(false);
        return;
      }

      setTeam((teamData as Team | null) ?? null);
      setMembers((memberData as Profile[] | null) ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    client: config.client,
    user,
    profile,
    team,
    members,
    loading,
    error,
    refresh: loadWorkspace
  };
}
