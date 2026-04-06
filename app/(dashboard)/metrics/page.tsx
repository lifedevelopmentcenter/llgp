"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  getCountFromServer,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
} from "firebase/firestore";
import { Users, FileText, Users2, Calendar, BarChart2, Globe } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { PageLoader } from "@/components/ui/Spinner";
import { ROLE_LABELS } from "@/lib/types";
import { getRoleColor, formatDate, formatNumber, truncate } from "@/lib/utils";
import type { UserProfile, Post } from "@/lib/types";

export default function MetricsPage() {
  return (
    <AuthGuard requiredRoles={["global_admin", "national_leader", "city_leader"]}>
      <MetricsContent />
    </AuthGuard>
  );
}

interface MetricStats {
  totalMembers: number;
  postsThisWeek: number;
  activeGroups: number;
  upcomingEvents: number;
}

function MetricsContent() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<MetricStats | null>(null);
  const [recentMembers, setRecentMembers] = useState<UserProfile[]>([]);
  const [topPosts, setTopPosts] = useState<Post[]>([]);
  const [nations, setNations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const sevenDaysAgoTs = Timestamp.fromDate(sevenDaysAgo);
        const nowTs = Timestamp.fromDate(now);

        const [
          totalMembersSnap,
          postsThisWeekSnap,
          activeGroupsSnap,
          upcomingEventsSnap,
          recentMembersSnap,
          topPostsSnap,
          allUsersSnap,
        ] = await Promise.all([
          getCountFromServer(collection(db, COLLECTIONS.USERS)),
          getCountFromServer(
            query(
              collection(db, COLLECTIONS.POSTS),
              where("createdAt", ">", sevenDaysAgoTs)
            )
          ),
          getCountFromServer(collection(db, COLLECTIONS.GROUPS)),
          getCountFromServer(
            query(
              collection(db, COLLECTIONS.EVENTS),
              where("startDate", ">", nowTs)
            )
          ),
          getDocs(
            query(
              collection(db, COLLECTIONS.USERS),
              orderBy("createdAt", "desc"),
              limit(10)
            )
          ),
          getDocs(
            query(
              collection(db, COLLECTIONS.POSTS),
              where("createdAt", ">", sevenDaysAgoTs),
              orderBy("createdAt", "desc"),
              limit(20)
            )
          ),
          getDocs(
            query(
              collection(db, COLLECTIONS.USERS),
              orderBy("createdAt", "desc")
            )
          ),
        ]);

        // Stat counts
        setStats({
          totalMembers: totalMembersSnap.data().count,
          postsThisWeek: postsThisWeekSnap.data().count,
          activeGroups: activeGroupsSnap.data().count,
          upcomingEvents: upcomingEventsSnap.data().count,
        });

        // Recent members
        setRecentMembers(
          recentMembersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile))
        );

        // Top posts sorted by total reactions client-side (avoids composite index requirement)
        const posts = topPostsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
        const sorted = [...posts].sort((a, b) => {
          const totalA = (a.reactionCounts?.like ?? 0) + (a.reactionCounts?.heart ?? 0) + (a.reactionCounts?.pray ?? 0);
          const totalB = (b.reactionCounts?.like ?? 0) + (b.reactionCounts?.heart ?? 0) + (b.reactionCounts?.pray ?? 0);
          return totalB - totalA;
        });
        setTopPosts(sorted.slice(0, 5));

        // Unique nations
        const nationSet = new Set<string>();
        allUsersSnap.docs.forEach((d) => {
          const data = d.data() as UserProfile;
          if (data.nationName) nationSet.add(data.nationName);
        });
        setNations(Array.from(nationSet).sort());
      } catch (e) {
        console.error("Metrics load error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
          <BarChart2 className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Movement Metrics</h1>
          <p className="text-sm text-slate-500">Platform-wide activity overview</p>
        </div>
      </div>

      {/* ── Section 1: Stat cards ── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="w-5 h-5 text-indigo-600" />}
            accentClass="bg-indigo-50"
            value={formatNumber(stats.totalMembers)}
            label="Total Members"
          />
          <StatCard
            icon={<FileText className="w-5 h-5 text-emerald-600" />}
            accentClass="bg-emerald-50"
            value={formatNumber(stats.postsThisWeek)}
            label="Posts This Week"
          />
          <StatCard
            icon={<Users2 className="w-5 h-5 text-violet-600" />}
            accentClass="bg-violet-50"
            value={formatNumber(stats.activeGroups)}
            label="Active Groups"
          />
          <StatCard
            icon={<Calendar className="w-5 h-5 text-amber-600" />}
            accentClass="bg-amber-50"
            value={formatNumber(stats.upcomingEvents)}
            label="Upcoming Events"
          />
        </div>
      )}

      {/* ── Sections 2 & 3: two-column ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 2: Recent Members */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Members</CardTitle>
            <span className="text-xs text-slate-400">Last 10 to join</span>
          </CardHeader>
          {recentMembers.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No members found.</p>
          ) : (
            <div className="space-y-3">
              {recentMembers.map((user) => (
                <div key={user.id} className="flex items-center gap-3">
                  <Avatar name={user.displayName} photoURL={user.photoURL} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{user.displayName}</p>
                    <p className="text-xs text-slate-400">{formatDate(user.createdAt)}</p>
                  </div>
                  <Badge className={getRoleColor(user.role)}>
                    {ROLE_LABELS[user.role]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section 3: Top Posts This Week */}
        <Card>
          <CardHeader>
            <CardTitle>Top Posts This Week</CardTitle>
            <span className="text-xs text-slate-400">Most reactions</span>
          </CardHeader>
          {topPosts.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No posts this week.</p>
          ) : (
            <div className="space-y-4">
              {topPosts.map((post) => {
                const totalReactions =
                  (post.reactionCounts?.like ?? 0) +
                  (post.reactionCounts?.heart ?? 0) +
                  (post.reactionCounts?.pray ?? 0);
                return (
                  <div key={post.id} className="flex gap-3">
                    <Avatar name={post.authorName} photoURL={post.authorPhoto} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{post.authorName}</p>
                        <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                          {totalReactions} {totalReactions === 1 ? "reaction" : "reactions"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        {truncate(post.body, 100)}
                      </p>
                      <div className="flex gap-2 mt-1 text-xs text-slate-400">
                        {post.reactionCounts?.like > 0 && (
                          <span>👍 {post.reactionCounts.like}</span>
                        )}
                        {post.reactionCounts?.heart > 0 && (
                          <span>❤️ {post.reactionCounts.heart}</span>
                        )}
                        {post.reactionCounts?.pray > 0 && (
                          <span>🙏 {post.reactionCounts.pray}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Section 4: Nations Reached ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-500" />
            <CardTitle>Nations Reached</CardTitle>
          </div>
          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
            {nations.length} {nations.length === 1 ? "nation" : "nations"}
          </span>
        </CardHeader>
        {nations.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No nation data yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {nations.map((nation) => (
              <span
                key={nation}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
              >
                {nation}
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Stat card sub-component ──

interface StatCardProps {
  icon: React.ReactNode;
  accentClass: string;
  value: string | number;
  label: string;
}

function StatCard({ icon, accentClass, value, label }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${accentClass}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </Card>
  );
}
