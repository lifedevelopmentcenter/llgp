"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection, query, where, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp, doc, setDoc, getDocs, Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea, Select } from "@/components/ui/Input";
import { timeAgo } from "@/lib/utils";
import type { Post, Announcement, UserProfile, Story, LiveEvent } from "@/lib/types";
import { Radio, Plus, Globe, MessageSquare, Check, ChevronRight, X, Image, Link2 } from "lucide-react";
import toast from "react-hot-toast";

// ── Helpers ────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; colors: string; emoji: string }> = {
  testimony:     { label: "Testimony",  colors: "bg-green-100 text-green-700",  emoji: "✦" },
  prayer_request:{ label: "Prayer",     colors: "bg-blue-100 text-blue-700",    emoji: "🙏" },
  update:        { label: "Update",     colors: "bg-amber-100 text-amber-700",  emoji: "📢" },
  insight:       { label: "Insight",    colors: "bg-violet-100 text-violet-700",emoji: "💡" },
  event:         { label: "Event",      colors: "bg-rose-100 text-rose-700",    emoji: "📅" },
  poll:          { label: "Poll",       colors: "bg-cyan-100 text-cyan-700",    emoji: "📊" },
  share:         { label: "Shared",     colors: "bg-slate-100 text-slate-600",  emoji: "↗️" },
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

// ── Page ───────────────────────────────────────────────────

export default function DashboardPage() {
  const { profile } = useAuth();

  // Feed
  const [feed, setFeed] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

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

  // Feed tabs
  const [feedTab, setFeedTab] = useState<"global" | "following">("global");
  const [followingFeed, setFollowingFeed] = useState<Post[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);

  // Reactions & Comments
  const [reacted, setReacted] = useState<Record<string, string>>({});
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  // Right panel
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeMembers, setActiveMembers] = useState<UserProfile[]>([]);
  const [liveEvent, setLiveEvent] = useState<LiveEvent | null>(null);

  // ── Real-time feed ─────────────────────────────────────

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, COLLECTIONS.POSTS),
      where("scope", "==", "global"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
      setFeed(items);
      setFeedLoading(false);
    });
    return unsub;
  }, [profile]);

  // ── Following feed ────────────────────────────────────

  useEffect(() => {
    if (!profile || feedTab !== "following") return;
    setFollowingLoading(true);
    const loadFollowingFeed = async () => {
      try {
        const followsSnap = await getDocs(
          query(
            collection(db, COLLECTIONS.FOLLOWS),
            where("followerId", "==", profile.id)
          )
        );
        const followingIds = followsSnap.docs.map(d => d.data().followingId as string);
        if (followingIds.length === 0) {
          setFollowingFeed([]);
          setFollowingLoading(false);
          return;
        }
        const postsSnap = await getDocs(
          query(
            collection(db, COLLECTIONS.POSTS),
            where("authorId", "in", followingIds),
            orderBy("createdAt", "desc"),
            limit(20)
          )
        );
        setFollowingFeed(postsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
      } catch (e) {
        console.error(e);
      } finally {
        setFollowingLoading(false);
      }
    };
    loadFollowingFeed();
  }, [profile, feedTab]);

  // ── Side data (stories, announcements, members, live) ─

  useEffect(() => {
    if (!profile) return;
    const now = Timestamp.now();

    // Stories
    const storyQ = query(
      collection(db, COLLECTIONS.STORIES),
      where("expiresAt", ">", now),
      orderBy("expiresAt"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsubStories = onSnapshot(storyQ, snap => {
      setStories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Story)));
    });

    // Announcements, members, live (one-time)
    const loadSide = async () => {
      try {
        const [annSnap, membersSnap, liveSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.ANNOUNCEMENTS), orderBy("createdAt", "desc"), limit(3))),
          getDocs(query(collection(db, COLLECTIONS.USERS), where("isActive", "==", true), orderBy("displayName"), limit(10))),
          getDocs(query(collection(db, COLLECTIONS.LIVE_EVENTS), where("isLive", "==", true), limit(1))),
        ]);
        setAnnouncements(annSnap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
        setActiveMembers(membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
        if (liveSnap.docs.length > 0) {
          setLiveEvent({ id: liveSnap.docs[0].id, ...liveSnap.docs[0].data() } as LiveEvent);
        }
      } catch (e) { console.error(e); }
    };
    loadSide();

    // Load user's reactions for visible posts
    const loadReactions = async () => {
      try {
        const rSnap = await getDocs(
          query(collection(db, COLLECTIONS.REACTIONS), where("userId", "==", profile.id), limit(50))
        );
        const map: Record<string, string> = {};
        rSnap.docs.forEach(d => {
          const data = d.data();
          map[data.postId] = data.type;
        });
        setReacted(map);
      } catch (e) { /* silent */ }
    };
    loadReactions();

    return () => { unsubStories(); };
  }, [profile]);

  // ── Actions ────────────────────────────────────────────

  const handleReact = async (postId: string, type: "like" | "heart" | "pray") => {
    if (!profile) return;
    const existing = reacted[postId];
    const reactId = `${postId}_${profile.id}`;
    try {
      if (existing === type) {
        // toggle off — optimistic
        setReacted(prev => { const n = { ...prev }; delete n[postId]; return n; });
        await setDoc(doc(db, COLLECTIONS.REACTIONS, reactId), {
          postId, userId: profile.id, type: null, deletedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        setReacted(prev => ({ ...prev, [postId]: type }));
        await setDoc(doc(db, COLLECTIONS.REACTIONS, reactId), {
          postId, postType: "post", userId: profile.id, type, createdAt: serverTimestamp(),
        });
      }
    } catch { toast.error("Reaction failed"); }
  };

  const handleComment = async (postId: string) => {
    if (!profile || !commentText.trim()) return;
    try {
      await addDoc(collection(db, COLLECTIONS.COMMENTS), {
        parentId: postId,
        parentType: "post",
        authorId: profile.id,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL || null,
        body: commentText.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCommentText("");
      setCommentingOn(null);
      toast.success("Comment posted");
    } catch { toast.error("Failed to post comment"); }
  };

  const handleCompose = async () => {
    if (!profile || !composeBody.trim()) return;
    setComposeSaving(true);
    try {
      const newPost = await addDoc(collection(db, COLLECTIONS.POSTS), {
        authorId: profile.id,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL || null,
        nationName: profile.nationName || null,
        cityName: profile.cityName || null,
        body: composeBody.trim(),
        type: composeType,
        scope: composeScope,
        nationId: profile.nationId || null,
        cityId: profile.cityId || null,
        mediaUrls: [],
        commentCount: 0,
        reactionCounts: { like: 0, heart: 0, pray: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setComposeBody("");
      setComposeType("update");
      setComposeScope("global");
      setComposeOpen(false);
      toast.success("Posted!");
    } catch { toast.error("Failed to post"); }
    finally { setComposeSaving(false); }
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
        authorId: profile.id,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL || null,
        imageUrl: imageUrl || null,
        caption: storyCaption.trim() || null,
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        createdAt: serverTimestamp(),
      });
      setCreateStoryOpen(false);
      setStoryCaption("");
      setStoryImageFile(null);
      setStoryImagePreview(null);
      toast.success("Story shared!");
    } catch { toast.error("Failed to share story"); }
    finally { setStorySaving(false); }
  };

  if (!profile) return null;
  const firstName = (profile.displayName ?? "Friend").split(" ")[0];

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="animate-fade-in pb-10">
      <div className="flex gap-6 items-start max-w-5xl mx-auto">

        {/* ── Center column ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* LIVE NOW */}
          {liveEvent && (
            <Link href={`/live/${liveEvent.id}`} className="block">
              <div className="relative overflow-hidden bg-gradient-to-r from-rose-600 to-pink-600 rounded-2xl p-4 text-white flex items-center gap-4 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-150">
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Radio className="w-6 h-6 text-white" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">● LIVE NOW</span>
                  <p className="font-black text-sm leading-snug truncate mt-0.5">{liveEvent.title}</p>
                  <p className="text-xs text-white/70">{liveEvent.hostName} · Tap to join</p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/70 flex-shrink-0" />
              </div>
            </Link>
          )}

          {/* Stories strip */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="overflow-x-auto no-scrollbar flex gap-3 pb-2">
              {/* Add Story */}
              <button onClick={() => setCreateStoryOpen(true)}
                className="flex-shrink-0 w-24 flex flex-col items-center gap-1.5">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center ring-2 ring-white shadow">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <span className="text-[10px] text-slate-500 font-semibold text-center leading-tight">Your Story</span>
              </button>

              {stories.map(s => (
                <button key={s.id} onClick={() => setViewingStory(s)}
                  className="flex-shrink-0 w-24 flex flex-col items-center gap-1.5">
                  <div className="w-16 h-16 rounded-full ring-2 ring-indigo-500 ring-offset-2 overflow-hidden shadow">
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

          {/* Post composer */}
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
                { label: "Photo",     icon: "🖼️",  type: "update" as const },
                { label: "Prayer",    icon: "🙏",  type: "prayer_request" as const },
                { label: "Testimony", icon: "✦",   type: "testimony" as const },
                { label: "Insight",   icon: "💡",  type: "insight" as const },
              ].map(item => (
                <button key={item.type}
                  onClick={() => { setComposeType(item.type); setComposeOpen(true); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                  <span>{item.icon}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Feed tab switcher */}
          <div className="flex gap-2">
            {([
              { key: "global",    label: "For You" },
              { key: "following", label: "Following" },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setFeedTab(tab.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  feedTab === tab.key
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Feed */}
          {feedTab === "global" ? (feedLoading ? (
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
          ) : feed.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
              <p className="text-slate-400 text-sm">No posts yet. Be the first to share!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {feed.map(post => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  myReaction={reacted[post.id]}
                  onReact={handleReact}
                  commentingOn={commentingOn}
                  commentText={commentText}
                  onCommentToggle={id => {
                    setCommentingOn(prev => prev === id ? null : id);
                    setCommentText("");
                  }}
                  onCommentChange={setCommentText}
                  onCommentSubmit={handleComment}
                />
              ))}
            </div>
          )) : (
            /* Following tab */
            followingLoading ? (
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
            ) : followingFeed.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
                <p className="text-slate-500 text-sm font-semibold mb-1">You&apos;re not following anyone yet</p>
                <p className="text-slate-400 text-xs mb-4">Follow people to see their posts here.</p>
                <Link href="/community/directory" className="text-indigo-600 text-sm font-semibold hover:underline">
                  Browse the directory →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {followingFeed.map(post => (
                  <FeedPostCard
                    key={post.id}
                    post={post}
                    myReaction={reacted[post.id]}
                    onReact={handleReact}
                    commentingOn={commentingOn}
                    commentText={commentText}
                    onCommentToggle={id => {
                      setCommentingOn(prev => prev === id ? null : id);
                      setCommentText("");
                    }}
                    onCommentChange={setCommentText}
                    onCommentSubmit={handleComment}
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* ── Right panel (desktop only) ── */}
        <div className="hidden lg:block w-72 flex-shrink-0 space-y-4 sticky top-20">
          {/* Active members */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">People You May Know</p>
            <div className="space-y-2">
              {activeMembers.slice(0, 6).map(m => (
                <Link key={m.id} href={`/profile/${m.id}`}
                  className="flex items-center gap-3 hover:bg-slate-50 rounded-xl p-1.5 transition-colors">
                  <Avatar name={m.displayName ?? "?"} photoURL={m.photoURL} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.displayName}</p>
                    <p className="text-xs text-slate-400 truncate">{m.nationName}</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>

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
        </div>
      </div>

      {/* ── Modals ── */}

      {/* Compose */}
      <Modal open={composeOpen} onClose={() => setComposeOpen(false)} title="Create Post" size="md">
        <div className="space-y-4">
          <Textarea
            placeholder="What's on your mind?"
            rows={5}
            value={composeBody}
            onChange={e => setComposeBody(e.target.value)}
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <Select
                label="Type"
                value={composeType}
                onChange={e => setComposeType(e.target.value as Post["type"])}
              >
                <option value="update">Update</option>
                <option value="testimony">Testimony</option>
                <option value="prayer_request">Prayer Request</option>
                <option value="insight">Insight</option>
                <option value="event">Event</option>
              </Select>
            </div>
            <div className="flex-1">
              <Select
                label="Scope"
                value={composeScope}
                onChange={e => setComposeScope(e.target.value as "global" | "national" | "city")}
              >
                <option value="global">Global</option>
                <option value="national">National</option>
                <option value="city">City</option>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleCompose}
            disabled={!composeBody.trim() || composeSaving}
            className="w-full"
          >
            {composeSaving ? "Posting…" : "Post"}
          </Button>
        </div>
      </Modal>

      {/* Create Story */}
      <Modal open={createStoryOpen} onClose={() => { setCreateStoryOpen(false); setStoryImagePreview(null); setStoryImageFile(null); setStoryCaption(""); }} title="Share a Story" size="sm">
        <div className="space-y-4">
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 transition-colors overflow-hidden">
            {storyImagePreview
              ? <img src={storyImagePreview} className="w-full h-full object-cover" alt="preview" />
              : <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Image className="w-8 h-8" />
                  <span className="text-sm font-medium">Tap to add photo</span>
                </div>
            }
            <input type="file" accept="image/*" className="sr-only" onChange={handleStoryImageChange} />
          </label>
          <Textarea
            placeholder="Add a caption…"
            rows={2}
            value={storyCaption}
            onChange={e => setStoryCaption(e.target.value)}
          />
          <Button onClick={handleCreateStory} disabled={(!storyImageFile && !storyCaption.trim()) || storySaving} className="w-full">
            {storySaving ? "Sharing…" : "Share Story"}
          </Button>
        </div>
      </Modal>

      {/* Story viewer */}
      {viewingStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setViewingStory(null)}>
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            {/* Progress bar */}
            <div className="w-full h-1 bg-white/20 rounded-full mb-3 overflow-hidden">
              <div className="h-full bg-white rounded-full w-3/4" />
            </div>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <Avatar name={viewingStory.authorName} photoURL={viewingStory.authorPhoto} size="sm" />
              <span className="text-white text-sm font-semibold">{viewingStory.authorName}</span>
              <span className="text-white/50 text-xs ml-auto">{timeAgo(viewingStory.createdAt)}</span>
            </div>
            {/* Image */}
            {viewingStory.imageUrl && (
              <img src={viewingStory.imageUrl} className="w-full rounded-2xl object-cover max-h-[70vh]" alt="story" />
            )}
            {/* Caption */}
            {viewingStory.caption && (
              <p className="text-white text-sm mt-3 text-center">{viewingStory.caption}</p>
            )}
            {/* Close */}
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
}

function FeedPostCard({
  post, myReaction, onReact,
  commentingOn, commentText,
  onCommentToggle, onCommentChange, onCommentSubmit,
}: FeedPostCardProps) {
  const meta = TYPE_META[post.type] ?? { label: post.type, colors: "bg-slate-100 text-slate-600", emoji: "" };

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/dashboard?post=${post.id}`);
    toast("Link copied!");
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <Link href={`/profile/${post.authorId}`} className="flex items-center gap-3">
          <Avatar name={post.authorName} photoURL={post.authorPhoto} size="md" className="flex-shrink-0" />
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
              <span>{timeAgo(post.createdAt)}</span>
              <span>·</span>
              <Globe className="w-3 h-3" />
            </div>
          </div>
        </Link>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.colors}`}>
          {meta.emoji} {meta.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 pb-3">
        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
          {renderHashtags(post.body)}
        </p>
      </div>

      {/* Media */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className={`grid gap-1 ${post.mediaUrls.length === 1 ? "" : "grid-cols-2"} mb-1`}>
          {post.mediaUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              className={`w-full object-cover ${post.mediaUrls!.length === 1 ? "max-h-96 rounded-none" : "aspect-square"}`}
              alt=""
            />
          ))}
        </div>
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
        {([
          { icon: "👍", label: "Like",  type: "like"  as const },
          { icon: "❤️", label: "Love",  type: "heart" as const },
          { icon: "🙏", label: "Pray",  type: "pray"  as const },
        ] as const).map(btn => (
          <button key={btn.type}
            onClick={() => onReact(post.id, btn.type)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors rounded-xl ${myReaction === btn.type ? "text-indigo-600" : "text-slate-500 hover:bg-slate-50"}`}>
            <span className="text-base">{btn.icon}</span>
            <span className="hidden sm:inline text-xs">{btn.label}</span>
          </button>
        ))}
        <button
          onClick={() => onCommentToggle(post.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors rounded-xl">
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">Comment</span>
        </button>
        <button
          onClick={copyLink}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors rounded-xl">
          <Link2 className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">Share</span>
        </button>
      </div>

      {/* Comment input */}
      {commentingOn === post.id && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex gap-2">
          <textarea
            rows={2}
            value={commentText}
            onChange={e => onCommentChange(e.target.value)}
            placeholder="Write a comment…"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => onCommentSubmit(post.id)}
            disabled={!commentText.trim()}
            className="px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-indigo-700 transition-colors">
            Post
          </button>
        </div>
      )}
    </div>
  );
}
