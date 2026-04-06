"use client";
export const dynamic = "force-dynamic";
import React, { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function BroadcastPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (profile?.role !== "global_admin") {
    return <div className="p-8 text-center text-slate-500">Admin only</div>;
  }

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) { toast.error("Title and message required"); return; }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(`Sent to ${data.sent} device(s)`);
      toast.success(`Broadcast sent to ${data.sent} device(s)!`);
      setTitle(""); setBody("");
    } catch (e: any) {
      toast.error(e.message || "Broadcast failed");
    } finally { setSending(false); }
  };

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900">Push Broadcast</h1>
        <p className="text-sm text-slate-500 mt-0.5">Send a push notification to all LLGP users</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 font-medium">
        ⚠️ This sends to ALL users who have enabled push notifications. Use sparingly.
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <Input label="Notification title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. New announcement from HQ" />
        <Textarea label="Message" value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message here…" rows={4} />
        {result && <p className="text-sm text-green-600 font-semibold">✓ {result}</p>}
        <Button onClick={handleSend} loading={sending} disabled={!title.trim() || !body.trim()} className="w-full">
          Send to All Users
        </Button>
      </div>
      <p className="text-xs text-slate-400">
        Users who have not granted notification permission will not receive this.
        This calls <code className="bg-slate-100 px-1 rounded">/api/admin/broadcast</code> which reads all FCM tokens from Firestore and sends via FCM.
      </p>
    </div>
  );
}
