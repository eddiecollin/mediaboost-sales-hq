"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { getSupabaseConfig } from "@/lib/supabase/client";

type Mode = "create" | "join";

export default function SignupPage() {
  const router = useRouter();
  const { client, error: setupError } = getSupabaseConfig();
  const [mode, setMode] = useState<Mode>("create");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamName, setTeamName] = useState("Mediaboost");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState(setupError);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [finishOnly, setFinishOnly] = useState(false);

  useEffect(() => {
    const shouldFinish = new URLSearchParams(window.location.search).has("finish");
    setFinishOnly(shouldFinish);
    if (shouldFinish) setNotice("Finish team setup to enter Sales HQ.");
  }, []);

  async function onboard() {
    if (!client) return false;
    const rpcName = mode === "create" ? "create_team_for_current_user" : "join_team_by_invite";
    const params = mode === "create" ? { team_name: teamName || "Mediaboost" } : { invite: inviteCode };
    const { error: rpcError } = await client.rpc(rpcName, params);
    if (rpcError) {
      setError(rpcError.message);
      return false;
    }
    return true;
  }

  async function signup(event: React.FormEvent) {
    event.preventDefault();
    if (!client) return;
    setLoading(true);
    setError(null);
    setNotice(null);

    const { data, error: signupError } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setNotice("Check your email to confirm the account, then sign in to finish team setup.");
      setLoading(false);
      return;
    }

    const ok = await onboard();
    setLoading(false);
    if (ok) router.replace("/dashboard");
  }

  async function finishExistingUser(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const ok = await onboard();
    setLoading(false);
    if (ok) router.replace("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#111418] px-4 py-10">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="text-white">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Mediaboost</p>
          <h1 className="mt-2 text-4xl font-bold">Build the sales floor around one scoreboard.</h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-gray-300">
            Create a team workspace, invite callers, import leads, and track calls, demos, closes, and revenue in one
            Vercel-ready app.
          </p>
        </div>

        <Card title={finishOnly ? "Finish team setup" : "Create account"}>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`rounded-md border px-3 py-3 text-sm font-bold ${
                mode === "create" ? "border-ink bg-ink text-white" : "border-line bg-white text-steel"
              }`}
            >
              <Building2 className="mx-auto mb-1" size={18} /> Create team
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`rounded-md border px-3 py-3 text-sm font-bold ${
                mode === "join" ? "border-ink bg-ink text-white" : "border-line bg-white text-steel"
              }`}
            >
              <UserPlus className="mx-auto mb-1" size={18} /> Join team
            </button>
          </div>

          <form className="grid gap-4" onSubmit={finishOnly ? finishExistingUser : signup}>
            {!finishOnly ? (
              <>
                <Field label="Full name">
                  <Input required value={fullName} onChange={(event) => setFullName(event.target.value)} />
                </Field>
                <Field label="Email">
                  <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                </Field>
                <Field label="Password">
                  <Input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field>
              </>
            ) : null}

            {mode === "create" ? (
              <Field label="Team name">
                <Input value={teamName} onChange={(event) => setTeamName(event.target.value)} />
              </Field>
            ) : (
              <Field label="Invite code">
                <Input required value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} />
              </Field>
            )}

            {notice ? <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">{notice}</p> : null}
            {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-danger">{error}</p> : null}
            <Button disabled={loading || !client}>{loading ? "Saving" : finishOnly ? "Enter Sales HQ" : "Sign up"}</Button>
          </form>
          <p className="mt-4 text-sm text-steel">
            Already have an account?{" "}
            <Link className="font-bold text-ink underline" href="/login">
              Login
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
