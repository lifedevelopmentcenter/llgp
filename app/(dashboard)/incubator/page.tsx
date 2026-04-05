"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { Layers, CheckCircle2, Clock, ChevronRight, Send } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import type { LLGLIModule, LLGLISubmission } from "@/lib/types";

export default function IncubatorPage() {
  const { profile } = useAuth();
  const [modules, setModules] = useState<LLGLIModule[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, LLGLISubmission>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      try {
        const [modSnap, subSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.LLGLI_MODULES), orderBy("weekNumber"))),
          getDocs(query(collection(db, COLLECTIONS.LLGLI_SUBMISSIONS), where("userId", "==", profile.id))),
        ]);

        setModules(modSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LLGLIModule)).filter((m) => m.isPublished));

        const subMap: Record<string, LLGLISubmission> = {};
        subSnap.docs.forEach((d) => {
          const s = { id: d.id, ...d.data() } as LLGLISubmission;
          subMap[s.moduleId] = s;
        });
        setSubmissions(subMap);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile]);

  if (loading) return <PageLoader />;

  const submittedCount = Object.values(submissions).filter((s) => s.status === "submitted" || s.status === "reviewed").length;
  const totalModules = modules.length;
  const pct = totalModules > 0 ? Math.round((submittedCount / totalModules) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Leadership Incubator</h1>
          <p className="text-sm text-slate-500 mt-0.5">LLGLI — 6-Week Leadership Programme</p>
        </div>
        {profile?.role === "global_admin" && (
          <Link href="/admin/courses" className="text-sm text-indigo-600 font-medium">Manage →</Link>
        )}
      </div>

      {/* Progress */}
      {modules.length > 0 && (
        <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Programme Progress</p>
              <p className="text-xs text-slate-500">{submittedCount} of {totalModules} weeks submitted</p>
            </div>
            {pct === 100 && <Badge variant="success">Complete!</Badge>}
          </div>
          <ProgressBar value={pct} color="indigo" showLabel />
        </Card>
      )}

      {/* Weeks */}
      {modules.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-6 h-6" />}
          title="Programme not yet started"
          description="The Leadership Incubator content will be published soon."
        />
      ) : (
        <div className="space-y-3">
          {modules.map((mod, idx) => {
            const sub = submissions[mod.id];
            const status = sub?.status;
            const isLocked = idx > 0 && !submissions[modules[idx - 1].id];
            const isSubmitted = status === "submitted" || status === "reviewed";
            const isDraft = status === "draft";

            return (
              <Link
                key={mod.id}
                href={isLocked ? "#" : `/incubator/${mod.id}`}
                className={isLocked ? "pointer-events-none" : ""}
              >
                <Card className={`hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 ${isLocked ? "opacity-50" : "cursor-pointer"}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                      isSubmitted ? "bg-green-100 text-green-700" : isDraft ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      {isSubmitted ? <CheckCircle2 className="w-5 h-5" /> : `W${mod.weekNumber}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-semibold text-slate-900 text-sm">Week {mod.weekNumber}: {mod.title}</p>
                        {isSubmitted && <Badge variant="success">Submitted</Badge>}
                        {isDraft && <Badge variant="warning">Draft saved</Badge>}
                        {status === "reviewed" && <Badge variant="purple">Reviewed</Badge>}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{mod.description}</p>
                      {mod.assignmentPrompt && (
                        <p className="text-xs text-indigo-600 mt-1">Assignment: {mod.assignmentPrompt.slice(0, 60)}…</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
