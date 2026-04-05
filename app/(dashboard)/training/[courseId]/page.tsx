"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection, query, where, getDocs, doc, getDoc,
  setDoc, updateDoc, orderBy, serverTimestamp,
} from "firebase/firestore";
import { ArrowLeft, CheckCircle2, Play, Lock, ExternalLink } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageLoader } from "@/components/ui/Spinner";
import toast from "react-hot-toast";
import type { VentureCourse, VentureLesson, UserProgress } from "@/lib/types";

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState<VentureCourse | null>(null);
  const [lessons, setLessons] = useState<VentureLesson[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [activeLesson, setActiveLesson] = useState<VentureLesson | null>(null);
  const [marking, setMarking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !courseId) return;
    const load = async () => {
      try {
        const [courseSnap, lessonsSnap, progressSnap] = await Promise.all([
          getDoc(doc(db, COLLECTIONS.VENTURE_COURSES, courseId)),
          getDocs(query(collection(db, COLLECTIONS.VENTURE_LESSONS), where("courseId", "==", courseId), orderBy("order"))),
          getDocs(query(collection(db, COLLECTIONS.USER_PROGRESS), where("userId", "==", profile.id), where("courseId", "==", courseId))),
        ]);

        if (!courseSnap.exists()) { router.replace("/training"); return; }
        setCourse({ id: courseSnap.id, ...courseSnap.data() } as VentureCourse);

        const ls = lessonsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as VentureLesson)).filter((l) => l.isPublished);
        setLessons(ls);
        if (ls.length > 0) setActiveLesson(ls[0]);

        const done = new Set<string>();
        progressSnap.docs.forEach((d) => {
          const p = d.data() as UserProgress;
          if (p.completed) done.add(p.lessonId);
        });
        setCompletedIds(done);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile, courseId, router]);

  const markComplete = async () => {
    if (!profile || !activeLesson || completedIds.has(activeLesson.id)) return;
    setMarking(true);
    try {
      const progressId = `${profile.id}_${activeLesson.id}`;
      await setDoc(doc(db, COLLECTIONS.USER_PROGRESS, progressId), {
        userId: profile.id,
        courseId,
        lessonId: activeLesson.id,
        completed: true,
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      setCompletedIds((prev) => new Set([...prev, activeLesson.id]));
      toast.success("Lesson marked as complete!");

      // Auto-advance
      const currentIdx = lessons.findIndex((l) => l.id === activeLesson.id);
      if (currentIdx < lessons.length - 1) {
        setActiveLesson(lessons[currentIdx + 1]);
      }
    } catch (e) {
      toast.error("Failed to save progress.");
    } finally {
      setMarking(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!course) return null;

  const totalLessons = lessons.length;
  const completedCount = completedIds.size;
  const percentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/training" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">{course.title}</h1>
          <p className="text-xs text-slate-500">{completedCount}/{totalLessons} lessons complete</p>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <ProgressBar value={percentage} showLabel color={percentage === 100 ? "green" : "indigo"} />
        {percentage === 100 && (
          <p className="text-xs text-green-600 font-medium mt-2 text-center">
            🎉 Module Complete! Well done!
          </p>
        )}
      </Card>

      {/* Layout: Video + Lessons */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Lesson Player */}
        <div className="lg:col-span-3 space-y-3">
          {activeLesson ? (
            <Card>
              <h2 className="font-semibold text-slate-900 mb-1">{activeLesson.title}</h2>
              {activeLesson.duration && (
                <p className="text-xs text-slate-400 mb-3">{activeLesson.duration} min</p>
              )}

              {/* Video */}
              {activeLesson.videoUrl && (
                <div className="rounded-xl overflow-hidden bg-black aspect-video mb-4">
                  {activeLesson.videoUrl.includes("youtube.com") || activeLesson.videoUrl.includes("youtu.be") ? (
                    <iframe
                      src={activeLesson.videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : activeLesson.videoUrl.includes("vimeo") ? (
                    <iframe
                      src={activeLesson.videoUrl.replace("vimeo.com/", "player.vimeo.com/video/")}
                      className="w-full h-full"
                      allow="autoplay; fullscreen"
                      allowFullScreen
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <a
                        href={activeLesson.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-white text-sm hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open video
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Content */}
              {activeLesson.content && (
                <div className="prose prose-sm max-w-none text-slate-600 mb-4">
                  <p className="whitespace-pre-line text-sm">{activeLesson.content}</p>
                </div>
              )}

              {/* Action */}
              {completedIds.has(activeLesson.id) ? (
                <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Completed
                </div>
              ) : (
                <Button onClick={markComplete} loading={marking}>
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Complete
                </Button>
              )}
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-slate-400 text-center py-8">Select a lesson to begin</p>
            </Card>
          )}
        </div>

        {/* Lesson List */}
        <div className="lg:col-span-2 space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 mb-2">Lessons</p>
          {lessons.map((lesson, idx) => {
            const done = completedIds.has(lesson.id);
            const isActive = activeLesson?.id === lesson.id;
            const isLocked = idx > 0 && !completedIds.has(lessons[idx - 1].id);

            return (
              <button
                key={lesson.id}
                disabled={isLocked}
                onClick={() => !isLocked && setActiveLesson(lesson)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                  isActive
                    ? "bg-indigo-50 border border-indigo-200"
                    : isLocked
                    ? "opacity-50 cursor-not-allowed bg-slate-50"
                    : "hover:bg-slate-50 border border-transparent"
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  done ? "bg-green-100 text-green-600" : isActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                }`}>
                  {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : isLocked ? <Lock className="w-3 h-3" /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{lesson.title}</p>
                  {lesson.duration && (
                    <p className="text-xs text-slate-400">{lesson.duration} min</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
