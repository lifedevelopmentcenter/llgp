"use client";
import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { Link2, Copy, Check, Send, Clock, X } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageLoader } from "@/components/ui/Spinner";
import toast from "react-hot-toast";
import type { Invitation } from "@/lib/types";

export default function InvitePage() {
  return (
    <AuthGuard>
      <InviteContent />
    </AuthGuard>
  );
}

function InviteContent() {
  const { profile } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [myInvites, setMyInvites] = useState<Invitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [copiedToken, setCopiedToken] = useState("");

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const loadMyInvites = async () => {
    if (!profile) return;
    try {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.INVITATIONS),
        where("invitedById", "==", profile.id),
      ));
      const invs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invitation));
      invs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setMyInvites(invs);
    } catch { /* ignore */ }
    finally { setLoadingInvites(false); }
  };

  useEffect(() => { loadMyInvites(); }, [profile]);

  const sendInvite = async () => {
    if (!profile || !email.trim()) return;
    setSending(true);
    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
      const inv: Omit<Invitation, "id"> = {
        email: email.trim().toLowerCase(),
        invitedById: profile.id,
        invitedByName: profile.displayName,
        adminInvite: false,
        status: "pending",
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: serverTimestamp() as any,
      };
      await setDoc(doc(db, COLLECTIONS.INVITATIONS, token), inv);
      setEmail("");
      toast.success("Invite link created!");
      await loadMyInvites();
      // Copy link to clipboard
      const link = `${baseUrl}/join/${token}`;
      try { await navigator.clipboard.writeText(link); toast.success("Link copied to clipboard!"); } catch { /* ignore */ }
    } catch {
      toast.error("Failed to create invite. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const copyLink = async (token: string) => {
    const link = `${baseUrl}/join/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(""), 2000);
      toast.success("Link copied!");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const statusColor = (inv: Invitation) => {
    if (inv.status === "used") return "text-green-600 bg-green-50";
    const expired = inv.expiresAt?.toDate?.() < new Date();
    if (expired || inv.status === "expired") return "text-slate-400 bg-slate-100";
    return "text-amber-600 bg-amber-50";
  };

  const statusLabel = (inv: Invitation) => {
    if (inv.status === "used") return "Accepted";
    const expired = inv.expiresAt?.toDate?.() < new Date();
    if (expired || inv.status === "expired") return "Expired";
    return "Pending";
  };

  if (!profile) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Invite a Friend</h1>
        <p className="text-sm text-slate-500 mt-1">
          Invite others to join the Leading Lights Network. An admin will approve their account before they gain access.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Link2 className="w-4 h-4 text-indigo-500" />
          Generate an invite link
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Enter email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendInvite()}
            className="flex-1"
          />
          <Button onClick={sendInvite} loading={sending} disabled={!email.trim()}>
            <Send className="w-4 h-4" />
            Send
          </Button>
        </div>
        <p className="text-xs text-slate-400">
          A unique link will be generated and copied to your clipboard. The link expires in 7 days and requires admin approval.
        </p>
      </Card>

      {/* My invitations */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Your Invitations</h2>
        {loadingInvites ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : myInvites.length === 0 ? (
          <Card className="p-5 text-center text-sm text-slate-400">No invitations sent yet.</Card>
        ) : (
          <div className="space-y-2">
            {myInvites.map((inv) => (
              <Card key={inv.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{inv.email}</p>
                    <p className="text-xs text-slate-400">
                      Expires {inv.expiresAt?.toDate?.()?.toLocaleDateString?.() ?? "—"}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(inv)}`}>
                    {statusLabel(inv)}
                  </span>
                  {inv.status === "pending" && inv.expiresAt?.toDate?.() > new Date() && (
                    <button
                      onClick={() => copyLink(inv.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      {copiedToken === inv.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
