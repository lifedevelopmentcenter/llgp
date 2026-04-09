"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection, query, where, getDocs, doc, getDoc,
  setDoc, updateDoc, orderBy, serverTimestamp, addDoc, deleteDoc,
} from "firebase/firestore";
import {
  ArrowLeft, CheckCircle2, Play, Lock, ExternalLink,
  Trophy, Share2, MessageSquare, Send, Notebook, Save, Trash2,
} from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageLoader } from "@/components/ui/Spinner";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import type { VentureCourse, VentureLesson, UserProgress, LessonComment, LessonNote } from "@/lib/types";

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

  // Notes
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteLoading, setNoteLoading] = useState(false);

  // Comments / discussion
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const lessonListRef = useRef<HTMLDivElement>(null);

  // ── Load course + progress ─────────────────────────────────────────────────
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

        const ls = lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as VentureLesson)).filter(l => l.isPublished);
        setLessons(ls);

        const done = new Set<string>();
        progressSnap.docs.forEach(d => { const p = d.data() as UserProgress; if (p.completed) done.add(p.lessonId); });
        setCompletedIds(done);

        // Auto-select first incomplete lesson (not just first)
        const firstIncomplete = ls.find(l => !done.has(l.id)) ?? ls[0];
        if (firstIncomplete) setActiveLesson(firstIncomplete);

      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [profile, courseId, router]);

  // ── Load notes when active lesson changes ─────────────────────────────────
  useEffect(() => {
    if (!profile || !activeLesson) return;
    const loadNote = async () => {
      setNoteLoading(true);
      try {
        const noteSnap = await getDoc(doc(db, COLLECTIONS.LESSON_NOTES, `${profile.id}_${activeLesson.id}`));
        setNoteText(noteSnap.exists() ? (noteSnap.data() as LessonNote).notes : "");
      } catch { setNoteText(""); }
      finally { setNoteLoading(false); }
    };
    loadNote();
  }, [activeLesson?.id, profile?.id]);

  // ── Load comments when active lesson changes ──────────────────────────────
  useEffect(() => {
    if (!activeLesson) return;
    const loadComments = async () => {
      setCommentsLoading(true);
      try {
        const snap = await getDocs(query(
          collection(db, COLLECTIONS.LESSON_COMMENTS),
          where("lessonId", "==", activeLesson.id),
          orderBy("createdAt", "asc"),
        ));
        setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as LessonComment)));
      } catch { setComments([]); }
      finally { setCommentsLoading(false); }
    };
    loadComments();
  }, [activeLesson?.id]);

  // ── Mark lesson complete ───────────────────────────────────────────────────
  const markComplete = async () => {
    if (!profile || !activeLesson || completedIds.has(activeLesson.id)) return;
    setMarking(true);
    try {
      const progressId = `${profile.id}_${activeLesson.id}`;
      await setDoc(doc(db, COLLECTIONS.USER_PROGRESS, progressId), {
        userId: profile.id, courseId, lessonId: activeLesson.id,
        completed: true, completedAt: serverTimestamp(), createdAt: serverTimestamp(),
      });
      const newDone = new Set([...completedIds, activeLesson.id]);
      setCompletedIds(newDone);
      toast.success("Lesson complete!");

      // Auto-advance to next incomplete lesson
      const currentIdx = lessons.findIndex(l => l.id === activeLesson.id);
      const next = lessons.slice(currentIdx + 1).find(l => !newDone.has(l.id));
      if (next) {
        setTimeout(() => {
          setActiveLesson(next);
          // Scroll the lesson row into view in the sidebar
          const el = document.getElementById(`lesson-${next.id}`);
          el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 400);
      }
    } catch { toast.error("Failed to save progress."); }
    finally { setMarking(false); }
  };

  // ── Save notes ─────────────────────────────────────────────────────────────
  const saveNote = async () => {
    if (!profile || !activeLesson) return;
    setSavingNote(true);
    try {
      await setDoc(doc(db, COLLECTIONS.LESSON_NOTES, `${profile.id}_${activeLesson.id}`), {
        userId: profile.id, lessonId: activeLesson.id, courseId,
        notes: noteText, updatedAt: serverTimestamp(),
      });
      toast.success("Notes saved.");
    } catch { toast.error("Failed to save notes."); }
    finally { setSavingNote(false); }
  };

  // ── Post comment ───────────────────────────────────────────────────────────
  const postComment = async () => {
    if (!profile || !activeLesson || !newComment.trim()) return;
    setPostingComment(true);
    const body = newComment.trim();
    setNewComment("");
    try {
      const ref = await addDoc(collection(db, COLLECTIONS.LESSON_COMMENTS), {
        lessonId: activeLesson.id, courseId,
        authorId: profile.id, authorName: profile.displayName,
        authorPhoto: profile.photoURL || null, body,
        createdAt: serverTimestamp(),
      });
      setComments(prev => [...prev, {
        id: ref.id, lessonId: activeLesson.id, courseId,
        authorId: profile.id, authorName: profile.displayName,
        authorPhoto: profile.photoURL || null, body, createdAt: null as any,
      }]);
    } catch { toast.error("Failed to post."); setNewComment(body); }
    finally { setPostingComment(false); }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.LESSON_COMMENTS, commentId));
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch { toast.error("Failed to delete."); }
  };

  const shareCertificate = () => {
    const text = `I just completed "${course?.title}" in the Leading Lights University Venture 100 programme! 🎓`;
    if (navigator.share) {
      navigator.share({ title: "Venture 100 Certificate", text });
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    }
  };

  if (loading) return <PageLoader />;
  if (!course) return null;

  const totalLessons = lessons.length;
  const completedCount = completedIds.size;
  const percentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const isFullyComplete = percentage === 100 && totalLessons > 0;

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/training" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 truncate">{course.title}</h1>
          <p className="text-xs text-slate-500">{completedCount}/{totalLessons} lessons complete</p>
        </div>
      </div>

      {/* Certificate card — shown when 100% complete */}
      {isFullyComplete && (
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-amber-400 via-orange-400 to-yellow-500 p-px">
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-0.5">Certificate of Completion</p>
                <p className="font-black text-slate-900 text-base leading-tight">{course.title}</p>
                <p className="text-sm text-slate-600 mt-0.5">Awarded to <span className="font-semibold text-slate-900">{profile?.displayName}</span></p>
                <p className="text-xs text-amber-700 mt-1 font-medium">Leading Lights University · Venture 100</p>
              </div>
            </div>
            <button
              onClick={shareCertificate}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors"
            >
              <Share2 className="w-4 h-4" />Share Certificate
            </button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {!isFullyComplete && (
        <Card>
          <ProgressBar value={percentage} showLabel color="indigo" />
        </Card>
      )}

      {/* Main layout */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* ── Lesson player ── */}
        <div className="lg:col-span-3 space-y-4">
          {activeLesson ? (
            <>
              <Card>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h2 className="font-bold text-slate-900 text-base leading-tight">{activeLesson.title}</h2>
                  {completedIds.has(activeLesson.id) && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" />Done
                    </span>
                  )}
                </div>
                {activeLesson.duration && (
                  <p className="text-xs text-slate-400 mb-3">~{activeLesson.duration} min read/watch</p>
                )}

                {/* Video embed */}
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
                        <a href={activeLesson.videoUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-white text-sm hover:underline">
                          <ExternalLink className="w-4 h-4" />Open video
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Content */}
                {activeLesson.content && (
                  <div className="prose prose-sm max-w-none text-slate-600 mb-4">
                    <p className="whitespace-pre-line text-sm leading-relaxed">{activeLesson.content}</p>
                  </div>
                )}

                {/* Mark complete */}
                {!completedIds.has(activeLesson.id) && (
                  <Button onClick={markComplete} loading={marking} className="w-full sm:w-auto">
                    <CheckCircle2 className="w-4 h-4" />Mark as Complete
                  </Button>
                )}
              </Card>

              {/* ── Notes ── */}
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Notebook className="w-4 h-4 text-indigo-500" />
                  <p className="text-sm font-bold text-slate-900">My Notes</p>
                  <span className="text-xs text-slate-400 ml-1">private</span>
                </div>
                {noteLoading ? (
                  <div className="h-20 bg-slate-50 rounded-xl animate-pulse" />
                ) : (
                  <>
                    <textarea
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-slate-50 focus:bg-white transition-colors"
                      rows={4}
                      placeholder="Jot down your thoughts, key takeaways, or action points…"
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                    />
                    <div className="flex justify-end mt-2">
                      <Button size="sm" variant="secondary" onClick={saveNote} loading={savingNote} disabled={!noteText.trim()}>
                        <Save className="w-3.5 h-3.5" />Save Notes
                      </Button>
                    </div>
                  </>
                )}
              </Card>

              {/* ── Discussion ── */}
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-4 h-4 text-indigo-500" />
                  <p className="text-sm font-bold text-slate-900">Discussion</p>
                  {comments.length > 0 && (
                    <span className="text-xs text-slate-400">{comments.length} comment{comments.length !== 1 ? "s" : ""}</span>
                  )}
                </div>

                {commentsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map(i => <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />)}
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No comments yet. Start the conversation!</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-2.5">
                        <Avatar name={c.authorName} photoURL={c.authorPhoto} size="xs" className="flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <p className="text-xs font-bold text-slate-900">{c.authorName}</p>
                            <p className="text-[10px] text-slate-400">{timeAgo(c.createdAt)}</p>
                          </div>
                          <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{c.body}</p>
                        </div>
                        {(c.authorId === profile?.id || profile?.role === "global_admin") && (
                          <button onClick={() => deleteComment(c.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Post comment */}
                <div className="flex gap-2 pt-3 border-t border-slate-50">
                  <Avatar name={profile?.displayName ?? "?"} photoURL={profile?.photoURL} size="xs" className="flex-shrink-0 mt-1" />
                  <div className="flex-1 flex gap-2">
                    <input
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                      placeholder="Share a thought or question…"
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                      disabled={postingComment}
                    />
                    <button
                      onClick={postComment}
                      disabled={!newComment.trim() || postingComment}
                      className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center transition-colors flex-shrink-0"
                    >
                      <Send className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <p className="text-sm text-slate-400 text-center py-8">Select a lesson to begin</p>
            </Card>
          )}
        </div>

        {/* ── Lesson list ── */}
        <div className="lg:col-span-2" ref={lessonListRef}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1 mb-2">Lessons</p>
          <div className="space-y-1">
            {lessons.map((lesson, idx) => {
              const done = completedIds.has(lesson.id);
              const isActive = activeLesson?.id === lesson.id;
              const isLocked = idx > 0 && !completedIds.has(lessons[idx - 1].id);

              return (
                <button
                  id={`lesson-${lesson.id}`}
                  key={lesson.id}
                  disabled={isLocked}
                  onClick={() => !isLocked && setActiveLesson(lesson)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                    isActive ? "bg-indigo-50 border border-indigo-200"
                    : isLocked ? "opacity-50 cursor-not-allowed bg-slate-50"
                    : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    done ? "bg-green-100 text-green-600"
                    : isActive ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-100 text-slate-500"
                  }`}>
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : isLocked ? <Lock className="w-3 h-3" /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{lesson.title}</p>
                    {lesson.duration && <p className="text-xs text-slate-400">~{lesson.duration} min</p>}
                  </div>
                  {isActive && !done && <Play className="w-3 h-3 text-indigo-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
