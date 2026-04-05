"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  addDoc,
  updateDoc,
  doc,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import {
  BookOpen,
  ChevronRight,
  Lock,
  CheckCircle2,
  Play,
  Users,
  ExternalLink,
  GraduationCap,
} from "lucide-react";
import toast from "react-hot-toast";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
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

// ─────────────────────────────────────────────────────────────
// Community Courses Section
// ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Leadership",
  "Business",
  "Ministry",
  "Technology",
  "Health & Wellness",
  "Arts & Culture",
  "Other",
];

interface SubmitForm {
  title: string;
  description: string;
  category: string;
  externalUrl: string;
  tags: string;
}

function CommunityCoursesSection() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<CommunityCourse[]>([]);
  const [pendingCourses, setPendingCourses] = useState<CommunityCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<SubmitForm>({
    title: "",
    description: "",
    category: "Leadership",
    externalUrl: "",
    tags: "",
  });

  const isAdmin = profile?.role === "global_admin";

  const loadCourses = async () => {
    try {
      const publishedQ = query(
        collection(db, COLLECTIONS.COMMUNITY_COURSES),
        where("status", "==", "published"),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const snap = await getDocs(publishedQ);
      setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CommunityCourse)));

      if (isAdmin) {
        const pendingQ = query(
          collection(db, COLLECTIONS.COMMUNITY_COURSES),
          where("status", "==", "pending"),
          orderBy("createdAt", "desc")
        );
        const pendingSnap = await getDocs(pendingQ);
        setPendingCourses(
          pendingSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CommunityCourse))
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required.");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, COLLECTIONS.COMMUNITY_COURSES), {
        title: form.title.trim(),
        description: form.description.trim(),
        instructorId: profile.id,
        instructorName: profile.displayName,
        instructorPhoto: profile.photoURL ?? null,
        category: form.category,
        externalUrl: form.externalUrl.trim() || null,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        status: "pending",
        enrollmentCount: 0,
        lessonCount: 0,
        nationId: profile.nationId ?? null,
        nationName: profile.nationName ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Course submitted! It will be reviewed by an admin.");
      setShowModal(false);
      setForm({ title: "", description: "", category: "Leadership", externalUrl: "", tags: "" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit course. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (courseId: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.COMMUNITY_COURSES, courseId), {
        status: "published",
        updatedAt: serverTimestamp(),
      });
      toast.success("Course published!");
      setPendingCourses((prev) => prev.filter((c) => c.id !== courseId));
      loadCourses();
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve course.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Community Courses</p>
          <p className="text-xs text-slate-500">Courses submitted by Leading Lights members</p>
        </div>
        {profile && (
          <Button size="sm" onClick={() => setShowModal(true)}>
            + Submit Your Course
          </Button>
        )}
      </div>

      {/* Admin: Pending courses */}
      {isAdmin && pendingCourses.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600">
            Pending Review ({pendingCourses.length})
          </p>
          {pendingCourses.map((course) => (
            <Card key={course.id} className="border-amber-200 bg-amber-50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">{course.title}</p>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{course.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Avatar
                      name={course.instructorName}
                      photoURL={course.instructorPhoto}
                      size="xs"
                    />
                    <span className="text-xs text-slate-500">{course.instructorName}</span>
                    <Badge variant="warning">{course.category}</Badge>
                  </div>
                </div>
                <Button size="sm" onClick={() => handleApprove(course.id)}>
                  Approve
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Published courses grid */}
      {courses.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="w-6 h-6" />}
          title="No community courses yet"
          description="Be the first to submit a course for the Leading Lights community."
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}

      {/* Submit modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Submit a Community Course"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Marketplace Leadership 101"
            required
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What will students learn?"
            rows={3}
            required
          />
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
          <Input
            label="External URL (optional)"
            value={form.externalUrl}
            onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))}
            placeholder="https://youtube.com/playlist?list=..."
            type="url"
          />
          <Input
            label="Tags (comma-separated)"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="leadership, faith, business"
          />
          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={submitting} className="flex-1">
              Submit Course
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function CourseCard({ course }: { course: CommunityCourse }) {
  const gradients = [
    "from-indigo-400 to-purple-500",
    "from-rose-400 to-pink-500",
    "from-amber-400 to-orange-500",
    "from-teal-400 to-cyan-500",
    "from-emerald-400 to-green-500",
  ];
  let hash = 0;
  for (let i = 0; i < course.title.length; i++) hash += course.title.charCodeAt(i);
  const gradient = gradients[hash % gradients.length];

  return (
    <Card className="flex flex-col gap-0 p-0 overflow-hidden">
      {/* Thumbnail */}
      {course.thumbnailUrl ? (
        <img
          src={course.thumbnailUrl}
          alt={course.title}
          className="w-full h-32 object-cover"
        />
      ) : (
        <div className={`w-full h-32 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <GraduationCap className="w-8 h-8 text-white/80" />
        </div>
      )}

      {/* Content */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="font-semibold text-slate-900 text-sm line-clamp-2 leading-snug">
          {course.title}
        </p>

        {/* Instructor */}
        <div className="flex items-center gap-1.5">
          <Avatar name={course.instructorName} photoURL={course.instructorPhoto} size="xs" />
          <span className="text-xs text-slate-500 truncate">{course.instructorName}</span>
        </div>

        {/* Category + enrollment */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="info">{course.category}</Badge>
          <span className="text-xs text-slate-400 flex items-center gap-0.5">
            <Users className="w-3 h-3" />
            {course.enrollmentCount}
          </span>
        </div>

        {/* Enroll button */}
        <div className="mt-auto pt-1">
          {course.externalUrl ? (
            <a
              href={course.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Enroll <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-xs text-slate-400 italic">No link yet</span>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Training Page
// ─────────────────────────────────────────────────────────────

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
        progressSnap.docs.forEach((d) => {
          const p = d.data() as UserProgress;
          if (p.userId === profile.id && p.completed) {
            progressMap[p.courseId] = (progressMap[p.courseId] || 0) + 1;
          }
        });

        const list: CourseWithProgress[] = coursesSnap.docs
          .map((d) => {
            const c = { id: d.id, ...d.data() } as VentureCourse;
            const done = progressMap[c.id] || 0;
            return {
              ...c,
              completedLessons: done,
              percentage: c.totalLessons > 0 ? Math.round((done / c.totalLessons) * 100) : 0,
            };
          })
          .filter((c) => c.isPublished);

        setCourses(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile]);

  if (loading) return <PageLoader />;

  const totalCompleted = courses.filter((c) => c.percentage === 100).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-0.5">
            Leading Lights University
          </p>
          <h1 className="text-xl font-bold text-slate-900">Venture 100</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Complete all modules to earn your Venture 100 certification
          </p>
        </div>
        {profile?.role === "global_admin" && (
          <Link href="/admin/courses" className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
            Manage →
          </Link>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("venture100")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
            activeTab === "venture100"
              ? "bg-white shadow-sm text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Venture 100
        </button>
        <button
          onClick={() => setActiveTab("community")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
            activeTab === "community"
              ? "bg-white shadow-sm text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Community Courses
        </button>
      </div>

      {/* Venture 100 tab */}
      {activeTab === "venture100" && (
        <>
          {/* Progress Banner */}
          {courses.length > 0 && (
            <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Overall Progress</p>
                  <p className="text-xs text-slate-500">
                    {totalCompleted} of {courses.length} modules complete
                  </p>
                </div>
                {totalCompleted === courses.length && courses.length > 0 && (
                  <Badge variant="success">Certified!</Badge>
                )}
              </div>
              <ProgressBar
                value={courses.length > 0 ? Math.round((totalCompleted / courses.length) * 100) : 0}
                showLabel
                color="indigo"
              />
            </Card>
          )}

          {/* Course List */}
          {courses.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-6 h-6" />}
              title="No courses available yet"
              description="Training content will be published soon."
            />
          ) : (
            <div className="space-y-3">
              {courses.map((course, index) => {
                const isLocked = index > 0 && courses[index - 1].percentage < 100;
                const isCompleted = course.percentage === 100;
                const inProgress = course.percentage > 0 && !isCompleted;

                return (
                  <div key={course.id}>
                    {isLocked ? (
                      <Card className="opacity-60 cursor-not-allowed">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <Lock className="w-4 h-4 text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-700 text-sm">{course.title}</p>
                            <p className="text-xs text-slate-400">
                              Complete previous module to unlock
                            </p>
                          </div>
                          <Badge variant="default">Locked</Badge>
                        </div>
                      </Card>
                    ) : (
                      <Link href={`/training/${course.id}`}>
                        <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer">
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                isCompleted
                                  ? "bg-green-100"
                                  : inProgress
                                  ? "bg-indigo-100"
                                  : "bg-slate-100"
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                              ) : (
                                <Play className="w-4 h-4 text-indigo-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="font-medium text-slate-900 text-sm">{course.title}</p>
                                {isCompleted && <Badge variant="success">Done</Badge>}
                                {inProgress && <Badge variant="info">In Progress</Badge>}
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-1">
                                {course.description}
                              </p>
                              <div className="mt-2">
                                <ProgressBar value={course.percentage} size="sm" />
                                <p className="text-xs text-slate-400 mt-1">
                                  {course.completedLessons}/{course.totalLessons} lessons
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          </div>
                        </Card>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Community Courses tab */}
      {activeTab === "community" && <CommunityCoursesSection />}
    </div>
  );
}
