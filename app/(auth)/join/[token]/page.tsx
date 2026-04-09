"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Mail, UserPlus, LogIn, CheckCircle2, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { PageLoader } from "@/components/ui/Spinner";
import type { Invitation } from "@/lib/types";

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.INVITATIONS, token));
        if (!snap.exists()) { setInvalid(true); return; }
        const inv = { id: snap.id, ...snap.data() } as Invitation;
        // Check expiry & status
        const now = new Date();
        const expiresAt = inv.expiresAt?.toDate?.() ?? new Date(0);
        if (inv.status !== "pending" || expiresAt < now) { setInvalid(true); return; }
        setInvite(inv);
      } catch { setInvalid(true); }
      finally { setLoading(false); }
    };
    load();
  }, [token]);

  if (loading) return <PageLoader />;

  const registerUrl = `/register?token=${token}${invite?.email ? `&email=${encodeURIComponent(invite.email)}` : ""}`;
  const loginUrl = `/login?token=${token}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <Logo variant="dark" size="lg" className="mx-auto" />

        {invalid ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-5">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Invitation Invalid</h1>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                This invitation link has expired or has already been used. Ask the person who invited you for a new link.
              </p>
            </div>
            <button
              onClick={() => router.push("/login")}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
            >
              Go to Login
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-5">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-indigo-500" />
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-900">You&apos;re Invited!</h1>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                <span className="font-semibold text-slate-700">{invite?.invitedByName}</span> has invited you to join the{" "}
                <span className="font-semibold text-indigo-600">Leading Lights Global Network</span>.
              </p>
              {invite?.email && (
                <p className="text-xs text-slate-400 mt-2">Invited as: <span className="font-medium text-slate-600">{invite.email}</span></p>
              )}
            </div>

            {invite?.adminInvite && (
              <div className="bg-green-50 rounded-xl p-3 flex items-start gap-2 text-left">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-green-700">
                  <span className="font-semibold">Admin invite</span> — your account will be activated immediately upon registration.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={() => router.push(registerUrl)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Create an Account
              </button>
              <button
                onClick={() => router.push(loginUrl)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
              >
                <LogIn className="w-4 h-4" />
                I already have an account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
