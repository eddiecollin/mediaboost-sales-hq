"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { getSupabaseConfig } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const { client, error: setupError } = getSupabaseConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(setupError);
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (!client) return;
    setLoading(true);
    setError(null);
    const { error: loginError } = await client.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (loginError) {
      setError(loginError.message);
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#111418] p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Mediaboost</p>
          <h1 className="mt-2 text-3xl font-bold">Sales HQ</h1>
          <p className="mt-2 text-sm text-gray-300">Cold-call execution, revenue tracking, and team performance.</p>
        </div>
        <Card title="Login">
          <form className="grid gap-4" onSubmit={login}>
            <Field label="Email">
              <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-danger">{error}</p> : null}
            <Button disabled={loading || !client}>
              <LogIn size={16} /> {loading ? "Signing in" : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-steel">
            New to the team?{" "}
            <Link className="font-bold text-ink underline" href="/signup">
              Create an account
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
