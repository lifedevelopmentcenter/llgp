"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  doc, getDoc, collection, query, where, getDocs,
  addDoc, updateDoc, serverTimestamp, orderBy, limit,
} from "firebase/firestore";
import { ArrowLeft, Send, Save, CheckCircle2, ExternalLink } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { PageLoader } from "@/components/ui/Spinner";
import { formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";
import type { LLGLIModule, LLGLISubmission } from "@/lib/types";

export default function IncubatorWeekPage() {
  const { weekId } = useParams<{ weekId: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [module, setModule] = useState<LLGLIModule | null>(null);
  const [submission, setSubmission] = useState<LLGLISubmission | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !weekId) return;
    const load = async () => {
      try {
        const modSnap = await getDoc(doc(db, COLLECTIONS.LLGLI_MODULES, weekId));
        if (!modSnap.exists()) { router.replace("/incubator"); return; }
        setModule({ id: modSnap.id, ...modSnap.data() } as LLGLIModule);

        const subSnap = await getDocs(
          query(collection(db, COLLECTIONS.LLGLI_SUBMISSIONS),
            where("userId", "==", profile.id),
            where("moduleId", "==", weekId),
            limit(1))
        );
        if (!subSnap.empty) {
          const s = { id: subSnap.docs[0].id, ...subSnap.docs[0].data() } as LLGLISubmission;
          setSubmission(s);
          setContent(s.content || "");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile, weekId, router]);

  const saveOrSubmit = async (submit: boolean) => {
    if (!profile || !module) return;
    setSaving(true);
    try {
      const data = {
        userId: profile.id,
        userName: profile.displayName,
        userPhoto: profile.photoURL || null,
        moduleId: module.id,
        weekNumber: module.weekNumber,
        content,
        status: submit ? "submitted" : "draft",
        updatedAt: serverTimestamp(),
        ...(submit ? { submittedAt: serverTimestamp() } : {}),
      };

      if (submission) {
        await updateDoc(doc(db, COLLECTIONS.LLGLI_SUBMISSIONS, submission.id), data);
        setSubmission({ ...submission, ...data, status: submit ? "submitted" : "draft" } as any);
      } else {
        const ref = await addDoc(collection(db, COLLECTIONS.LLGLI_SUBMISSIONS), {
          ...data,
          createdAt: serverTimestamp(),
        });
        setSubmission({ id: ref.id, ...data } as any);
      }

      toast.success(submit ? "Assignment submitted!" : "Draft saved.");
    } catch (e) {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!module) return null;

  const isSubmitted = submission?.status === "submitted" || submission?.status === "reviewed";

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/incubator" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <p className="text-xs text-slate-500">Week {module.weekNumber}</p>
          <h1 className="text-lg font-bold text-slate-900">{module.title}</h1>
        </div>
      </div>

      {/* Video */}
      {module.videoUrl && (
        <Card padding={false}>
          <div className="rounded-xl overflow-hidden bg-black aspect-video">
            {module.videoUrl.includes("youtube") || module.videoUrl.includes("youtu.be") ? (
              <iframe
                src={module.videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                className="w-full h-full"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <a href={module.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white text-sm">
                  <ExternalLink className="w-4 h-4" />
                  Open video
                </a>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Content */}
      {module.content && (
        <Card>
          <h3 className="font-semibold text-slate-900 mb-2 text-sm">Module Content</h3>
          <p className="text-sm text-slate-600 whitespace-pre-line">{module.content}</p>
        </Card>
      )}

      {/* Assignment */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900 text-sm">Assignment</h3>
          {isSubmitted && <Badge variant="success">Submitted</Badge>}
          {submission?.status === "reviewed" && <Badge variant="purple">Reviewed ✓</Badge>}
        </div>

        <div className="bg-indigo-50 rounded-xl p-3 mb-4">
          <p className="text-sm text-indigo-800">{module.assignmentPrompt}</p>
        </div>

        {submission?.status === "reviewed" && submission.reviewNote && (
          <div className="bg-purple-50 rounded-xl p-3 mb-4">
            <p className="text-xs font-semibold text-purple-700 mb-1">Admin Feedback</p>
            <p className="text-sm text-purple-800">{submission.reviewNote}</p>
          </div>
        )}

        <Textarea
          label="Your Response"
          placeholder="Write your assignment response here…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          disabled={isSubmitted}
        />

        {!isSubmitted && (
          <div className="flex gap-2 mt-3">
            <Button variant="secondary" onClick={() => saveOrSubmit(false)} loading={saving} disabled={!content.trim()}>
              <Save className="w-4 h-4" />
              Save Draft
            </Button>
            <Button onClick={() => saveOrSubmit(true)} loading={saving} disabled={!content.trim()}>
              <Send className="w-4 h-4" />
              Submit Assignment
            </Button>
          </div>
        )}

        {isSubmitted && submission?.submittedAt && (
          <p className="text-xs text-slate-400 mt-2">
            Submitted {formatDateTime(submission.submittedAt as any)}
          </p>
        )}
      </Card>
    </div>
  );
}
