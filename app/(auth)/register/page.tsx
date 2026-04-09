"use client";
import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import toast from "react-hot-toast";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const { signUp, signInWithGoogle, refreshProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token") ?? "";
  const inviteEmail = searchParams.get("email") ?? "";

  const [form, setForm] = useState({ name: "", email: inviteEmail, password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Keep email in sync if param changes after mount
  useEffect(() => {
    if (inviteEmail) setForm((f) => ({ ...f, email: inviteEmail }));
  }, [inviteEmail]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const processInvite = async (uid: string) => {
    if (!inviteToken) return;
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.INVITATIONS, inviteToken));
      if (!snap.exists()) return;
      const inv = snap.data();
      // Mark invite as used
      await updateDoc(doc(db, COLLECTIONS.INVITATIONS, inviteToken), { status: "used", usedAt: serverTimestamp() });
      // Admin invite → auto-activate account
      if (inv.adminInvite) {
        const updates: Record<string, unknown> = { isActive: true, updatedAt: serverTimestamp() };
        if (inv.preAssignedRole) updates.role = inv.preAssignedRole;
        if (inv.preAssignedNationId) { updates.nationId = inv.preAssignedNationId; updates.nationName = inv.preAssignedNationName ?? null; }
        if (inv.preAssignedCityId) { updates.cityId = inv.preAssignedCityId; updates.cityName = inv.preAssignedCityName ?? null; }
        await updateDoc(doc(db, COLLECTIONS.USERS, uid), updates);
        await refreshProfile();
      }
    } catch (e) {
      console.error("Failed to process invite", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const uid = await signUp(form.email, form.password, form.name);
      await processInvite(uid as any);
      toast.success("Account created! Welcome to LLGP.");
      router.replace("/onboarding");
    } catch (err: any) {
      const msg = err.code === "auth/email-already-in-use"
        ? "An account with this email already exists."
        : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo variant="dark" size="lg" className="mb-2" />
          <p className="text-sm text-slate-500 mt-1">
            {inviteToken ? "You've been invited to join the community" : "Join the Leading Lights community"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Full name" placeholder="Your full name" value={form.name} onChange={set("name")} required />
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set("email")}
              required
              readOnly={!!inviteEmail}
              className={inviteEmail ? "bg-slate-50" : ""}
            />
            <Input label="Password" type="password" placeholder="At least 6 characters" value={form.password} onChange={set("password")} required />
            <Input label="Confirm password" type="password" placeholder="Repeat your password" value={form.confirm} onChange={set("confirm")} required />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              Create account
            </Button>

            {!inviteToken && (
              <>
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                  <div className="relative flex justify-center text-xs text-slate-400 font-medium"><span className="bg-white px-2">or</span></div>
                </div>
                <button type="button"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await signInWithGoogle();
                      router.replace("/onboarding");
                    } catch (err: any) {
                      setError(err.code === "auth/popup-closed-by-user" ? "" : "Google sign-in failed.");
                    } finally { setLoading(false); }
                  }}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors disabled:opacity-50">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </>
            )}
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-600 font-medium hover:text-indigo-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
