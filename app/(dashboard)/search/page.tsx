"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  limit,
  query as firestoreQuery,
} from "firebase/firestore";
import { Search, Users, FileText, Layers, MapPin } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { Avatar } from "@/components/ui/Avatar";
import { PageLoader } from "@/components/ui/Spinner";
import { getRoleColor, timeAgo } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/types";
import type { UserProfile, Post, Group } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GRADIENTS = [
  "from-indigo-400 to-violet-500",
  "from-teal-400 to-emerald-500",
  "from-rose-400 to-pink-500",
  "from-amber-400 to-orange-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-blue-500",
];

function getGradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h += name.charCodeAt(i);
  return GRADIENTS[h % GRADIENTS.length];
}

const POST_TYPE_LABELS: Record<string, string> = {
  testimony: "Testimony",
  update: "Update",
  prayer_request: "Prayer",
  event: "Event",
  insight: "Insight",
  poll: "Poll",
  share: "Share",
};

const POST_TYPE_COLORS: Record<string, string> = {
  testimony: "bg-emerald-50 text-emerald-700",
  update: "bg-blue-50 text-blue-700",
  prayer_request: "bg-violet-50 text-violet-700",
  event: "bg-amber-50 text-amber-700",
  insight: "bg-indigo-50 text-indigo-700",
  poll: "bg-rose-50 text-rose-700",
  share: "bg-slate-100 text-slate-600",
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-pulse">
      <div className="h-12 bg-slate-100" />
      <div className="px-4 pb-4 pt-2 space-y-2">
        <div className="h-4 bg-slate-100 rounded-full w-3/4" />
        <div className="h-3 bg-slate-100 rounded-full w-1/2" />
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 animate-pulse">
      <div className="flex gap-3 items-center">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-slate-100 rounded-full w-1/3" />
          <div className="h-3 bg-slate-100 rounded-full w-3/4" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<"all" | "people" | "posts" | "groups">("all");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const [usersSnap, postsSnap, groupsSnap] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.USERS)),
        getDocs(firestoreQuery(collection(db, COLLECTIONS.POSTS), orderBy("createdAt", "desc"), limit(100))),
        getDocs(collection(db, COLLECTIONS.GROUPS)),
      ]);
      const q = searchQuery.toLowerCase();
      setUsers(
        usersSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as UserProfile))
          .filter(
            u =>
              u.isActive &&
              (u.displayName?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                u.nationName?.toLowerCase().includes(q) ||
                u.profession?.toLowerCase().includes(q) ||
                u.nickname?.toLowerCase().includes(q))
          )
      );
      setPosts(
        postsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Post))
          .filter(
            p =>
              p.body?.toLowerCase().includes(q) ||
              p.authorName?.toLowerCase().includes(q)
          )
      );
      setGroups(
        groupsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Group))
          .filter(
            g =>
              g.name?.toLowerCase().includes(q) ||
              g.description?.toLowerCase().includes(q)
          )
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const totalResults = users.length + posts.length + groups.length;

  const tabs = [
    { key: "all" as const, label: "All", count: totalResults },
    { key: "people" as const, label: "People", count: users.length, icon: <Users className="w-3.5 h-3.5" /> },
    { key: "posts" as const, label: "Posts", count: posts.length, icon: <FileText className="w-3.5 h-3.5" /> },
    { key: "groups" as const, label: "Groups", count: groups.length, icon: <Layers className="w-3.5 h-3.5" /> },
  ];

  const showPeople = tab === "all" || tab === "people";
  const showPosts = tab === "all" || tab === "posts";
  const showGroups = tab === "all" || tab === "groups";

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Search bar */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search people, posts, groups…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
            autoFocus
          />
        </div>
        <button
          onClick={search}
          disabled={!searchQuery.trim() || loading}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Search className="w-4 h-4" />
          Search
        </button>
      </div>

      {/* Tab bar — only shown after a search */}
      {searched && !loading && (
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                tab === t.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {t.icon}
              {t.label}
              {searched && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    tab === t.key ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-6">
          <div>
            <div className="h-5 w-24 bg-slate-100 rounded-full mb-3 animate-pulse" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          </div>
          <div>
            <div className="h-5 w-24 bg-slate-100 rounded-full mb-3 animate-pulse" />
            <div className="space-y-2">
              {[1, 2, 3].map(i => <SkeletonList key={i} />)}
            </div>
          </div>
        </div>
      )}

      {/* Empty / initial state */}
      {!loading && !searched && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Search Leading Lights</h2>
          <p className="text-sm text-slate-400 max-w-xs">
            Find people, posts, and groups across the platform. Type a name, topic, or keyword above.
          </p>
        </div>
      )}

      {/* No results */}
      {!loading && searched && totalResults === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
            <Search className="w-7 h-7 text-slate-300" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">No results for &ldquo;{searchQuery}&rdquo;</h2>
          <p className="text-sm text-slate-400">Try a different keyword or check your spelling.</p>
        </div>
      )}

      {/* Results */}
      {!loading && searched && totalResults > 0 && (
        <div className="space-y-8">
          {/* People */}
          {showPeople && users.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">People</h2>
                <span className="text-xs text-slate-400">({users.length})</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {users.map(user => (
                  <Link key={user.id} href={`/profile/${user.id}`}>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer overflow-hidden">
                      <div className={`h-12 bg-gradient-to-r ${getGradient(user.displayName || "")}`} />
                      <div className="px-4 pb-4">
                        <div className="flex items-end justify-between -mt-6 mb-3">
                          <div className="ring-2 ring-white rounded-full">
                            <Avatar name={user.displayName ?? "?"} photoURL={user.photoURL} size="md" />
                          </div>
                          {(user.isVenture100 || user.isLLGLI) && (
                            <div className="flex gap-1 mb-1">
                              {user.isVenture100 && (
                                <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">V100</span>
                              )}
                              {user.isLLGLI && (
                                <span className="text-[9px] bg-violet-100 text-violet-700 font-bold px-1.5 py-0.5 rounded-full">LLGLI</span>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="font-bold text-slate-900 text-sm truncate">{user.displayName}</p>
                        <span className={`pill text-[10px] mt-0.5 ${getRoleColor(user.role)}`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                        {(user.nationName || user.cityName) && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">
                              {[user.cityName, user.nationName].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Posts */}
          {showPosts && posts.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Posts</h2>
                <span className="text-xs text-slate-400">({posts.length})</span>
              </div>
              <div className="space-y-2">
                {posts.map(post => (
                  <Link key={post.id} href="/feed">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 p-4 flex gap-3">
                      <Avatar name={post.authorName ?? "?"} photoURL={post.authorPhoto} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">{post.authorName}</p>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              POST_TYPE_COLORS[post.type] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {POST_TYPE_LABELS[post.type] ?? post.type}
                          </span>
                          <span className="text-[11px] text-slate-400 ml-auto">
                            {timeAgo(post.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{post.body}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Groups */}
          {showGroups && groups.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Groups</h2>
                <span className="text-xs text-slate-400">({groups.length})</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {groups.map(group => (
                  <Link key={group.id} href={`/community/groups/${group.id}`}>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer overflow-hidden">
                      {group.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={group.coverImage} alt={group.name} className="h-16 w-full object-cover" />
                      ) : (
                        <div className={`h-16 bg-gradient-to-r ${getGradient(group.name)}`} />
                      )}
                      <div className="p-4">
                        <p className="font-bold text-slate-900 text-sm truncate">{group.name}</p>
                        {group.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {group.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                          <Users className="w-3 h-3 flex-shrink-0" />
                          <span>{group.memberCount} member{group.memberCount !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
