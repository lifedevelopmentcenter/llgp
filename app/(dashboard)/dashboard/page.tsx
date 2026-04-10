"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  collection, query, where, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp, doc, setDoc, getDocs, Timestamp,
  deleteDoc, increment, updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { ref as dbRef, onValue } from "firebase/database";
import { db, storage, rtdb } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea, Select } from "@/components/ui/Input";
import { timeAgo } from "@/lib/utils";
import type { Post, Announcement, UserProfile, Story, LiveEvent, Spotlight } from "@/lib/types";
import { Radio, Plus, Globe, MessageSquare, Check, ChevronRight, X, Image, Link2, ChevronLeft, ExternalLink, Rocket, MoreHorizontal, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

// ── Helpers ────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; colors: string; emoji: string }> = {
  testimony:      { label: "Testimony",  colors: "bg-green-100 text-green-700",  emoji: "✦" },
  prayer_request: { label: "Prayer",     colors: "bg-blue-100 text-blue-700",    emoji: "🙏" },
  update:         { label: "Update",     colors: "bg-amber-100 text-amber-700",  emoji: "📢" },
  insight:        { label: "Insight",    colors: "bg-violet-100 text-violet-700",emoji: "💡" },
  event:          { label: "Event",      colors: "bg-rose-100 text-rose-700",    emoji: "📅" },
  poll:           { label: "Poll",       colors: "bg-cyan-100 text-cyan-700",    emoji: "📊" },
  share:          { label: "Shared",     colors: "bg-slate-100 text-slate-600",  emoji: "↗️" },
};

const isVerifiedRole = (role?: string) =>
  ["global_admin", "national_leader", "city_leader"].includes(role || "");

const totalReactions = (post: Post) =>
  (post.reactionCounts?.like || 0) +
  (post.reactionCounts?.heart || 0) +
  (post.reactionCounts?.pray || 0);

function renderHashtags(text: string): React.ReactNode {
  const parts = text.split(/(#\w+)/g);
  return parts.map((part, i) =>
    part.startsWith("#")
      ? <span key={i} className="text-indigo-600 font-semibold">{part}</span>
      : part
  );
}

// ── Live Events Carousel ───────────────────────────────────

function LiveEventsCarousel({ events }: { events: LiveEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 p-4 flex items-center gap-4 shadow-lg">
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <Radio className="w-6 h-6 text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Watch this space</span>
          <p className="font-bold text-white text-sm mt-0.5">No live events right now</p>
          <p className="text-xs text-slate-400 mt-0.5">This banner updates automatically when a live event starts</p>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto no-scrollbar -mx-0">
      <div className="flex gap-3 pb-1" style={{ scrollSnapType: "x mandatory" }}>
        {events.map(event => (
          <Link key={event.id} href={`/live/${event.id}`}
            className="flex-shrink-0 w-full"
            style={{ scrollSnapAlign: "start" }}>
            <div className="relative overflow-hidden bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-600 rounded-2xl p-5 text-white flex items-center gap-4 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200">
              {/* Decorative blobs */}
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                  <Radio className="w-7 h-7 text-white" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-white" />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-white/25 backdrop-blur-sm px-2.5 py-0.5 rounded-full mb-1">● LIVE NOW</span>
                <p className="font-black text-base leading-snug truncate">{event.title}</p>
                <p className="text-sm text-white/75 mt-0.5">{event.hostName} · Tap to join</p>
              </div>
              <ChevronRight className="w-6 h-6 text-white/80 flex-shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Featured Initiatives Carousel ─────────────────────────

const GRADIENT_FALLBACKS = [
  "from-indigo-600 to-violet-700",
  "from-rose-500 to-pink-700",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-blue-700",
  "from-fuchsia-500 to-purple-700",
];

function FeaturedCarousel({ spotlights, onSubmit, currentUserId, isAdmin, onEdit }: {
  spotlights: Spotlight[];
  onSubmit: () => void;
  currentUserId?: string;
  isAdmin?: boolean;
  onEdit: (s: Spotlight) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [ordered, setOrdered] = useState<Spotlight[]>(spotlights);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => { setOrdered(spotlights); }, [spotlights]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardW = el.clientWidth + 12;
    el.scrollBy({ left: dir === "right" ? cardW : -cardW, behavior: "smooth" });
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setActiveIdx(Math.round(el.scrollLeft / (el.clientWidth + 12)));
  };

  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    const from = ordered.findIndex(s => s.id === draggedId);
    const to = ordered.findIndex(s => s.id === targetId);
    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrdered(next);
    setDraggedId(null);
    setDragOverId(null);
    // Persist display order
    try {
      await Promise.all(next.map((s, idx) =>
        updateDoc(doc(db, COLLECTIONS.SPOTLIGHTS, s.id), { displayOrder: idx })
      ));
    } catch (e) { console.error(e); }
  };

  if (ordered.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-sm font-black uppercase tracking-widest text-slate-700 mb-3">Featured</p>
        <div className="flex flex-col items-center text-center py-4 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
            <Rocket className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">Spotlight your initiative</p>
            <p className="text-xs text-slate-400 mt-0.5">Share a podcast, article, video or project with the community</p>
          </div>
          <button onClick={onSubmit}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-full hover:bg-indigo-700 transition-colors shadow-sm">
            Share your initiative →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-black uppercase tracking-widest text-slate-700">Featured</p>
          {isAdmin && ordered.length > 1 && (
            <span className="text-[10px] text-slate-400 font-medium">drag to reorder</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ordered.length > 1 && (
            <div className="flex gap-1">
              {ordered.map((_, i) => (
                <span key={i} className={`block rounded-full transition-all duration-300 ${i === activeIdx ? "w-4 h-1.5 bg-indigo-600" : "w-1.5 h-1.5 bg-slate-300"}`} />
              ))}
            </div>
          )}
          {ordered.length > 1 && (
            <div className="flex gap-1">
              <button onClick={() => scroll("left")} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <button onClick={() => scroll("right")} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="overflow-x-auto no-scrollbar flex gap-3"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {ordered.map((s, i) => (
          <div key={s.id}
            draggable={isAdmin}
            onDragStart={() => isAdmin && setDraggedId(s.id)}
            onDragOver={e => { if (isAdmin) { e.preventDefault(); setDragOverId(s.id); } }}
            onDrop={e => { e.preventDefault(); if (isAdmin) handleDrop(s.id); }}
            onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
            className={`flex-shrink-0 w-[85vw] max-w-xs lg:w-72 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 group
              ${isAdmin ? "cursor-grab active:cursor-grabbing" : "hover:-translate-y-0.5"}
              ${draggedId === s.id ? "opacity-40 scale-95" : ""}
              ${dragOverId === s.id && draggedId !== s.id ? "ring-2 ring-indigo-400 ring-offset-1" : ""}`}
            style={{ scrollSnapAlign: "start" }}>
            {/* Card image / gradient */}
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="block"
              onClick={e => { if (draggedId) e.preventDefault(); }}>
            <div className={`relative h-40 bg-gradient-to-br ${GRADIENT_FALLBACKS[i % GRADIENT_FALLBACKS.length]}`}>
              {s.thumbnailUrl && (
                <img src={s.thumbnailUrl} alt={s.title}
                  className="absolute inset-0 w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-widest bg-white/20 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-full">
                {s.type}
              </span>
              {/* Edit button — only for owner/admin */}
              {(isAdmin || s.submittedBy === currentUserId) && (
                <button
                  onClick={e => { e.preventDefault(); onEdit(s); }}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
                  title="Edit spotlight">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white fill-none stroke-current stroke-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                </button>
              )}
              {!(isAdmin || s.submittedBy === currentUserId) && (
                <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white font-black text-sm leading-tight line-clamp-2">{s.title}</p>
              </div>
            </div>
            </a>
            {/* Card footer */}
            <div className="bg-white p-3 flex items-center gap-2.5">
              <Avatar name={s.personName} photoURL={s.personPhoto} size="xs" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{s.personName}</p>
                {s.nationName && <p className="text-[10px] text-slate-400 truncate">{s.nationName}</p>}
              </div>
              {s.description && (
                <p className="text-[10px] text-slate-400 line-clamp-1 hidden sm:block">{s.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Active Members Strip ───────────────────────────────────

function MembersStrip({ members, onlineIds }: { members: UserProfile[]; onlineIds: Set<string> }) {
  if (members.length === 0) return null;
  // Sort: online members first
  const sorted = [...members].sort((a, b) => {
    const aOnline = onlineIds.has(a.id) ? 0 : 1;
    const bOnline = onlineIds.has(b.id) ? 0 : 1;
    return aOnline - bOnline;
  });
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">
          Members {onlineIds.size > 0 && <span className="text-emerald-500">· {onlineIds.size} online</span>}
        </p>
        <Link href="/community/directory" className="text-xs text-indigo-600 font-semibold hover:underline">See all →</Link>
      </div>
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-4 pb-1">
          {sorted.map(m => (
            <Link key={m.id} href={`/profile/${m.id}`}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 hover:opacity-80 transition-opacity">
              <div className="relative">
                <Avatar name={m.displayName ?? "?"} photoURL={m.photoURL} size="md" />
                {onlineIds.has(m.id) && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-white" />
                )}
              </div>
              <span className="text-[10px] font-semibold text-slate-600 text-center w-14 truncate leading-tight">
                {(m.displayName ?? "?").split(" ")[0]}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Stories Strip ──────────────────────────────────────────

function StoriesStrip({
  stories, onAdd, onView,
}: {
  stories: Story[];
  onAdd: () => void;
  onView: (s: Story) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-3 pb-1">
          {/* Add Story */}
          <button onClick={onAdd} className="flex-shrink-0 flex flex-col items-center gap-1.5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center ring-2 ring-white shadow-md">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] text-slate-500 font-semibold text-center leading-tight">Your Story</span>
          </button>
          {stories.map(s => (
            <button key={s.id} onClick={() => onView(s)} className="flex-shrink-0 flex flex-col items-center gap-1.5">
              <div className="w-16 h-16 rounded-full ring-2 ring-indigo-500 ring-offset-2 overflow-hidden shadow-md">
                {s.imageUrl
                  ? <img src={s.imageUrl} className="w-full h-full object-cover" alt={s.authorName} />
                  : <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
                      <span className="text-white text-lg font-black">{s.authorName?.[0]}</span>
                    </div>
                }
              </div>
              <span className="text-[10px] text-slate-600 font-semibold text-center truncate w-20 leading-tight">
                {s.authorName.split(" ")[0]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────

export default function DashboardPage() {
  const { profile } = useAuth();

  // Feed
  const [feed, setFeed] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedTab, setFeedTab] = useState<"global" | "following">("global");
  const [followingFeed, setFollowingFeed] = useState<Post[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [followingCount, setFollowingCount] = useState(0);

  // Stories
  const [stories, setStories] = useState<Story[]>([]);
  const [createStoryOpen, setCreateStoryOpen] = useState(false);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [storyCaption, setStoryCaption] = useState("");
  const [storyImageFile, setStoryImageFile] = useState<File | null>(null);
  const [storyImagePreview, setStoryImagePreview] = useState<string | null>(null);
  const [storySaving, setStorySaving] = useState(false);

  // Compose
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeType, setComposeType] = useState<Post["type"]>("update");
  const [composeBody, setComposeBody] = useState("");
  const [composeScope, setComposeScope] = useState<"global" | "national" | "city">("global");
  const [composeSaving, setComposeSaving] = useState(false);

  // Link preview
  const [linkPreview, setLinkPreview] = useState<{ url: string; title: string | null; description: string | null; image: string | null } | null>(null);
  const [linkFetching, setLinkFetching] = useState(false);

  // Reactions & Comments
  const [reacted, setReacted] = useState<Record<string, string>>({});
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  // Panels
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeMembers, setActiveMembers] = useState<UserProfile[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);

  // Spotlight submit (from composer)
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [spotlightForm, setSpotlightForm] = useState({ title: "", url: "", description: "", type: "initiative" as Spotlight["type"], thumbnailUrl: "" });
  const [spotlightSaving, setSpotlightSaving] = useState(false);
  const [ogLoading, setOgLoading] = useState(false);
  const [editingSpotlight, setEditingSpotlight] = useState<Spotlight | null>(null);
  const [editForm, setEditForm] = useState({ title: "", url: "", description: "", type: "initiative" as Spotlight["type"], thumbnailUrl: "" });
  const [editSaving, setEditSaving] = useState(false);

  // ── Real-time feed ──────────────────────────────────────

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, COLLECTIONS.POSTS),
      where("scope", "==", "global"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, snap => {
      setFeed(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
      setFeedLoading(false);
    }, () => { setFeedLoading(false); });
    return unsub;
  }, [profile]);

  // ── Following feed ──────────────────────────────────────

  useEffect(() => {
    if (!profile || feedTab !== "following") return;
    setFollowingFeed([]);
    setFollowingLoading(true);
    const load = async () => {
      try {
        const followsSnap = await getDocs(
          query(collection(db, COLLECTIONS.FOLLOWS), where("followerId", "==", profile.id))
        );
        const ids = followsSnap.docs.map(d => d.data().followeeId as string).filter(Boolean);
        setFollowingCount(ids.length);
        if (ids.length === 0) { setFollowingFeed([]); setFollowingLoading(false); return; }
        const postsSnap = await getDocs(
          query(collection(db, COLLECTIONS.POSTS), where("authorId", "in", ids), orderBy("createdAt", "desc"), limit(20))
        );
        setFollowingFeed(postsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
      } catch (e) { console.error(e); }
      finally { setFollowingLoading(false); }
    };
    load();
  }, [profile, feedTab]);

  // ── Side data ───────────────────────────────────────────

  useEffect(() => {
    if (!profile) return;
    const now = Timestamp.now();

    const unsubStories = onSnapshot(
      query(collection(db, COLLECTIONS.STORIES), where("expiresAt", ">", now), orderBy("expiresAt"), orderBy("createdAt", "desc"), limit(20)),
      snap => setStories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Story))),
      () => {}
    );

    // Real-time live events
    const unsubLive = onSnapshot(
      query(collection(db, COLLECTIONS.LIVE_EVENTS), where("isLive", "==", true), limit(5)),
      snap => setLiveEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveEvent))),
      () => {}
    );

    const load = async () => {
      try {
        const [annSnap, membersSnap, spotlightSnap, reactSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.ANNOUNCEMENTS), orderBy("createdAt", "desc"), limit(3))),
          getDocs(query(collection(db, COLLECTIONS.USERS), where("isActive", "==", true), orderBy("displayName"), limit(20))),
          getDocs(query(collection(db, COLLECTIONS.SPOTLIGHTS), where("isApproved", "==", true), orderBy("createdAt", "desc"), limit(8))),
          getDocs(query(collection(db, COLLECTIONS.REACTIONS), where("userId", "==", profile.id), limit(50))),
        ]);
        setAnnouncements(annSnap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
        setActiveMembers(membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
        const rawSpotlights = spotlightSnap.docs.map(d => ({ id: d.id, ...d.data() } as Spotlight));
        rawSpotlights.sort((a, b) => ((a as any).displayOrder ?? 999) - ((b as any).displayOrder ?? 999));
        setSpotlights(rawSpotlights);
        const map: Record<string, string> = {};
        reactSnap.docs.forEach(d => { const x = d.data(); map[x.postId] = x.type; });
        setReacted(map);
      } catch (e) { console.error(e); }
    };
    load();

    // Real-time presence from RTDB — track online IDs only
    const presenceUnsub = onValue(dbRef(rtdb, "/presence"), (snap) => {
      const data = snap.val() as Record<string, { online: boolean }> | null;
      if (!data) { setOnlineIds(new Set()); return; }
      setOnlineIds(new Set(Object.entries(data).filter(([, v]) => v.online).map(([uid]) => uid)));
    });

    return () => { unsubStories(); unsubLive(); presenceUnsub(); };
  }, [profile]);

  // ── Link preview detector ───────────────────────────────

  useEffect(() => {
    const urlMatch = composeBody.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) { setLinkPreview(null); return; }
    const url = urlMatch[0];
    if (linkPreview?.url === url) return; // already fetched this URL
    const timer = setTimeout(async () => {
      setLinkFetching(true);
      try {
        const res = await fetch(`/api/og-preview?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        setLinkPreview({ url, title: data.title, description: data.description, image: data.image });
      } catch { /* silent */ }
      finally { setLinkFetching(false); }
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeBody]);

  // ── Actions ─────────────────────────────────────────────

  const handleReact = async (postId: string, type: "like" | "heart" | "pray") => {
    if (!profile) return;
    const existing = reacted[postId];
    const reactId = `${postId}_${profile.id}`;

    // Optimistic UI — update both feeds and reacted map immediately
    const updateCounts = (posts: Post[]) => posts.map(p => {
      if (p.id !== postId) return p;
      const counts = { ...(p.reactionCounts ?? { like: 0, heart: 0, pray: 0 }) };
      if (existing === type) {
        counts[type] = Math.max(0, (counts[type] || 0) - 1);
      } else {
        if (existing) counts[existing as keyof typeof counts] = Math.max(0, (counts[existing as keyof typeof counts] || 0) - 1);
        counts[type] = (counts[type] || 0) + 1;
      }
      return { ...p, reactionCounts: counts };
    });
    if (existing === type) {
      setReacted(prev => { const n = { ...prev }; delete n[postId]; return n; });
    } else {
      setReacted(prev => ({ ...prev, [postId]: type }));
    }
    setFeed(updateCounts);
    setFollowingFeed(updateCounts);

    try {
      if (existing === type) {
        await setDoc(doc(db, COLLECTIONS.REACTIONS, reactId), { postId, userId: profile.id, type: null, deletedAt: serverTimestamp() }, { merge: true });
        await updateDoc(doc(db, COLLECTIONS.POSTS, postId), { [`reactionCounts.${type}`]: increment(-1) });
      } else {
        await setDoc(doc(db, COLLECTIONS.REACTIONS, reactId), { postId, postType: "post", userId: profile.id, type, createdAt: serverTimestamp() });
        const updates: Record<string, any> = { [`reactionCounts.${type}`]: increment(1) };
        if (existing) updates[`reactionCounts.${existing}`] = increment(-1);
        await updateDoc(doc(db, COLLECTIONS.POSTS, postId), updates);
      }
    } catch { toast.error("Reaction failed"); }
  };

  const handleDeletePost = (postId: string) => {
    setFeed(prev => prev.filter(p => p.id !== postId));
    setFollowingFeed(prev => prev.filter(p => p.id !== postId));
  };

  const handleComment = async (postId: string) => {
    if (!profile || !commentText.trim()) return;
    try {
      await addDoc(collection(db, COLLECTIONS.COMMENTS), {
        parentId: postId, parentType: "post",
        authorId: profile.id, authorName: profile.displayName, authorPhoto: profile.photoURL || null,
        body: commentText.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setCommentText(""); setCommentingOn(null);
      toast.success("Comment posted");
    } catch { toast.error("Failed to post comment"); }
  };

  const handleCompose = async () => {
    if (!profile || !composeBody.trim()) return;
    setComposeSaving(true);
    try {
      await addDoc(collection(db, COLLECTIONS.POSTS), {
        authorId: profile.id, authorName: profile.displayName, authorPhoto: profile.photoURL || null,
        nationName: profile.nationName || null, cityName: profile.cityName || null,
        body: composeBody.trim(), type: composeType, scope: composeScope,
        nationId: profile.nationId || null, cityId: profile.cityId || null,
        mediaUrls: [], commentCount: 0, reactionCounts: { like: 0, heart: 0, pray: 0 },
        linkPreview: linkPreview ?? null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setComposeBody(""); setComposeType("update"); setComposeScope("global"); setComposeOpen(false); setLinkPreview(null);
      toast.success("Posted!");
      // One-time spotlight nudge after first post
      const key = `llgp_spotlight_nudge_${profile.id}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        setTimeout(() => {
          toast((t) => (
            <span className="flex items-center gap-2 text-sm">
              <Rocket className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Have a podcast, initiative, or article?{" "}
                <button className="font-bold text-indigo-600 underline" onClick={() => { toast.dismiss(t.id); setSpotlightOpen(true); }}>
                  Share it in Spotlights →
                </button>
              </span>
            </span>
          ), { duration: 8000 });
        }, 1500);
      }
    } catch { toast.error("Failed to post"); }
    finally { setComposeSaving(false); }
  };

  const fetchOG = async (url: string) => {
    if (!url.startsWith("http")) { toast.error("Enter a valid URL first"); return; }
    setOgLoading(true);
    try {
      const res = await fetch(`/api/og-preview?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      setSpotlightForm(f => ({
        ...f,
        thumbnailUrl: data.image || f.thumbnailUrl,
        title: data.title || f.title,
        description: data.description || f.description,
      }));
      if (data.image) toast.success("Preview image fetched!");
      else if (data.title) toast("Title fetched — no image found. Paste a thumbnail URL manually.", { icon: "ℹ️" });
      else toast("No preview found — fill in details manually.", { icon: "ℹ️" });
    } catch { toast.error("Couldn't fetch preview."); }
    finally { setOgLoading(false); }
  };

  const handleSpotlightSubmit = async () => {
    if (!profile || !spotlightForm.title.trim() || !spotlightForm.url.trim()) {
      toast.error("Title and URL are required"); return;
    }
    setSpotlightSaving(true);
    try {
      await addDoc(collection(db, COLLECTIONS.SPOTLIGHTS), {
        title: spotlightForm.title.trim(),
        description: spotlightForm.description.trim() || null,
        url: spotlightForm.url.trim(),
        type: spotlightForm.type,
        thumbnailUrl: spotlightForm.thumbnailUrl.trim() || null,
        personName: profile.displayName,
        personPhoto: profile.photoURL ?? null,
        personId: profile.id,
        nationName: profile.nationName ?? null,
        isApproved: false,
        isPinned: false,
        submittedBy: profile.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Submitted for review! We'll publish it shortly.");
      setSpotlightOpen(false);
      setSpotlightForm({ title: "", url: "", description: "", type: "initiative", thumbnailUrl: "" });
    } catch { toast.error("Failed to submit"); }
    finally { setSpotlightSaving(false); }
  };

  const handleStoryImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStoryImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setStoryImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreateStory = async () => {
    if (!profile) return;
    setStorySaving(true);
    try {
      let imageUrl: string | undefined;
      if (storyImageFile) {
        const storageRef = ref(storage, `stories/${profile.id}/${Date.now()}`);
        await uploadBytes(storageRef, storyImageFile);
        imageUrl = await getDownloadURL(storageRef);
      }
      await addDoc(collection(db, COLLECTIONS.STORIES), {
        authorId: profile.id, authorName: profile.displayName, authorPhoto: profile.photoURL || null,
        imageUrl: imageUrl || null, caption: storyCaption.trim() || null,
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        createdAt: serverTimestamp(),
      });
      setCreateStoryOpen(false); setStoryCaption(""); setStoryImageFile(null); setStoryImagePreview(null);
      toast.success("Story shared!");
    } catch { toast.error("Failed to share story"); }
    finally { setStorySaving(false); }
  };

  const openEdit = (s: Spotlight) => {
    setEditingSpotlight(s);
    setEditForm({ title: s.title, url: s.url, description: s.description || "", type: s.type, thumbnailUrl: s.thumbnailUrl || "" });
  };

  const handleEdit = async () => {
    if (!editingSpotlight || !editForm.title.trim() || !editForm.url.trim()) return;
    setEditSaving(true);
    try {
      const { updateDoc, doc: fsDoc } = await import("firebase/firestore");
      await updateDoc(fsDoc(db, COLLECTIONS.SPOTLIGHTS, editingSpotlight.id), {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        url: editForm.url.trim(),
        type: editForm.type,
        thumbnailUrl: editForm.thumbnailUrl.trim() || null,
        updatedAt: serverTimestamp(),
      });
      setSpotlights(prev => prev.map(s => s.id === editingSpotlight.id ? { ...s, ...editForm } : s));
      toast.success("Spotlight updated!");
      setEditingSpotlight(null);
    } catch { toast.error("Failed to update"); }
    finally { setEditSaving(false); }
  };

  if (!profile) return null;
  const firstName = (profile.displayName ?? "Friend").split(" ")[0];

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="animate-fade-in pb-10">
      <div className="flex gap-6 items-start max-w-5xl mx-auto">

        {/* ── Center column ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* 1. Stories strip */}
          <StoriesStrip stories={stories} onAdd={() => setCreateStoryOpen(true)} onView={setViewingStory} />

          {/* 2. Active members strip */}
          <MembersStrip members={activeMembers} onlineIds={onlineIds} />

          {/* 3. LIVE NOW carousel */}
          <LiveEventsCarousel events={liveEvents} />

          {/* 4. Post composer */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={profile.displayName} photoURL={profile.photoURL} size="sm" className="flex-shrink-0" />
              <button onClick={() => setComposeOpen(true)}
                className="flex-1 text-left px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-full text-sm text-slate-400 transition-colors">
                What&apos;s on your mind, {firstName}?
              </button>
            </div>
            <div className="flex border-t border-slate-100 pt-3 gap-1">
              {[
                { label: "Photo",     icon: "🖼️", type: "update" as const },
                { label: "Prayer",    icon: "🙏", type: "prayer_request" as const },
                { label: "Testimony", icon: "✦",  type: "testimony" as const },
                { label: "Insight",   icon: "💡", type: "insight" as const },
              ].map(item => (
                <button key={item.type}
                  onClick={() => { setComposeType(item.type); setComposeOpen(true); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                  <span>{item.icon}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              ))}
              <button
                onClick={() => setSpotlightOpen(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors">
                <Rocket className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Spotlight</span>
              </button>
            </div>
          </div>

          {/* 5. Featured initiatives carousel */}
          <FeaturedCarousel
            spotlights={spotlights}
            onSubmit={() => setSpotlightOpen(true)}
            currentUserId={profile.id}
            isAdmin={profile.role === "global_admin"}
            onEdit={openEdit}
          />

          {/* 6. Feed tab switcher */}
          <div className="flex gap-2">
            {(["global", "following"] as const).map(tab => (
              <button key={tab} onClick={() => setFeedTab(tab)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  feedTab === tab ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}>
                {tab === "global" ? "For You" : "Following"}
              </button>
            ))}
          </div>

          {/* 7. Feed */}
          {feedTab === "global" ? (
            feedLoading ? <FeedSkeleton /> :
            feed.length === 0 ? <FeedEmpty /> :
            <div className="space-y-4">
              {feed.map(post => (
                <FeedPostCard key={post.id} post={post} myReaction={reacted[post.id]}
                  onReact={handleReact} commentingOn={commentingOn} commentText={commentText}
                  onCommentToggle={id => { setCommentingOn(p => p === id ? null : id); setCommentText(""); }}
                  onCommentChange={setCommentText} onCommentSubmit={handleComment}
                  currentUserId={profile.id} currentUserPhoto={profile.photoURL}
                  isAdmin={profile.role === "global_admin"} onDelete={handleDeletePost} />
              ))}
            </div>
          ) : (
            followingLoading ? <FeedSkeleton /> :
            followingFeed.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
                {followingCount === 0 ? (
                  <>
                    <p className="text-slate-500 text-sm font-semibold mb-1">You&apos;re not following anyone yet</p>
                    <p className="text-slate-400 text-xs mb-4">Follow people to see their posts here.</p>
                    <Link href="/community/directory" className="text-indigo-600 text-sm font-semibold hover:underline">Browse the directory →</Link>
                  </>
                ) : (
                  <>
                    <p className="text-slate-500 text-sm font-semibold mb-1">No posts yet</p>
                    <p className="text-slate-400 text-xs">The {followingCount} {followingCount === 1 ? "person" : "people"} you follow {followingCount === 1 ? "hasn't" : "haven't"} posted anything yet.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {followingFeed.map(post => (
                  <FeedPostCard key={post.id} post={post} myReaction={reacted[post.id]}
                    onReact={handleReact} commentingOn={commentingOn} commentText={commentText}
                    onCommentToggle={id => { setCommentingOn(p => p === id ? null : id); setCommentText(""); }}
                    onCommentChange={setCommentText} onCommentSubmit={handleComment}
                    currentUserId={profile.id} currentUserPhoto={profile.photoURL}
                    isAdmin={profile.role === "global_admin"} onDelete={handleDeletePost} />
                ))}
              </div>
            )
          )}
        </div>

        {/* ── Right panel (desktop only) ── */}
        <div className="hidden lg:block w-72 flex-shrink-0 space-y-4 sticky top-20">
          {/* Announcements */}
          {announcements.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Announcements</p>
                <Link href="/community/announcements" className="text-xs text-indigo-600 font-semibold">All →</Link>
              </div>
              <div className="space-y-3">
                {announcements.map(ann => (
                  <div key={ann.id} className="border-l-2 border-indigo-300 pl-3">
                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{ann.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{ann.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Quick Links</p>
            <div className="space-y-1">
              {[
                { label: "Prayer Wall", href: "/prayer", emoji: "🙏" },
                { label: "Events",      href: "/events", emoji: "📅" },
                { label: "Stories",     href: "/stories", emoji: "📸" },
                { label: "Groups",      href: "/community/groups", emoji: "👥" },
                { label: "Training",    href: "/training", emoji: "📚" },
              ].map(link => (
                <Link key={link.href} href={link.href}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors text-sm text-slate-700 font-medium">
                  <span className="text-base">{link.emoji}</span>
                  {link.label}
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 ml-auto" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}

      {/* Spotlight edit */}
      <Modal open={!!editingSpotlight} onClose={() => setEditingSpotlight(null)} title="Edit Spotlight" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">URL</label>
            <div className="flex gap-2">
              <input className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={editForm.url} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))} type="url" />
              <button type="button" onClick={async () => {
                if (!editForm.url.startsWith("http")) { toast.error("Enter a valid URL"); return; }
                setOgLoading(true);
                try {
                  const res = await fetch(`/api/og-preview?url=${encodeURIComponent(editForm.url)}`);
                  const data = await res.json();
                  setEditForm(f => ({ ...f, thumbnailUrl: data.image || f.thumbnailUrl, title: data.title || f.title, description: data.description || f.description }));
                  if (data.image) toast.success("Preview image fetched!");
                  else if (data.title) toast("Title fetched — no image. Paste a thumbnail URL manually.", { icon: "ℹ️" });
                  else toast("No preview found.", { icon: "ℹ️" });
                } catch { toast.error("Couldn't fetch preview"); }
                finally { setOgLoading(false); }
              }} disabled={ogLoading}
                className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50 whitespace-nowrap">
                {ogLoading ? "…" : "Fetch Preview"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title</label>
            <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Thumbnail URL <span className="font-normal text-slate-400">(auto-filled or paste your own)</span></label>
            <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={editForm.thumbnailUrl} onChange={e => setEditForm(f => ({ ...f, thumbnailUrl: e.target.value }))}
              placeholder="https://example.com/image.jpg" type="url" />
          </div>
          {editForm.thumbnailUrl && (
            <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
              <img src={editForm.thumbnailUrl} alt="preview" className="w-full h-full object-cover"
                onError={e => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.parentElement!.innerHTML = '<span class="text-xs text-slate-400 p-3 text-center">Image blocked by source site — URL saved, will show on card</span>';
                }} />
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Type</label>
            <select className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value as Spotlight["type"] }))}>
              <option value="initiative">Initiative</option>
              <option value="podcast">Podcast</option>
              <option value="video">Video</option>
              <option value="article">Article</option>
              <option value="website">Website</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
            <textarea rows={2} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <Button onClick={handleEdit} disabled={!editForm.title.trim() || !editForm.url.trim() || editSaving} className="w-full">
            {editSaving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </Modal>

      {/* Spotlight submit */}
      <Modal open={spotlightOpen} onClose={() => setSpotlightOpen(false)} title="Share a Spotlight" size="md">
        <div className="space-y-4">
          <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700 font-medium">
            🚀 Share a podcast, initiative, article, video or website with the community. It'll be reviewed before publishing.
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">URL</label>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={spotlightForm.url}
                onChange={e => setSpotlightForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
                type="url"
              />
              <button type="button" onClick={() => fetchOG(spotlightForm.url)} disabled={ogLoading}
                className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50 whitespace-nowrap">
                {ogLoading ? "…" : "Fetch Preview"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title</label>
            <input
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={spotlightForm.title}
              onChange={e => setSpotlightForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. The Marketplace Podcast"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Thumbnail URL <span className="font-normal text-slate-400">(auto-filled or paste your own)</span></label>
            <input
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={spotlightForm.thumbnailUrl}
              onChange={e => setSpotlightForm(f => ({ ...f, thumbnailUrl: e.target.value }))}
              placeholder="https://example.com/image.jpg"
              type="url"
            />
          </div>
          {spotlightForm.thumbnailUrl && (
            <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
              <img src={spotlightForm.thumbnailUrl} alt="preview"
                className="w-full h-full object-cover"
                onError={e => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.parentElement!.innerHTML = '<span class="text-xs text-slate-400">Image blocked by source site — URL saved, will show on card</span>';
                }} />
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Type</label>
            <select
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={spotlightForm.type}
              onChange={e => setSpotlightForm(f => ({ ...f, type: e.target.value as Spotlight["type"] }))}>
              <option value="initiative">Initiative</option>
              <option value="podcast">Podcast</option>
              <option value="video">Video</option>
              <option value="article">Article</option>
              <option value="website">Website</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description (optional)</label>
            <textarea
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              value={spotlightForm.description}
              onChange={e => setSpotlightForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description…"
            />
          </div>
          <Button onClick={handleSpotlightSubmit} disabled={!spotlightForm.title.trim() || !spotlightForm.url.trim() || spotlightSaving} className="w-full">
            {spotlightSaving ? "Submitting…" : "Submit for Review"}
          </Button>
        </div>
      </Modal>

      {/* Compose */}
      <Modal open={composeOpen} onClose={() => setComposeOpen(false)} title="Create Post" size="md">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Short post</span>
            <Link href="/articles/new" onClick={() => setComposeOpen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full hover:bg-indigo-100 transition-colors">
              ✍️ Write Article →
            </Link>
          </div>
          <Textarea placeholder="What's on your mind?" rows={5} value={composeBody} onChange={e => setComposeBody(e.target.value)} />
          {linkFetching && (
            <div className="text-xs text-slate-400 animate-pulse">Fetching preview…</div>
          )}
          {linkPreview && (
            <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex gap-3 p-3">
              {linkPreview.image && <img src={linkPreview.image} alt="" className="w-20 h-16 object-cover rounded-lg flex-shrink-0" onError={e => (e.currentTarget.style.display="none")} />}
              <div className="flex-1 min-w-0">
                {linkPreview.title && <p className="text-xs font-bold text-slate-900 line-clamp-1">{linkPreview.title}</p>}
                {linkPreview.description && <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{linkPreview.description}</p>}
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{linkPreview.url}</p>
              </div>
              <button onClick={() => setLinkPreview(null)} className="flex-shrink-0 text-slate-400 hover:text-slate-600">✕</button>
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <Select label="Type" value={composeType} onChange={e => setComposeType(e.target.value as Post["type"])}>
                <option value="update">Update</option>
                <option value="testimony">Testimony</option>
                <option value="prayer_request">Prayer Request</option>
                <option value="insight">Insight</option>
                <option value="event">Event</option>
              </Select>
            </div>
            <div className="flex-1">
              <Select label="Scope" value={composeScope} onChange={e => setComposeScope(e.target.value as "global" | "national" | "city")}>
                <option value="global">Global</option>
                <option value="national">National</option>
                <option value="city">City</option>
              </Select>
            </div>
          </div>
          <Button onClick={handleCompose} disabled={!composeBody.trim() || composeSaving} className="w-full">
            {composeSaving ? "Posting…" : "Post"}
          </Button>
        </div>
      </Modal>

      {/* Create Story */}
      <Modal open={createStoryOpen} onClose={() => { setCreateStoryOpen(false); setStoryImagePreview(null); setStoryImageFile(null); setStoryCaption(""); }} title="Share a Story" size="sm">
        <div className="space-y-4">
          <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-indigo-400 transition-colors overflow-hidden">
            {storyImagePreview
              ? <img src={storyImagePreview} className="w-full h-full object-cover" alt="preview" />
              : <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Image className="w-8 h-8" />
                  <span className="text-sm font-medium">Tap to add photo</span>
                </div>
            }
            <input type="file" accept="image/*" className="sr-only" onChange={handleStoryImageChange} />
          </label>
          <Textarea placeholder="Add a caption…" rows={2} value={storyCaption} onChange={e => setStoryCaption(e.target.value)} />
          <Button onClick={handleCreateStory} disabled={(!storyImageFile && !storyCaption.trim()) || storySaving} className="w-full">
            {storySaving ? "Sharing…" : "Share Story"}
          </Button>
        </div>
      </Modal>

      {/* Story viewer */}
      {viewingStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setViewingStory(null)}>
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="w-full h-1 bg-white/20 rounded-full mb-3 overflow-hidden">
              <div className="h-full bg-white rounded-full w-3/4" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Avatar name={viewingStory.authorName} photoURL={viewingStory.authorPhoto} size="sm" />
              <span className="text-white text-sm font-semibold">{viewingStory.authorName}</span>
              <span className="text-white/50 text-xs ml-auto">{timeAgo(viewingStory.createdAt)}</span>
            </div>
            {viewingStory.imageUrl && (
              <img src={viewingStory.imageUrl} className="w-full rounded-2xl object-cover max-h-[70vh]" alt="story" />
            )}
            {viewingStory.caption && (
              <p className="text-white text-sm mt-3 text-center">{viewingStory.caption}</p>
            )}
            <button onClick={() => setViewingStory(null)}
              className="absolute top-6 right-0 p-1.5 bg-white/20 rounded-full text-white hover:bg-white/30 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Skeletons & Empty ──────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 animate-pulse">
          <div className="flex gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-200 rounded w-1/4" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-slate-200 rounded" />
            <div className="h-3 bg-slate-200 rounded w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedEmpty() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
      <p className="text-slate-400 text-sm">No posts yet. Be the first to share!</p>
    </div>
  );
}

// ── Post Body (with see more) ──────────────────────────────

function PostBody({ body }: { body: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const LIMIT = 280;
  const isLong = body.length > LIMIT;
  return (
    <div className="px-4 pb-3 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
      {renderHashtags(expanded ? body : body.slice(0, LIMIT) + (isLong && !expanded ? "…" : ""))}
      {isLong && !expanded && (
        <button onClick={() => setExpanded(true)} className="ml-1 text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
          see more
        </button>
      )}
    </div>
  );
}

// ── Carousel Images ────────────────────────────────────────

function CarouselImages({ urls }: { urls: string[] }) {
  const [idx, setIdx] = React.useState(0);
  if (urls.length === 1) {
    return <img src={urls[0]} className="w-full max-h-96 object-cover rounded-none" alt="" />;
  }
  return (
    <div className="relative mx-4 mb-3 rounded-2xl overflow-hidden">
      <img src={urls[idx]} className="w-full aspect-video object-cover" alt="" />
      {/* Prev/Next arrows */}
      {idx > 0 && (
        <button onClick={() => setIdx(i => i - 1)}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {idx < urls.length - 1 && (
        <button onClick={() => setIdx(i => i + 1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
      {/* Dot indicators */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
        {urls.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`rounded-full transition-all duration-200 ${i === idx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/60"}`} />
        ))}
      </div>
      <span className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
        {idx + 1}/{urls.length}
      </span>
    </div>
  );
}

// ── Feed Post Card ─────────────────────────────────────────

interface FeedPostCardProps {
  post: Post;
  myReaction?: string;
  onReact: (postId: string, type: "like" | "heart" | "pray") => void;
  commentingOn: string | null;
  commentText: string;
  onCommentToggle: (postId: string) => void;
  onCommentChange: (text: string) => void;
  onCommentSubmit: (postId: string) => void;
  currentUserId?: string;
  currentUserPhoto?: string | null;
  isAdmin?: boolean;
  onDelete?: (postId: string) => void;
}

function FeedPostCard({
  post, myReaction, onReact,
  commentingOn, commentText,
  onCommentToggle, onCommentChange, onCommentSubmit,
  currentUserId, currentUserPhoto, isAdmin, onDelete,
}: FeedPostCardProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const meta = TYPE_META[post.type] ?? { label: post.type, colors: "bg-slate-100 text-slate-600", emoji: "" };
  const displayPhoto = (currentUserId && post.authorId === currentUserId) ? (currentUserPhoto ?? post.authorPhoto) : post.authorPhoto;
  const canDelete = currentUserId && (post.authorId === currentUserId || isAdmin);

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/dashboard?post=${post.id}`);
    toast("Link copied!");
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <Link href={`/profile/${post.authorId}`} className="flex items-center gap-3">
          <Avatar name={post.authorName} photoURL={displayPhoto} size="md" className="flex-shrink-0" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-sm">{post.authorName}</span>
              {isVerifiedRole((post as any).authorRole) && (
                <span className="w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              {post.nationName && <><Globe className="w-3 h-3" /><span>{post.nationName}</span><span>·</span></>}
              <span>{timeAgo(post.createdAt)}</span>
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.colors}`}>
            {meta.emoji} {meta.label}
          </span>
          {canDelete && (
            <div className="relative">
              <button onClick={() => setMenuOpen(v => !v)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
                <MoreHorizontal className="w-4 h-4 text-slate-400" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[130px]"
                  onMouseLeave={() => setMenuOpen(false)}>
                  <button onClick={async () => {
                    setMenuOpen(false);
                    try {
                      await deleteDoc(doc(db, COLLECTIONS.POSTS, post.id));
                      onDelete?.(post.id);
                      toast.success("Post deleted");
                    } catch { toast.error("Failed to delete"); }
                  }}
                    className="w-full text-left px-4 py-2 text-sm text-rose-600 font-semibold hover:bg-rose-50 flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <PostBody body={post.body ?? ""} />

      {/* Link preview */}
      {post.linkPreview && (
        <a href={post.linkPreview.url} target="_blank" rel="noopener noreferrer"
          className="mx-4 mb-3 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex gap-3 p-3 hover:bg-slate-100 transition-colors">
          {post.linkPreview.image && (
            <img src={post.linkPreview.image} alt="" className="w-20 h-16 object-cover rounded-lg flex-shrink-0"
              onError={e => (e.currentTarget.style.display="none")} />
          )}
          <div className="flex-1 min-w-0">
            {post.linkPreview.title && <p className="text-xs font-bold text-slate-900 line-clamp-1">{post.linkPreview.title}</p>}
            {post.linkPreview.description && <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{post.linkPreview.description}</p>}
            <p className="text-[10px] text-slate-400 mt-1 truncate">{post.linkPreview.url}</p>
          </div>
        </a>
      )}

      {/* Video embed */}
      {(() => {
        const ytMatch = post.body?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        const vimeoMatch = post.body?.match(/vimeo\.com\/(\d+)/);
        if (ytMatch) return (
          <div className="mx-4 mb-3 rounded-xl overflow-hidden aspect-video bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${ytMatch[1]}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
        if (vimeoMatch) return (
          <div className="mx-4 mb-3 rounded-xl overflow-hidden aspect-video bg-black">
            <iframe
              src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
        return null;
      })()}

      {/* Media */}
      {(post.mediaUrls?.length ?? 0) > 0 && (
        <CarouselImages urls={post.mediaUrls!} />
      )}

      {/* Reaction counts */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-50">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <span>👍❤️🙏</span>
          <span>{totalReactions(post)} reactions</span>
        </div>
        <span className="text-xs text-slate-400">{post.commentCount || 0} comments</span>
      </div>

      {/* Action buttons */}
      <div className="flex border-t border-slate-100 mx-4">
        {(["like", "heart", "pray"] as const).map((type, i) => {
          const icons = { like: "👍", heart: "❤️", pray: "🙏" };
          const labels = { like: "Like", heart: "Love", pray: "Pray" };
          return (
            <button key={type} onClick={() => onReact(post.id, type)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors rounded-xl ${myReaction === type ? "text-indigo-600" : "text-slate-500 hover:bg-slate-50"}`}>
              <span className="text-base">{icons[type]}</span>
              <span className="hidden sm:inline text-xs">{labels[type]}</span>
            </button>
          );
        })}
        <button onClick={() => onCommentToggle(post.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors rounded-xl">
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">Comment</span>
        </button>
        <button onClick={copyLink}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors rounded-xl">
          <Link2 className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">Share</span>
        </button>
      </div>

      {/* Comment input */}
      {commentingOn === post.id && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex gap-2">
          <textarea rows={2} value={commentText} onChange={e => onCommentChange(e.target.value)}
            placeholder="Write a comment…"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={() => onCommentSubmit(post.id)} disabled={!commentText.trim()}
            className="px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-indigo-700 transition-colors">
            Post
          </button>
        </div>
      )}
    </div>
  );
}
