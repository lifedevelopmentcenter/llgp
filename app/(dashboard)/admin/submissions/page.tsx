"use client";
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, orderBy, updateDoc, doc, serverTimestamp, where,
} from "firebase/firestore";
import { Layers, CheckCircle2, Clock, MessageSquare, Filter } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";
import type { LLGLISubmission, LLGLIModule } from "@/lib/types";

export default function AdminSubmissionsPage() {
  return (
    <AuthGuard requiredRoles={["global_admin"]}>
      <SubmissionsContent />
    </AuthGuard>
  );
}

function SubmissionsContent() {
  const [submissions, setSubmissions] = useState<LLGLISubmission[]>([]);
  const [modules, setModules] = useState<LLGLIModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterWeek, setFilterWeek] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [reviewing, setReviewing] = useState<LLGLISubmission | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [subSnap, modSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.LLGLI_SUBMISSIONS), orderBy("createdAt", "desc"))),
          getDocs(query(collection(db, COLLECTIONS.LLGLI_MODULES), orderBy("weekNumber"))),
        ]);
        setSubmissions(subSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LLGLISubmission)));
        setModules(modSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LLGLIModule)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const openReview = (sub: LLGLISubmission) => {
    setReviewing(sub);
    setReviewNote(sub.reviewNote || "");
  };

  const submitReview = async () => {
    if (!reviewing) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.LLGLI_SUBMISSIONS, reviewing.id), {
        status: "reviewed",
        reviewNote,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === reviewing.id ? { ...s, status: "reviewed", reviewNote } : s
        )
      );
      setReviewing(null);
      toast.success("Submission reviewed.");
    } catch (e) {
      toast.error("Failed to save review.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = submissions.filter((s) => {
    if (filterWeek && s.weekNumber.toString() !== filterWeek) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  const pendingCount = submissions.filter((s) => s.status === "submitted").length;
  const reviewedCount = submissions.filter((s) => s.status === "reviewed").length;

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">LLGLI Submissions</h1>
        <p className="text-sm text-slate-500">{submissions.length} total · {pendingCount} pending review</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: submissions.length, color: "text-slate-700" },
          { label: "Pending Review", value: pendingCount, color: "text-amber-600" },
          { label: "Reviewed", value: reviewedCount, color: "text-green-600" },
        ].map((s) => (
          <Card key={s.label} className="p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          value={filterWeek}
          onChange={(e) => setFilterWeek(e.target.value)}
        >
          <option value="">All weeks</option>
          {modules.map((m) => (
            <option key={m.id} value={m.weekNumber}>Week {m.weekNumber}: {m.title}</option>
          ))}
        </select>
        <select
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-6 h-6" />}
          title="No submissions yet"
          description="Submissions will appear here once participants submit their assignments."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((sub) => (
            <Card key={sub.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar name={sub.userName} photoURL={sub.userPhoto} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-slate-900 text-sm">{sub.userName}</p>
                    <Badge variant="default">Week {sub.weekNumber}</Badge>
                    {sub.status === "reviewed" && <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-0.5" />Reviewed</Badge>}
                    {sub.status === "submitted" && <Badge variant="warning"><Clock className="w-3 h-3 mr-0.5" />Pending</Badge>}
                    {sub.status === "draft" && <Badge variant="default">Draft</Badge>}
                  </div>

                  {/* Module title */}
                  {(() => {
                    const mod = modules.find((m) => m.id === sub.moduleId);
                    return mod ? <p className="text-xs text-indigo-600 mb-1">{mod.title}</p> : null;
                  })()}

                  {/* Submission content preview */}
                  <p className="text-sm text-slate-600 line-clamp-3 whitespace-pre-line">{sub.content}</p>

                  {/* Review note if exists */}
                  {sub.reviewNote && (
                    <div className="mt-2 bg-purple-50 rounded-lg px-3 py-2">
                      <p className="text-xs font-medium text-purple-700 mb-0.5">Your feedback:</p>
                      <p className="text-xs text-purple-800">{sub.reviewNote}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-slate-400">
                      {sub.submittedAt ? `Submitted ${formatDateTime(sub.submittedAt as any)}` : "Not yet submitted"}
                    </p>
                    {sub.status === "submitted" && (
                      <Button size="sm" onClick={() => openReview(sub)}>
                        <MessageSquare className="w-3.5 h-3.5" />
                        Review
                      </Button>
                    )}
                    {sub.status === "reviewed" && (
                      <Button size="sm" variant="secondary" onClick={() => openReview(sub)}>
                        Edit Feedback
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Review Modal */}
      <Modal open={!!reviewing} onClose={() => setReviewing(null)} title="Review Submission" size="lg">
        {reviewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <Avatar name={reviewing.userName} photoURL={reviewing.userPhoto} size="sm" />
              <div>
                <p className="font-semibold text-slate-900 text-sm">{reviewing.userName}</p>
                <p className="text-xs text-slate-500">Week {reviewing.weekNumber}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Their Submission</p>
              <div className="bg-slate-50 rounded-xl p-4 max-h-48 overflow-y-auto">
                <p className="text-sm text-slate-700 whitespace-pre-line">{reviewing.content}</p>
              </div>
            </div>

            <Textarea
              label="Your Feedback"
              placeholder="Write your response, encouragement, or guidance for this participant…"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={5}
            />

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setReviewing(null)}>Cancel</Button>
              <Button className="flex-1" onClick={submitReview} loading={saving} disabled={!reviewNote.trim()}>
                <CheckCircle2 className="w-4 h-4" />
                Mark as Reviewed
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
