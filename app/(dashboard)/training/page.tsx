"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection, getDocs, orderBy, query, where, addDoc, updateDoc,
  doc, setDoc, getDoc, limit, serverTimestamp,
} from "firebase/firestore";
import {
  BookOpen, ChevronRight, Lock, CheckCircle2, Play, Users,
  ExternalLink, GraduationCap, ArrowRight, Trophy, Filter,
} from "lucide-react";
import toast from "react-hot-toast";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import type { VentureCourse, UserProgress, CommunityCourse } from "@/lib/types";

interface CourseWithProgress extends VentureCourse {
  completedLessons: number;
  percentage: number;
}

const CATEGORIES = [
  "Leadership", "Business", "Ministry", "Technology",
  "Health & Wellness", "Arts & Culture", "Other",
];

const MODULE_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-teal-500 to-emerald-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-500",
  "from-blue-500 to-cyan-600",
  "from-violet-500 to-purple-600",
  "from-green-500 to-teal-600",
];

// ─── Community Courses ─────────────────────────────────────────────────────────

function CommunityCoursesSection() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<CommunityCourse[]>([]);
  const [pendingCourses, setPendingCourses] = useState<CommunityCourse[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [form, setForm] = useState({
    title: "", description: "", category: "Leadership",
    externalUrl: "", tags: "", thumbnailUrl: "",
  });

  const isAdmin = profile?.role === "global_admin";

  const loadCourses = async () => {
    if (!profile) return;
    try {
      const [publishedSnap, enrolledSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.COMMUNITY_COURSES), where("status", "==", "published"), orderBy("createdAt", "desc"), limit(50))),
        getDocs(query(collection(db, COLLECTIONS.COURSE_ENROLLMENTS), where("userId", "==", profile.id))),
      ]);
      setCourses(publishedSnap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityCourse)));
      setEnrolledIds(new Set(enrolledSnap.docs.map(d => (d.data() as any).courseId as string)));

      if (isAdmin) {
        const pendingSnap = await getDocs(query(collection(db, COLLECTIONS.COMMUNITY_COURSES), where("status", "==", "pending"), orderBy("createdAt", "desc")));
        setPendingCourses(pendingSnap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityCourse)));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCourses(); }, [profile?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required."); return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, COLLECTIONS.COMMUNITY_COURSES), {
        title: form.title.trim(), description: form.description.trim(),
        instructorId: profile.id, instructorName: profile.displayName,
        instructorPhoto: profile.photoURL ?? null,
        category: form.category,
        thumbnailUrl: form.thumbnailUrl || null,
        externalUrl: form.externalUrl.trim() || null,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        status: "pending", enrollmentCount: 0, lessonCount: 0,
        nationId: profile.nationId ?? null, nationName: profile.nationName ?? null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      toast.success("Course submitted! It will be reviewed by an admin.");
      setShowModal(false);
      setForm({ title: "", description: "", category: "Leadership", externalUrl: "", tags: "", thumbnailUrl: "" });
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally { setSubmitting(false); }
  };

  const handleApprove = async (courseId: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.COMMUNITY_COURSES, courseId), { status: "published", updatedAt: serverTimestamp() });
      toast.success("Course published!");
      setPendingCourses(prev => prev.filter(c => c.id !== courseId));
      loadCourses();
    } catch { toast.error("Failed to approve course."); }
  };

  const handleEnroll = async (course: CommunityCourse) => {
    if (!profile) return;
    const enrollId = `${course.id}_${profile.id}`;
    if (enrolledIds.has(course.id)) {
      // Already enrolled — just open link
      if (course.externalUrl) window.open(course.externalUrl, "_blank", "noopener");
      return;
    }
    try {
      await setDoc(doc(db, COLLECTIONS.COURSE_ENROLLMENTS, enrollId), {
        courseId: course.id, userId: profile.id,
        courseName: course.title, enrolledAt: serverTimestamp(),
      });
      await updateDoc(doc(db, COLLECTIONS.COMMUNITY_COURSES, course.id), { enrollmentCount: (course.enrollmentCount || 0) + 1 });
      setEnrolledIds(prev => new Set([...prev, course.id]));
      setCourses(prev => prev.map(c => c.id === course.id ? { ...c, enrollmentCount: c.enrollmentCount + 1 } : c));
      if (course.externalUrl) window.open(course.externalUrl, "_blank", "noopener");
      toast.success("Enrolled!");
    } catch { toast.error("Failed to enrol."); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const filtered = categoryFilter === "All" ? courses : courses.filter(c => c.category === categoryFilter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Community Courses</p>
          <p className="text-xs text-slate-500">{courses.length} course{courses.length !== 1 ? "s" : ""} by LL members</p>
        </div>
        {profile && (
          <Button size="sm" onClick={() => setShowModal(true)}>+ Submit Course</Button>
        )}
      </div>

      {/* Category filter */}
      {courses.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {["All", ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                categoryFilter === cat
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Admin pending */}
      {isAdmin && pendingCourses.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Pending Review ({pendingCourses.length})</p>
          {pendingCourses.map(course => (
            <Card key={course.id} className="border-amber-200 bg-amber-50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">{course.title}</p>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{course.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Avatar name={course.instructorName} photoURL={course.instructorPhoto} size="xs" />
                    <span className="text-xs text-slate-500">{course.instructorName}</span>
                    <Badge variant="warning">{course.category}</Badge>
                  </div>
                </div>
                <Button size="sm" onClick={() => handleApprove(course.id)}>Approve</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Course grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={<GraduationCap className="w-6 h-6" />}
          title={categoryFilter === "All" ? "No community courses yet" : `No ${categoryFilter} courses yet`}
          description="Be the first to submit a course." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map(course => (
            <CommunityCourseCard key={course.id} course={course}
              enrolled={enrolledIds.has(course.id)} onEnroll={() => handleEnroll(course)} />
          ))}
        </div>
      )}

      {/* Submit modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Submit a Community Course" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Thumbnail upload */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-2">Course Thumbnail</label>
            <div className="flex items-center gap-3">
              {form.thumbnailUrl ? (
                <img src={form.thumbnailUrl} className="w-24 h-16 object-cover rounded-xl border border-slate-200" alt="Thumbnail" />
              ) : (
                <div className="w-24 h-16 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-5 h-5 text-slate-400" />
                </div>
              )}
              <ImageUpload
                currentUrl={null}
                storagePath={`communityCourses/pending/${profile?.id}_${Date.now()}`}
                onUploadComplete={url => setForm(f => ({ ...f, thumbnailUrl: url }))}
                shape="rect"
                size="sm"
                placeholder={<span className="text-xs text-slate-500">Upload image</span>}
              />
            </div>
          </div>
          <Input label="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Marketplace Leadership 101" required />
          <Textarea label="Description *" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What will students learn?" rows={3} required />
          <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </Select>
          <Input label="External URL (optional)" value={form.externalUrl} onChange={e => setForm(f => ({ ...f, externalUrl: e.target.value }))} placeholder="https://..." type="url" />
          <Input label="Tags (comma-separated)" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="leadership, faith, business" />
          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={submitting} className="flex-1">Submit Course</Button>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function CommunityCourseCard({ course, enrolled, onEnroll }: {
  course: CommunityCourse; enrolled: boolean; onEnroll: () => void;
}) {
  const gradients = [
    "from-indigo-400 to-purple-500", "from-rose-400 to-pink-500",
    "from-amber-400 to-orange-500", "from-teal-400 to-cyan-500", "from-emerald-400 to-green-500",
  ];
  let hash = 0;
  for (let i = 0; i < course.title.length; i++) hash += course.title.charCodeAt(i);
  const gradient = gradients[hash % gradients.length];

  return (
    <Card className="flex flex-col gap-0 p-0 overflow-hidden">
      {course.thumbnailUrl ? (
        <img src={course.thumbnailUrl} alt={course.title} className="w-full h-28 object-cover" />
      ) : (
        <div className={`w-full h-28 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <GraduationCap className="w-8 h-8 text-white/80" />
        </div>
      )}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="font-semibold text-slate-900 text-sm line-clamp-2 leading-snug">{course.title}</p>
        <div className="flex items-center gap-1.5">
          <Avatar name={course.instructorName} photoURL={course.instructorPhoto} size="xs" />
          <span className="text-xs text-slate-500 truncate">{course.instructorName}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="info">{course.category}</Badge>
          <span className="text-xs text-slate-400 flex items-center gap-0.5">
            <Users className="w-3 h-3" />{course.enrollmentCount} enrolled
          </span>
        </div>
        <div className="mt-auto pt-1">
          {course.externalUrl ? (
            <button onClick={onEnroll}
              className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${enrolled ? "text-green-600 hover:text-green-700" : "text-indigo-600 hover:text-indigo-700"}`}>
              {enrolled ? <><CheckCircle2 className="w-3 h-3" />Enrolled — Open<ExternalLink className="w-3 h-3" /></> : <>Enrol <ExternalLink className="w-3 h-3" /></>}
            </button>
          ) : (
            <span className="text-xs text-slate-400 italic">No link yet</span>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Main Training Page ────────────────────────────────────────────────────────

export default function TrainingPage() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"venture100" | "community">("venture100");

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      try {
        const [coursesSnap, progressSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.VENTURE_COURSES), orderBy("order"))),
          getDocs(query(collection(db, COLLECTIONS.USER_PROGRESS), where("userId", "==", profile.id))),
        ]);
        const progressMap: Record<string, number> = {};
        progressSnap.docs.forEach(d => {
          const p = d.data() as UserProgress;
          if (p.completed) progressMap[p.courseId] = (progressMap[p.courseId] || 0) + 1;
        });
        const list: CourseWithProgress[] = coursesSnap.docs
          .map(d => {
            const c = { id: d.id, ...d.data() } as VentureCourse;
            const done = progressMap[c.id] || 0;
            return { ...c, completedLessons: done, percentage: c.totalLessons > 0 ? Math.round((done / c.totalLessons) * 100) : 0 };
          })
          .filter(c => c.isPublished);
        setCourses(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [profile]);

  if (loading) return <PageLoader />;

  const totalCompleted = courses.filter(c => c.percentage === 100).length;
  const resumeCourse = courses.find(c => c.percentage > 0 && c.percentage < 100) ?? courses.find(c => c.percentage === 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-0.5">Leading Lights University</p>
          <h1 className="text-xl font-bold text-slate-900">Courses</h1>
          <p className="text-sm text-slate-500 mt-0.5">Train, grow and earn your certification</p>
        </div>
        {profile?.role === "global_admin" && (
          <Link href="/admin/courses" className="text-sm text-indigo-600 font-medium hover:text-indigo-700">Manage →</Link>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(["venture100", "community"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${activeTab === t ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            {t === "venture100" ? "Venture 100" : "Community Courses"}
          </button>
        ))}
      </div>

      {/* ── Venture 100 ── */}
      {activeTab === "venture100" && (
        <div className="space-y-4">
          {/* Resume card */}
          {resumeCourse && courses.some(c => c.percentage > 0 && c.percentage < 100) && (
            <Link href={`/training/${resumeCourse.id}`}>
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-4 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Play className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Continue Learning</p>
                  <p className="text-sm font-bold text-white truncate">{resumeCourse.title}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 bg-white/20 rounded-full h-1.5">
                      <div className="bg-white rounded-full h-1.5 transition-all" style={{ width: `${resumeCourse.percentage}%` }} />
                    </div>
                    <span className="text-xs text-indigo-200 font-semibold flex-shrink-0">{resumeCourse.percentage}%</span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-white/70 flex-shrink-0" />
              </div>
            </Link>
          )}

          {/* Overall progress banner */}
          {courses.length > 0 && (
            <Card className={totalCompleted === courses.length && courses.length > 0 ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-100" : "bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100"}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Overall Progress</p>
                  <p className="text-xs text-slate-500">{totalCompleted} of {courses.length} modules complete</p>
                </div>
                {totalCompleted === courses.length && courses.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1.5 rounded-full">
                    <Trophy className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">Certified!</span>
                  </div>
                )}
              </div>
              <ProgressBar value={courses.length > 0 ? Math.round((totalCompleted / courses.length) * 100) : 0} showLabel color="indigo" />
            </Card>
          )}

          {/* Course list */}
          {courses.length === 0 ? (
            <EmptyState icon={<BookOpen className="w-6 h-6" />} title="No courses available yet" description="Training content will be published soon." />
          ) : (
            <div className="space-y-3">
              {courses.map((course, index) => {
                const isLocked = index > 0 && courses[index - 1].percentage < 100;
                const isCompleted = course.percentage === 100;
                const inProgress = course.percentage > 0 && !isCompleted;
                const gradient = MODULE_GRADIENTS[index % MODULE_GRADIENTS.length];

                return (
                  <div key={course.id}>
                    {isLocked ? (
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 opacity-60 cursor-not-allowed">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-400">
                            <Lock className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-700 text-sm">{course.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">Complete previous module to unlock</p>
                          </div>
                          <Badge variant="default">Locked</Badge>
                        </div>
                      </div>
                    ) : (
                      <Link href={`/training/${course.id}`}>
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer overflow-hidden">
                          <div className="flex items-center gap-0">
                            {/* Mini cover */}
                            <div className={`w-14 h-[88px] flex-shrink-0 bg-gradient-to-br ${gradient} flex flex-col items-center justify-center`}>
                              {course.coverImage ? (
                                <img src={course.coverImage} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <>
                                  <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">M</span>
                                  <span className="text-white text-xl font-black leading-none">{index + 1}</span>
                                </>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 px-4 py-3">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="font-semibold text-slate-900 text-sm">{course.title}</p>
                                {isCompleted && <Badge variant="success">Done</Badge>}
                                {inProgress && <Badge variant="info">In Progress</Badge>}
                              </div>
                              {course.description && (
                                <p className="text-xs text-slate-500 line-clamp-1 mb-2">{course.description}</p>
                              )}
                              <ProgressBar value={course.percentage} size="sm" />
                              <p className="text-xs text-slate-400 mt-1">{course.completedLessons}/{course.totalLessons} lessons</p>
                            </div>
                            <div className="pr-4 flex-shrink-0">
                              {isCompleted
                                ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                                : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </div>
                          </div>
                        </div>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Community Courses ── */}
      {activeTab === "community" && <CommunityCoursesSection />}
    </div>
  );
}
