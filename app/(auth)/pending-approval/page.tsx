"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, CheckCircle2, LogOut } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/lib/hooks/useAuth";

export default function PendingApprovalPage() {
  const { profile, refreshProfile, logOut } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      await refreshProfile();
      // If now active, AuthGuard will let them through
      if (profile?.isActive) router.replace("/dashboard");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <Logo variant="dark" size="lg" className="mx-auto" />

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-5">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900">Account Pending Approval</h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Hi {profile?.displayName?.split(" ")[0] ?? "there"}, your account has been submitted and is awaiting approval from an admin. You'll be able to access the platform once approved.
            </p>
          </div>

          <div className="bg-indigo-50 rounded-xl p-4 text-left space-y-2">
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">What happens next</p>
            {[
              "An admin will review your account",
              "You'll receive access once approved",
              "Use the button below to check your status",
            ].map(s => (
              <div key={s} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-indigo-700">{s}</p>
              </div>
            ))}
          </div>

          <button
            onClick={checkStatus}
            disabled={checking}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {checking ? "Checking…" : "Check Approval Status"}
          </button>

          <button
            onClick={logOut}
            className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
