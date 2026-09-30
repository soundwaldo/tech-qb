"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function CustomerAuthPage() {
  const { mode } = useParams<{ mode: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const signingUp = mode === "sign-up";
  const recovering = mode === "forgot-password";
  const resetting = mode === "reset-password";
  const requestedNext = searchParams.get("next");
  const safeNext = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/portal";
  const alternateMode = signingUp ? "sign-in" : "sign-up";
  const alternateHref = `/auth/${alternateMode}?next=${encodeURIComponent(safeNext)}`;
  const signInHref = `/auth/sign-in?next=${encodeURIComponent(safeNext)}`;
  const forgotHref = `/auth/forgot-password?next=${encodeURIComponent(safeNext)}`;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetRequested, setResetRequested] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = signingUp
        ? await authClient.signUp.email({ email, password, name: name.trim() || email.split("@")[0] })
        : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message || "Authentication failed. Please try again.");
        return;
      }

      router.push(safeNext);
      router.refresh();
    } catch (cause) {
      setError(messageFrom(cause, "Unable to reach the authentication service. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function requestReset(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const redirectTo = `${window.location.origin}/auth/reset-password?next=${encodeURIComponent(safeNext)}`;
      const result = await authClient.requestPasswordReset({ email, redirectTo });
      if (result.error) {
        setError("We could not send a reset code right now. Please try again.");
        return;
      }
      setResetRequested(true);
    } catch {
      setError("We could not send a reset code right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const token = searchParams.get("token");
      if (!token || searchParams.get("error")) {
        setError("This reset link is invalid or expired. Request a new one and try again.");
        return;
      }
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError("This reset link is invalid or expired. Request a new one and try again.");
        return;
      }
      setResetComplete(true);
    } catch {
      setError("We could not reset your password right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (recovering || resetting) {
    return <>
      <Header />
      <main className="flex min-h-[75vh] items-center bg-slate-950 py-12">
        <div className="mx-auto w-full max-w-md px-4">
          {resetComplete ? (
            <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-8 text-white">
              <h1 className="text-2xl font-bold">Password updated</h1>
              <p className="text-sm text-slate-300">Your password has been changed. You can now sign in.</p>
              <Link className="block rounded-lg bg-cyan-500 px-4 py-3 text-center font-semibold text-slate-950 hover:bg-cyan-400" href={signInHref}>Return to sign in</Link>
            </section>
          ) : resetRequested ? (
            <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-8 text-white">
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-sm text-slate-300">If an account matches that email, a private password-reset link is on its way. The link expires for your protection.</p>
              <button type="button" className="w-full text-sm text-cyan-400 hover:underline" onClick={() => { setResetRequested(false); setError(""); }}>Send another link</button>
              <p className="text-center text-sm text-slate-400"><Link className="text-cyan-400 hover:underline" href={signInHref}>Back to sign in</Link></p>
            </section>
          ) : (
            <form onSubmit={resetting ? resetPassword : requestReset} className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-8 text-white">
              <h1 className="text-2xl font-bold">Reset your password</h1>
              <p className="text-sm text-slate-300">
                {resetting
                  ? "Choose a new password for your GGuard account."
                  : "Enter your account email and we’ll send you a private reset link."}
              </p>
              {!resetting && <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />}
              {resetting && <>
                <Input label="New password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
                <Input label="Confirm new password" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} error={error || undefined} />
              </>}
              {!resetting && error && <p role="alert" className="text-sm text-red-400">{error}</p>}
              <Button type="submit" loading={loading} className="w-full">{resetting ? "Update password" : "Send reset link"}</Button>
              <p className="text-center text-sm text-slate-400"><Link className="text-cyan-400 hover:underline" href={signInHref}>Back to sign in</Link></p>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>;
  }

  return <>
    <Header />
    <main className="flex min-h-[75vh] items-center bg-slate-950 py-12">
      <div className="mx-auto w-full max-w-md px-4">
        <form onSubmit={submit} className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-8 text-white">
          <h1 className="text-2xl font-bold">{signingUp ? "Create your GGuard account" : "Sign in to your portal"}</h1>
          {signingUp && <Input label="Name" required value={name} onChange={(event) => setName(event.target.value)} />}
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input label="Password" type="password" autoComplete={signingUp ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} error={error || undefined} />
          {!signingUp && <div className="text-right"><Link className="text-sm text-cyan-400 hover:underline" href={forgotHref}>Forgot password?</Link></div>}
          <Button type="submit" loading={loading} className="w-full">{signingUp ? "Create account" : "Sign in"}</Button>
          <p className="text-sm text-slate-400">{signingUp ? "Already registered?" : "Need an account?"} <Link className="text-cyan-400 hover:underline" href={alternateHref}>{signingUp ? "Sign in" : "Create one"}</Link></p>
        </form>
      </div>
    </main>
    <Footer />
  </>;
}
