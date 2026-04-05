"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import {
  collection, query, where, getDocs, orderBy, limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { StoriesStrip } from "@/components/features/StoriesStrip";
import { timeAgo } from "@/lib/utils";
import { Eye, BookOpen } from "lucide-react";
import type { Story } from "@/lib/types";

export default function StoriesPage() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStories = async () => {
    try {
      const q = query(
        collection(db, COLLECTIONS.STORIES),
        where("expiresAt", ">", Timestamp.now()),
        orderBy("expiresAt"),
        orderBy("createdAt", "desc"),
        limit(60)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Story));
      data.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      setStories(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStories(); }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Stories</h1>
        <p className="text-sm text-slate-500 mt-0.5">24-hour photo updates from your community</p>
      </div>

      {/* Strip — includes Add Story button */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <StoriesStrip />
      </div>

      {/* Grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">All Active Stories</h2>

        {loading ? (
          <PageLoader />
        ) : stories.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-8 h-8 text-slate-300" />}
            title="No stories yet"
            description="Be the first to share a story — it'll be visible for 24 hours."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} currentUserId={user?.uid ?? ""} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Story Card ───────────────────────────────────────────────────────────────

function StoryCard({ story, currentUserId }: { story: Story; currentUserId: string }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const viewed = story.viewerIds?.includes(currentUserId);
  const isOwn = story.authorId === currentUserId;

  return (
    <>
      <button
        onClick={() => setViewerOpen(true)}
        className="relative rounded-2xl overflow-hidden aspect-[9/16] bg-slate-100 group focus:outline-none shadow-sm"
      >
        {/* Background */}
        {story.imageUrl ? (
          <img
            src={story.imageUrl}
            alt={story.authorName}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center p-3">
            {story.caption && (
              <p className="text-white text-xs font-medium text-center line-clamp-5">{story.caption}</p>
            )}
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        {/* Top ring indicator */}
        <div
          className={`absolute top-2 left-2 w-8 h-8 rounded-full ring-2 ring-offset-1 overflow-hidden ${
            viewed ? "ring-slate-300" : "ring-indigo-500"
          }`}
        >
          <Avatar
            name={story.authorName}
            photoURL={story.authorPhoto}
            size="sm"
            className="w-8 h-8"
          />
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <p className="text-white text-xs font-semibold truncate leading-tight">
            {isOwn ? "You" : story.authorName.split(" ")[0]}
          </p>
          <p className="text-white/60 text-[10px] leading-tight">{timeAgo(story.createdAt)}</p>
          {isOwn && (
            <p className="text-white/70 text-[10px] flex items-center gap-1 mt-0.5">
              <Eye className="w-3 h-3" />
              {story.viewerIds?.length ?? 0}
            </p>
          )}
        </div>
      </button>

      {/* Single-story viewer — reuse inline logic */}
      {viewerOpen && (
        <SingleStoryViewer
          story={story}
          onClose={() => setViewerOpen(false)}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}

// ─── Minimal single-story viewer for the grid ─────────────────────────────────

import {
  updateDoc, doc, arrayUnion,
} from "firebase/firestore";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

function SingleStoryViewer({
  story,
  onClose,
  currentUserId,
}: {
  story: Story;
  onClose: () => void;
  currentUserId: string;
}) {
  const isOwn = story.authorId === currentUserId;
  const hasViewed = story.viewerIds?.includes(currentUserId);

  useEffect(() => {
    if (isOwn || hasViewed) return;
    updateDoc(doc(db, COLLECTIONS.STORIES, story.id), {
      viewerIds: arrayUnion(currentUserId),
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-4 pt-6">
        <Avatar
          name={story.authorName}
          photoURL={story.authorPhoto}
          size="sm"
          className="ring-2 ring-white"
        />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{story.authorName}</p>
          <p className="text-white/60 text-xs">{timeAgo(story.createdAt)}</p>
        </div>
        {isOwn && (
          <span className="flex items-center gap-1 text-white/70 text-xs">
            <Eye className="w-3.5 h-3.5" />
            {story.viewerIds?.length ?? 0}
          </span>
        )}
        <button onClick={onClose} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Image */}
      {story.imageUrl ? (
        <img
          src={story.imageUrl}
          alt={story.caption ?? "Story"}
          className="max-w-full max-h-full object-contain"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center">
          <p className="text-white text-xl font-semibold px-8 text-center">{story.caption}</p>
        </div>
      )}

      {/* Caption */}
      {story.imageUrl && story.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-8 pt-10 pointer-events-none">
          <p className="text-white text-sm text-center">{story.caption}</p>
        </div>
      )}
    </div>
  );
}
