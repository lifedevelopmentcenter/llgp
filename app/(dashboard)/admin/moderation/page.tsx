"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, orderBy, where,
  deleteDoc, doc, updateDoc,
} from "firebase/firestore";
import {
  Shield, Flag, BookOpen, Star, Check, X, Trash2, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { PageLoader } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Report, Spotlight, CommunityCourse } from "@/lib/types";

type TabKey = "reports" | "spotlights" | "courses";

export default function ModerationPage() {
  const { profile } = useAuth();

  const [tab, setTab] = useState<TabKey>("reports");
  const [loading, setLoading] = useState(true);

  const [reports, setReports] = useState<Report[]>([]);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [courses, setCourses] = useState<CommunityCourse[]>([]);

  // Access guard
  if (profile && profile.role !== "global_admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-700">Access Denied</h2>
          <p className="text-sm text-slate-400 mt-1">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [reportsSnap, spotlightsSnap, coursesSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.REPORTS), orderBy("createdAt", "desc"))),
          getDocs(query(collection(db, COLLECTIONS.SPOTLIGHTS), where("isApproved", "==", false))),
          getDocs(query(collection(db, COLLECTIONS.COMMUNITY_COURSES), where("status", "==", "pending"))),
        ]);
        setReports(reportsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
        setSpotlights(spotlightsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Spotlight)));
        setCourses(coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityCourse)));
      } catch (e) {
        console.error(e);
        toast.error("Failed to load moderation data.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Report actions ──────────────────────────────────────────
  const dismissReport = async (reportId: string) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.REPORTS, reportId));
      setReports(prev => prev.filter(r => r.id !== reportId));
      toast.success("Report dismissed.");
    } catch (e) {
      toast.error("Failed to dismiss report.");
    }
  };

  const removePost = async (report: Report) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.POSTS, report.postId));
      await deleteDoc(doc(db, COLLECTIONS.REPORTS, report.id));
      setReports(prev => prev.filter(r => r.id !== report.id));
      toast.success("Post removed.");
    } catch (e) {
      toast.error("Failed to remove post.");
    }
  };

  // ── Spotlight actions ───────────────────────────────────────
  const approveSpotlight = async (id: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.SPOTLIGHTS, id), { isApproved: true });
      setSpotlights(prev => prev.filter(s => s.id !== id));
      toast.success("Spotlight approved.");
    } catch (e) {
      toast.error("Failed to approve spotlight.");
    }
  };

  const rejectSpotlight = async (id: string) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.SPOTLIGHTS, id));
      setSpotlights(prev => prev.filter(s => s.id !== id));
      toast.success("Spotlight rejected.");
    } catch (e) {
      toast.error("Failed to reject spotlight.");
    }
  };

  // ── Course actions ──────────────────────────────────────────
  const approveCourse = async (id: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.COMMUNITY_COURSES, id), { status: "published" });
      setCourses(prev => prev.map(c => c.id === id ? { ...c, status: "published" as const } : c));
      toast.success("Course approved and published.");
    } catch (e) {
      toast.error("Failed to approve course.");
    }
  };

  const rejectCourse = async (id: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.COMMUNITY_COURSES, id), { status: "rejected" });
      setCourses(prev => prev.filter(c => c.id !== id));
      toast.success("Course rejected.");
    } catch (e) {
      toast.error("Failed to reject course.");
    }
  };

  if (loading || !profile) return <PageLoader />;

  const TABS: { key: TabKey; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "reports", label: "Reported Posts", icon: <Flag className="w-4 h-4" />, count: reports.length },
    { key: "spotlights", label: "Pending Spotlights", icon: <Star className="w-4 h-4" />, count: spotlights.length },
    { key: "courses", label: "Pending Courses", icon: <BookOpen className="w-4 h-4" />, count: courses.length },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Shield className="w-5 h-5 text-indigo-600" />
          <h1 className="text-xl font-black text-slate-900">Content Moderation</h1>
        </div>
        <p className="text-sm text-slate-400">Review reported content and pending approvals</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 p-1 shadow-sm">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
              tab === t.key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            {t.count > 0 && (
              <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                tab === t.key ? "bg-white/20 text-white" : "bg-rose-100 text-rose-600"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── SECTION 1: Reported Posts ── */}
      {tab === "reports" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">
              Reported Posts
              <span className="ml-2 text-xs font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full normal-case tracking-normal">{reports.length}</span>
            </h2>
          </div>
          {reports.length === 0 ? (
            <Card>
              <div className="py-10 text-center">
                <Flag className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">No reported posts</p>
                <p className="text-xs text-slate-400 mt-0.5">The community is looking clean!</p>
              </div>
            </Card>
          ) : (
            reports.map(report => (
              <Card key={report.id} className="rounded-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-slate-900">{report.reporterName}</span>
                      <span className="text-xs text-slate-400">{timeAgo(report.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-1">
                      <span className="font-semibold text-slate-700">Reason:</span> {report.reason}
                    </p>
                    <p className="text-xs text-slate-400">
                      Post ID: <span className="font-mono text-slate-500">{report.postId}</span>
                      {" · "}Type: <span className="capitalize">{report.postType}</span>
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    <Link href="/feed">
                      <Button size="sm" variant="secondary">
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Post
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => dismissReport(report.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      className="!bg-red-600 hover:!bg-red-700 !text-white"
                      onClick={() => removePost(report)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove Post
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── SECTION 2: Pending Spotlights ── */}
      {tab === "spotlights" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">
              Pending Spotlights
              <span className="ml-2 text-xs font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full normal-case tracking-normal">{spotlights.length}</span>
            </h2>
          </div>
          {spotlights.length === 0 ? (
            <Card>
              <div className="py-10 text-center">
                <Star className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">No pending spotlights</p>
                <p className="text-xs text-slate-400 mt-0.5">All spotlights have been reviewed.</p>
              </div>
            </Card>
          ) : (
            spotlights.map(spotlight => (
              <Card key={spotlight.id} className="rounded-2xl">
                <div className="flex items-start gap-4">
                  {/* Thumbnail or type icon */}
                  <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                    {spotlight.thumbnailUrl ? (
                      <img src={spotlight.thumbnailUrl} alt={spotlight.title} className="w-full h-full object-cover" />
                    ) : (
                      <Star className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{spotlight.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{spotlight.personName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full capitalize">{spotlight.type}</span>
                      <a
                        href={spotlight.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open link
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className="!bg-emerald-600 hover:!bg-emerald-700 !text-white"
                      onClick={() => approveSpotlight(spotlight.id)}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      className="!bg-red-600 hover:!bg-red-700 !text-white"
                      onClick={() => rejectSpotlight(spotlight.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── SECTION 3: Pending Courses ── */}
      {tab === "courses" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">
              Pending Community Courses
              <span className="ml-2 text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full normal-case tracking-normal">{courses.length}</span>
            </h2>
          </div>
          {courses.length === 0 ? (
            <Card>
              <div className="py-10 text-center">
                <BookOpen className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">No pending courses</p>
                <p className="text-xs text-slate-400 mt-0.5">All course submissions have been reviewed.</p>
              </div>
            </Card>
          ) : (
            courses.map(course => (
              <Card key={course.id} className="rounded-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm">{course.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{course.instructorName}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{course.category}</span>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full capitalize">{course.status}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className="!bg-emerald-600 hover:!bg-emerald-700 !text-white"
                      onClick={() => approveCourse(course.id)}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      className="!bg-red-600 hover:!bg-red-700 !text-white"
                      onClick={() => rejectCourse(course.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
