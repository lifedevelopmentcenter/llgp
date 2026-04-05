"use client";
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { ExternalLink, Radio, Video, Lightbulb, FileText, Globe } from "lucide-react";
import toast from "react-hot-toast";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import type { Spotlight } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// Type helpers
// ─────────────────────────────────────────────────────────────

type SpotlightType = Spotlight["type"];

const TYPE_LABELS: Record<SpotlightType, string> = {
  podcast: "Podcast",
  video: "Video",
  initiative: "Initiative",
  article: "Article",
  website: "Website",
};

const TYPE_BADGE_VARIANT: Record<
  SpotlightType,
  "purple" | "danger" | "info" | "warning" | "default"
> = {
  podcast: "purple",
  video: "danger",
  initiative: "info",
  article: "warning",
  website: "default",
};

const TYPE_EMOJI: Record<SpotlightType, string> = {
  podcast: "🎙️",
  video: "▶️",
  initiative: "🚀",
  article: "📝",
  website: "🌐",
};

const TYPE_ICON: Record<SpotlightType, React.ReactNode> = {
  podcast: <Radio className="w-8 h-8 text-white/80" />,
  video: <Video className="w-8 h-8 text-white/80" />,
  initiative: <Lightbulb className="w-8 h-8 text-white/80" />,
  article: <FileText className="w-8 h-8 text-white/80" />,
  website: <Globe className="w-8 h-8 text-white/80" />,
};

const TYPE_GRADIENT: Record<SpotlightType, string> = {
  podcast: "from-purple-500 to-indigo-600",
  video: "from-red-500 to-rose-600",
  initiative: "from-indigo-500 to-blue-600",
  article: "from-amber-500 to-orange-500",
  website: "from-teal-500 to-cyan-600",
};

const FILTER_OPTIONS: Array<{ value: SpotlightType | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "podcast", label: "Podcast" },
  { value: "video", label: "Video" },
  { value: "initiative", label: "Initiative" },
  { value: "article", label: "Article" },
  { value: "website", label: "Website" },
];

// ─────────────────────────────────────────────────────────────
// Spotlight Card
// ─────────────────────────────────────────────────────────────

function SpotlightCard({
  spotlight,
  onApprove,
  onReject,
  isAdmin,
  isPending,
}: {
  spotlight: Spotlight;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  isAdmin?: boolean;
  isPending?: boolean;
}) {
  return (
    <Card className={`flex flex-col gap-0 p-0 overflow-hidden ${isPending ? "border-amber-200 bg-amber-50" : ""}`}>
      {/* Thumbnail */}
      {spotlight.thumbnailUrl ? (
        <img
          src={spotlight.thumbnailUrl}
          alt={spotlight.title}
          className="w-full h-36 object-cover"
        />
      ) : (
        <div
          className={`w-full h-36 bg-gradient-to-br ${TYPE_GRADIENT[spotlight.type]} flex items-center justify-center`}
        >
          {TYPE_ICON[spotlight.type]}
        </div>
      )}

      {/* Content */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Type badge */}
        <Badge variant={TYPE_BADGE_VARIANT[spotlight.type]}>
          {TYPE_EMOJI[spotlight.type]} {TYPE_LABELS[spotlight.type]}
        </Badge>

        {/* Title */}
        <p className="font-semibold text-slate-900 text-sm line-clamp-2 leading-snug">
          {spotlight.title}
        </p>

        {/* Person */}
        <div className="flex items-center gap-1.5">
          <Avatar name={spotlight.personName} photoURL={spotlight.personPhoto} size="xs" />
          <span className="text-xs text-slate-500 truncate">{spotlight.personName}</span>
        </div>

        {/* Actions */}
        <div className="mt-auto pt-1 flex items-center gap-2 flex-wrap">
          <a
            href={spotlight.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Visit <ExternalLink className="w-3 h-3" />
          </a>
          {isPending && isAdmin && onApprove && onReject && (
            <>
              <Button size="sm" onClick={() => onApprove(spotlight.id)}>
                Approve
              </Button>
              <Button size="sm" variant="danger" onClick={() => onReject(spotlight.id)}>
                Reject
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Submit Form state
// ─────────────────────────────────────────────────────────────

interface SubmitForm {
  title: string;
  description: string;
  url: string;
  type: SpotlightType;
  thumbnailUrl: string;
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function SpotlightsPage() {
  const { profile } = useAuth();
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [pendingSpotlights, setPendingSpotlights] = useState<Spotlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<SpotlightType | "all">("all");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<SubmitForm>({
    title: "",
    description: "",
    url: "",
    type: "initiative",
    thumbnailUrl: "",
  });

  const isAdmin = profile?.role === "global_admin";

  const loadSpotlights = async () => {
    try {
      const approvedQ = query(
        collection(db, COLLECTIONS.SPOTLIGHTS),
        where("isApproved", "==", true),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(approvedQ);
      setSpotlights(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Spotlight)));

      if (isAdmin) {
        const pendingQ = query(
          collection(db, COLLECTIONS.SPOTLIGHTS),
          where("isApproved", "==", false),
          orderBy("createdAt", "desc")
        );
        const pendingSnap = await getDocs(pendingQ);
        setPendingSpotlights(
          pendingSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Spotlight))
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpotlights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Pre-fill name when modal opens
  const openModal = () => {
    setForm((f) => ({ ...f }));
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.title.trim() || !form.url.trim()) {
      toast.error("Title and URL are required.");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, COLLECTIONS.SPOTLIGHTS), {
        title: form.title.trim(),
        description: form.description.trim() || null,
        url: form.url.trim(),
        type: form.type,
        thumbnailUrl: form.thumbnailUrl.trim() || null,
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
      setShowModal(false);
      setForm({ title: "", description: "", url: "", type: "initiative", thumbnailUrl: "" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.SPOTLIGHTS, id), {
        isApproved: true,
        updatedAt: serverTimestamp(),
      });
      toast.success("Spotlight published!");
      setPendingSpotlights((prev) => prev.filter((s) => s.id !== id));
      loadSpotlights();
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve.");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.SPOTLIGHTS, id));
      toast.success("Spotlight removed.");
      setPendingSpotlights((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to reject.");
    }
  };

  const filtered =
    activeFilter === "all" ? spotlights : spotlights.filter((s) => s.type === activeFilter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Spotlights</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Discover initiatives, podcasts, and videos from Leading Lights members
          </p>
        </div>
        {profile && (
          <Button size="sm" onClick={openModal} className="flex-shrink-0">
            + Submit Spotlight
          </Button>
        )}
      </div>

      {/* Admin: Pending section */}
      {isAdmin && pendingSpotlights.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600">
            Pending Review ({pendingSpotlights.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {pendingSpotlights.map((s) => (
              <SpotlightCard
                key={s.id}
                spotlight={s}
                isAdmin={isAdmin}
                isPending
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setActiveFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
              activeFilter === opt.value
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="w-6 h-6" />}
          title="No spotlights yet"
          description={
            activeFilter === "all"
              ? "Be the first to submit a spotlight!"
              : `No ${TYPE_LABELS[activeFilter as SpotlightType]} spotlights yet.`
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((s) => (
            <SpotlightCard key={s.id} spotlight={s} />
          ))}
        </div>
      )}

      {/* Submit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Submit a Spotlight"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. The Marketplace Podcast"
            required
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Tell us about this spotlight..."
            rows={3}
          />
          <Input
            label="URL"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://..."
            type="url"
            required
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as SpotlightType }))}
          >
            <option value="podcast">Podcast</option>
            <option value="video">Video</option>
            <option value="initiative">Initiative</option>
            <option value="article">Article</option>
            <option value="website">Website</option>
          </Select>
          <Input
            label="Your Name"
            value={profile?.displayName ?? ""}
            readOnly
            className="bg-slate-50 text-slate-500"
          />
          <Input
            label="Thumbnail URL (optional)"
            value={form.thumbnailUrl}
            onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
            placeholder="https://example.com/image.jpg"
            type="url"
          />
          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={submitting} className="flex-1">
              Submit Spotlight
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
