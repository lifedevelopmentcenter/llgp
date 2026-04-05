"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { Search, Users, MapPin, SlidersHorizontal, X, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { ROLE_LABELS } from "@/lib/types";
import { getRoleColor } from "@/lib/utils";
import type { UserProfile, Nation } from "@/lib/types";

export default function DirectoryPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [nations, setNations] = useState<Nation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterNation, setFilterNation] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"name" | "new">("name");

  useEffect(() => {
    const load = async () => {
      try {
        const [usersSnap, nationsSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.USERS), where("isActive", "==", true), orderBy("displayName"))),
          getDocs(query(collection(db, COLLECTIONS.NATIONS), orderBy("name"))),
        ]);
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
        setNations(nationsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Nation)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const filtered = users.filter(u => {
    if (search && !u.displayName?.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterNation && u.nationId !== filterNation) return false;
    if (filterRole && u.role !== filterRole) return false;
    return true;
  });

  const activeFilters = [filterNation, filterRole].filter(Boolean).length;

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "new") {
      const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
      const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
      return bTime - aTime;
    }
    return (a.displayName || "").localeCompare(b.displayName || "");
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Member Directory</h1>
          <p className="text-sm text-slate-400 mt-0.5">{sorted.length} of {users.length} members</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-lg transition-colors ${viewMode === "grid" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600"}`}>
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600"}`}>
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all shadow-sm ${showFilters || activeFilters > 0 ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilters > 0 ? `${activeFilters} filter${activeFilters > 1 ? "s" : ""}` : "Filter"}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 grid sm:grid-cols-2 gap-3 animate-fade-in">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nation</label>
            <select
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={filterNation}
              onChange={e => setFilterNation(e.target.value)}
            >
              <option value="">All nations</option>
              {nations.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role</label>
            <select
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
            >
              <option value="">All roles</option>
              {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {activeFilters > 0 && (
            <button onClick={() => { setFilterNation(""); setFilterRole(""); }} className="text-xs text-red-500 hover:text-red-600 font-semibold text-left">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Sort row */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 font-semibold">Sort:</span>
        {(["name", "new"] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${sortBy === s ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
            {s === "name" ? "A–Z" : "Newest"}
          </button>
        ))}
      </div>

      {/* Members */}
      {sorted.length === 0 ? (
        <EmptyState icon={<Users className="w-6 h-6" />} title="No members found" description="Try adjusting your search or filters." />
      ) : viewMode === "list" ? (
        <div className="space-y-1.5">
          {sorted.map(user => (
            <Link key={user.id} href={`/profile/${user.id}`}>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 p-3 flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <Avatar name={user.displayName ?? "?"} photoURL={user.photoURL} size="md" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900 text-sm truncate">{user.displayName}</p>
                    <span className={`pill text-[10px] ${getRoleColor(user.role)}`}>{ROLE_LABELS[user.role]}</span>
                    {user.isVenture100 && <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">V100</span>}
                    {user.isLLGLI && <span className="text-[9px] bg-violet-100 text-violet-700 font-bold px-1.5 py-0.5 rounded-full">LLGLI</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {(user.nationName || user.cityName) && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {[user.cityName, user.nationName].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {user.sphereOfInfluence && <span className="text-xs text-indigo-600 font-medium">{user.sphereOfInfluence}</span>}
                  </div>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">View →</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map(user => (
            <Link key={user.id} href={`/profile/${user.id}`}>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer overflow-hidden">
                {/* Mini cover */}
                <div className={`h-12 bg-gradient-to-r ${getGradient(user.displayName || "")}`} />
                <div className="px-4 pb-4">
                  <div className="flex items-end justify-between -mt-6 mb-3">
                    <div className="ring-3 ring-white rounded-full">
                      <Avatar name={user.displayName ?? "?"} photoURL={user.photoURL} size="md" />
                    </div>
                    {(user.isVenture100 || user.isLLGLI) && (
                      <div className="flex gap-1 mb-1">
                        {user.isVenture100 && <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">V100</span>}
                        {user.isLLGLI && <span className="text-[9px] bg-violet-100 text-violet-700 font-bold px-1.5 py-0.5 rounded-full">LLGLI</span>}
                      </div>
                    )}
                  </div>
                  <p className="font-bold text-slate-900 text-sm truncate">{user.displayName}</p>
                  <span className={`pill text-[10px] mt-0.5 ${getRoleColor(user.role)}`}>{ROLE_LABELS[user.role]}</span>
                  {(user.nationName || user.cityName) && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{[user.cityName, user.nationName].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                  {user.sphereOfInfluence && (
                    <p className="text-xs text-indigo-600 font-medium mt-1 truncate">{user.sphereOfInfluence}</p>
                  )}
                  {user.bio && (
                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{user.bio}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}


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
