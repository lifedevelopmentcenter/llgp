"use client";
import React, { useEffect, useState } from "react";
import { collection, query, getDocs, doc, setDoc, serverTimestamp, Timestamp, orderBy } from "firebase/firestore";
import { Copy, Check, Send, Users, Link2, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import toast from "react-hot-toast";
import type { Invitation, Nation, UserRole } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

export default function AdminInvitesPage() {
  return (
    <AuthGuard requiredRoles={["global_admin"]}>
      <InvitesContent />
    </AuthGuard>
  );
}

function InvitesContent() {
  const { profile } = useAuth();
  const [nations, setNations] = useState<Nation[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState("");
  const [tab, setTab] = useState<"individual" | "bulk">("individual");

  // Individual invite form
  const [iForm, setIForm] = useState({ email: "", role: "participant" as UserRole, nationId: "", nationName: "" });
  const [iSending, setISending] = useState(false);

  // Bulk invite form
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkRole, setBulkRole] = useState<UserRole>("participant");
  const [bulkNationId, setBulkNationId] = useState("");
  const [bulkNationName, setBulkNationName] = useState("");
  const [bulkSending, setBulkSending] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    const load = async () => {
      try {
        const [nSnap, iSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.NATIONS), orderBy("name"))),
          getDocs(query(collection(db, COLLECTIONS.INVITATIONS), orderBy("createdAt", "desc"))),
        ]);
        setNations(nSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Nation)));
        setInvitations(iSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Invitation)));
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const createInvite = async (email: string, opts: { role?: UserRole; nationId?: string; nationName?: string }): Promise<string> => {
    if (!profile) throw new Error("Not authenticated");
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days for admin invites
    const inv: Omit<Invitation, "id"> = {
      email: email.trim().toLowerCase(),
      invitedById: profile.id,
      invitedByName: profile.displayName,
      adminInvite: true,
      preAssignedRole: opts.role,
      preAssignedNationId: opts.nationId || undefined,
      preAssignedNationName: opts.nationName || undefined,
      status: "pending",
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: serverTimestamp() as any,
    };
    await setDoc(doc(db, COLLECTIONS.INVITATIONS, token), inv);
    return token;
  };

  const sendIndividual = async () => {
    if (!iForm.email.trim()) return;
    setISending(true);
    try {
      const nation = nations.find((n) => n.id === iForm.nationId);
      const token = await createInvite(iForm.email, { role: iForm.role, nationId: iForm.nationId, nationName: nation?.name });
      const link = `${baseUrl}/join/${token}`;
      try { await navigator.clipboard.writeText(link); toast.success("Invite sent & link copied!"); } catch { toast.success("Invite created!"); }
      setIForm({ email: "", role: "participant", nationId: "", nationName: "" });
      // Reload list
      const snap = await getDocs(query(collection(db, COLLECTIONS.INVITATIONS), orderBy("createdAt", "desc")));
      setInvitations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invitation)));
    } catch {
      toast.error("Failed to create invite.");
    } finally { setISending(false); }
  };

  const sendBulk = async () => {
    const emails = bulkEmails.split(/[\n,;]+/).map((e) => e.trim()).filter((e) => e.includes("@"));
    if (emails.length === 0) { toast.error("Enter at least one valid email address."); return; }
    setBulkSending(true);
    try {
      const nation = nations.find((n) => n.id === bulkNationId);
      const tokens: string[] = [];
      for (const email of emails) {
        const token = await createInvite(email, { role: bulkRole, nationId: bulkNationId, nationName: nation?.name });
        tokens.push(token);
      }
      toast.success(`${tokens.length} invite${tokens.length === 1 ? "" : "s"} created!`);
      setBulkEmails("");
      const snap = await getDocs(query(collection(db, COLLECTIONS.INVITATIONS), orderBy("createdAt", "desc")));
      setInvitations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invitation)));
    } catch {
      toast.error("Some invites failed. Please try again.");
    } finally { setBulkSending(false); }
  };

  const copyLink = async (token: string) => {
    const link = `${baseUrl}/join/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(""), 2000);
      toast.success("Link copied!");
    } catch { toast.error("Could not copy."); }
  };

  const statusColor = (inv: Invitation) => {
    if (inv.status === "used") return "bg-green-100 text-green-700";
    const expired = (inv.expiresAt as any)?.toDate?.() < new Date();
    if (expired || inv.status === "expired") return "bg-slate-100 text-slate-500";
    return "bg-amber-100 text-amber-700";
  };
  const statusLabel = (inv: Invitation) => {
    if (inv.status === "used") return "Accepted";
    const expired = (inv.expiresAt as any)?.toDate?.() < new Date();
    if (expired || inv.status === "expired") return "Expired";
    return "Pending";
  };

  const pending = invitations.filter((i) => i.status === "pending" && (i.expiresAt as any)?.toDate?.() > new Date());
  const accepted = invitations.filter((i) => i.status === "used");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Invitations</h1>
        <p className="text-sm text-slate-500">
          Admin invites auto-activate accounts — no approval needed. {pending.length} pending · {accepted.length} accepted.
        </p>
      </div>

      {/* Create invite */}
      <Card className="p-5 space-y-4">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {(["individual", "bulk"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === t ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
            >
              {t === "individual" ? "Individual" : "Bulk"}
            </button>
          ))}
        </div>

        {tab === "individual" && (
          <div className="space-y-3">
            <Input
              label="Email address"
              type="email"
              placeholder="member@example.com"
              value={iForm.email}
              onChange={(e) => setIForm({ ...iForm, email: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Role" value={iForm.role} onChange={(e) => setIForm({ ...iForm, role: e.target.value as UserRole })}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <Select label="Nation (optional)" value={iForm.nationId} onChange={(e) => setIForm({ ...iForm, nationId: e.target.value })}>
                <option value="">No nation</option>
                {nations.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </Select>
            </div>
            <Button onClick={sendIndividual} loading={iSending} disabled={!iForm.email.trim()}>
              <Link2 className="w-4 h-4" />
              Create & Copy Invite Link
            </Button>
          </div>
        )}

        {tab === "bulk" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email addresses</label>
              <textarea
                rows={5}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder={"One email per line or comma-separated:\njohn@example.com\njane@example.com"}
                value={bulkEmails}
                onChange={(e) => setBulkEmails(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">
                {bulkEmails.split(/[\n,;]+/).filter((e) => e.trim().includes("@")).length} valid emails detected
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Role" value={bulkRole} onChange={(e) => setBulkRole(e.target.value as UserRole)}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <Select label="Nation (optional)" value={bulkNationId} onChange={(e) => setBulkNationId(e.target.value)}>
                <option value="">No nation</option>
                {nations.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </Select>
            </div>
            <Button onClick={sendBulk} loading={bulkSending}>
              <Users className="w-4 h-4" />
              Create Bulk Invites
            </Button>
            <p className="text-xs text-slate-400">Links will be created but not automatically emailed. Copy them from the list below.</p>
          </div>
        )}
      </Card>

      {/* Invitations list */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">All Invitations ({invitations.length})</h2>
        {loading ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : invitations.length === 0 ? (
          <Card className="p-5 text-center text-sm text-slate-400">No invitations yet.</Card>
        ) : (
          <div className="space-y-2">
            {invitations.map((inv) => (
              <Card key={inv.id} className="p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900 truncate">{inv.email}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(inv)}`}>{statusLabel(inv)}</span>
                      {inv.adminInvite && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Admin</span>}
                      {inv.preAssignedRole && inv.preAssignedRole !== "participant" && (
                        <span className="text-xs text-slate-500">{ROLE_LABELS[inv.preAssignedRole as UserRole] ?? inv.preAssignedRole}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      By {inv.invitedByName} · Expires {(inv.expiresAt as any)?.toDate?.()?.toLocaleDateString?.() ?? "—"}
                    </p>
                  </div>
                  {inv.status === "pending" && (inv.expiresAt as any)?.toDate?.() > new Date() && (
                    <button
                      onClick={() => copyLink(inv.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Copy invite link"
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
