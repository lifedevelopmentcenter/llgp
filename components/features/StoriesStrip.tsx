"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  collection, query, where, getDocs, addDoc, updateDoc,
  doc, serverTimestamp, Timestamp, arrayUnion, orderBy, limit,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Plus, X, ChevronLeft, ChevronRight, Eye, Camera } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";
import type { Story } from "@/lib/types";

interface StoriesStripProps {
  className?: string;
}

// ─── Story Viewer ────────────────────────────────────────────────────────────

interface ViewerProps {
  stories: Story[];
  startIndex: number;
  onClose: () => void;
  currentUserId: string;
}

function StoryViewer({ stories, startIndex, onClose, currentUserId }: ViewerProps) {
  const [idx, setIdx] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const story = stories[idx];
  const isOwn = story?.authorId === currentUserId;
  const hasViewed = story?.viewerIds?.includes(currentUserId);

  // Mark as viewed
  useEffect(() => {
    if (!story || isOwn || hasViewed) return;
    updateDoc(doc(db, COLLECTIONS.STORIES, story.id), {
      viewerIds: arrayUnion(currentUserId),
    }).catch(() => {});
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Progress & auto-advance
  useEffect(() => {
    setProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);

    intervalRef.current = setInterval(() => {
      setProgress((p) => Math.min(p + 2, 100));
    }, 100);

    timerRef.current = setTimeout(() => {
      if (idx < stories.length - 1) {
        setIdx((i) => i + 1);
      } else {
        onClose();
      }
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!story) return null;

  const goNext = () => {
    if (idx < stories.length - 1) setIdx(idx + 1);
    else onClose();
  };
  const goPrev = () => {
    if (idx > 0) setIdx(idx - 1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-none"
              style={{ width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div className="absolute top-4 left-0 right-0 z-10 flex items-center gap-3 px-4 pt-4">
        <Avatar
          name={story.authorName}
          photoURL={story.authorPhoto}
          size="sm"
          className="ring-2 ring-white"
        />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold leading-tight truncate">{story.authorName}</p>
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

      {/* Story image */}
      <div className="w-full h-full flex items-center justify-center">
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
      </div>

      {/* Caption */}
      {story.imageUrl && story.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-8 pt-10 pointer-events-none">
          <p className="text-white text-sm text-center">{story.caption}</p>
        </div>
      )}

      {/* Left/right nav */}
      {idx > 0 && (
        <button
          onClick={goPrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {idx < stories.length - 1 && (
        <button
          onClick={goNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

// ─── Create Story Modal ───────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onCreated: () => void;
  userId: string;
  userName: string;
  userPhoto?: string | null;
}

function CreateStoryModal({ onClose, onCreated, userId, userName, userPhoto }: CreateModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file && !caption.trim()) {
      toast.error("Add an image or caption.");
      return;
    }
    setSubmitting(true);
    try {
      let imageUrl: string | undefined;
      if (file) {
        const storageRef = ref(storage, `stories/${userId}/${Date.now()}_${file.name}`);
        const snap = await uploadBytes(storageRef, file);
        imageUrl = await getDownloadURL(snap.ref);
      }
      await addDoc(collection(db, COLLECTIONS.STORIES), {
        authorId: userId,
        authorName: userName,
        authorPhoto: userPhoto ?? null,
        imageUrl,
        caption: caption.trim() || undefined,
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        viewerIds: [],
        createdAt: serverTimestamp(),
      });
      toast.success("Story posted! It'll be visible for 24 hours.");
      onCreated();
    } catch {
      toast.error("Failed to post story.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-xl z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Create Story</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "relative border-2 border-dashed rounded-xl cursor-pointer transition-colors flex items-center justify-center",
              dragging ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50",
              preview ? "h-48" : "h-36"
            )}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="h-full w-full object-contain rounded-xl" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Camera className="w-8 h-8" />
                <p className="text-sm">Click or drag an image here</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          {/* Caption */}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 200))}
            placeholder="Add a caption... (optional)"
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-slate-400 text-right -mt-2">{caption.length}/200</p>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? "Posting…" : "Post Story"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StoriesStrip({ className }: StoriesStripProps) {
  const { user, profile } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStartIdx, setViewerStartIdx] = useState(0);

  const loadStories = async () => {
    try {
      const q = query(
        collection(db, COLLECTIONS.STORIES),
        where("expiresAt", ">", Timestamp.now()),
        orderBy("expiresAt"),
        orderBy("createdAt", "desc"),
        limit(30)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Story));
      // Sort by createdAt desc after fetch
      data.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      setStories(data);
    } catch {
      // silently fail — stories are non-critical
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStories(); }, []);

  if (!user || !profile) return null;

  // Deduplicate by author (keep latest per author)
  const deduped = stories.reduce((acc, story) => {
    if (!acc.find((s) => s.authorId === story.authorId)) acc.push(story);
    return acc;
  }, [] as Story[]);

  const ownStory = deduped.find((s) => s.authorId === user.uid);
  // Stories list for viewer: put others first in strip order
  const viewableStories = deduped;

  const openViewer = (story: Story) => {
    const idx = viewableStories.findIndex((s) => s.id === story.id);
    setViewerStartIdx(idx >= 0 ? idx : 0);
    setViewerOpen(true);
  };

  const handleAddClick = () => {
    if (ownStory) {
      openViewer(ownStory);
    } else {
      setShowCreate(true);
    }
  };

  return (
    <>
      <div className={cn("w-full", className)}>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide px-1">
          {/* Add / Your Story */}
          <button
            onClick={handleAddClick}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 focus:outline-none group"
          >
            <div className="relative">
              <div
                className={cn(
                  "w-16 h-16 rounded-full overflow-hidden ring-offset-2",
                  ownStory ? "ring-2 ring-indigo-500" : "ring-2 ring-slate-300"
                )}
              >
                <Avatar
                  name={profile.displayName ?? "You"}
                  photoURL={profile.photoURL}
                  size="xl"
                  className="w-16 h-16"
                />
              </div>
              {/* Plus badge */}
              <span className="absolute bottom-0 right-0 w-5 h-5 bg-indigo-600 border-2 border-white rounded-full flex items-center justify-center">
                <Plus className="w-3 h-3 text-white" />
              </span>
            </div>
            <span className="text-xs text-slate-600 truncate w-16 text-center">
              {ownStory ? "Your Story" : "Add Story"}
            </span>
          </button>

          {/* Other stories */}
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-slate-100 animate-pulse" />
                  <div className="w-12 h-2.5 bg-slate-100 rounded animate-pulse" />
                </div>
              ))
            : deduped
                .filter((s) => s.authorId !== user.uid)
                .map((story) => {
                  const viewed = story.viewerIds?.includes(user.uid);
                  return (
                    <button
                      key={story.id}
                      onClick={() => openViewer(story)}
                      className="flex flex-col items-center gap-1.5 flex-shrink-0 focus:outline-none"
                    >
                      <div
                        className={cn(
                          "w-16 h-16 rounded-full overflow-hidden ring-offset-2",
                          viewed ? "ring-2 ring-slate-300" : "ring-2 ring-indigo-500"
                        )}
                      >
                        {story.imageUrl ? (
                          <img
                            src={story.imageUrl}
                            alt={story.authorName}
                            className="w-16 h-16 object-cover"
                          />
                        ) : (
                          <Avatar
                            name={story.authorName}
                            photoURL={story.authorPhoto}
                            size="xl"
                            className="w-16 h-16"
                          />
                        )}
                      </div>
                      <span className="text-xs text-slate-600 truncate w-16 text-center">
                        {story.authorName.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateStoryModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadStories(); }}
          userId={user.uid}
          userName={profile.displayName ?? "Unknown"}
          userPhoto={profile.photoURL}
        />
      )}

      {/* Story viewer */}
      {viewerOpen && viewableStories.length > 0 && (
        <StoryViewer
          stories={viewableStories}
          startIndex={viewerStartIdx}
          onClose={() => { setViewerOpen(false); loadStories(); }}
          currentUserId={user.uid}
        />
      )}
    </>
  );
}
