"use client";
import React, { use, useEffect, useState } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  Radio,
  Clock,
  Globe,
  ExternalLink,
  StopCircle,
  MessageSquare,
  Video,
  Link2,
  AlertCircle,
} from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import toast from "react-hot-toast";
import type { LiveEvent } from "@/lib/types";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([^&?\s]+)/,
    /youtube\.com\/embed\/([^&?\s]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function formatDateTime(ts: Timestamp | null | undefined): string {
  if (!ts) return "";
  try {
    const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts as unknown as string);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function LiveEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const { profile } = useAuth();
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.LIVE_EVENTS, eventId));
        if (!snap.exists()) {
          setNotFound(true);
        } else {
          setEvent({ id: snap.id, ...snap.data() } as LiveEvent);
        }
      } catch (e) {
        console.error(e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  const handleEndStream = async () => {
    if (!event) return;
    setEnding(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.LIVE_EVENTS, event.id), {
        isLive: false,
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setEvent((prev) => (prev ? { ...prev, isLive: false } : prev));
      toast.success("Stream ended.");
    } catch {
      toast.error("Failed to end stream.");
    } finally {
      setEnding(false);
    }
  };

  if (loading) return <PageLoader />;

  if (notFound || !event) {
    return (
      <div className="max-w-2xl mx-auto py-16">
        <EmptyState
          icon={<AlertCircle className="w-6 h-6" />}
          title="Event not found"
          description="This event may have been removed or the link is incorrect."
          action={
            <Link href="/live">
              <Button variant="secondary">Back to Live & Meetings</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const isHost = profile?.id === event.hostedBy;
  const isPast = !event.isLive && !event.isScheduled;

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/live"
          className="text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors"
        >
          ← Live & Meetings
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ── Left: video + info ──────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Video embed */}
          <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-sm">
            <VideoEmbed event={event} />
          </div>

          {/* Info bar */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Avatar name={event.hostName} photoURL={event.hostPhoto} size="md" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    {event.isLive && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                        </span>
                        LIVE NOW
                      </span>
                    )}
                    {isPast && <Badge variant="default">Ended</Badge>}
                    {event.type === "youtube" && (
                      <Badge variant="danger" className="gap-1">
                        <Video className="w-3 h-3" />
                        YouTube
                      </Badge>
                    )}
                    {event.type === "jitsi" && (
                      <Badge variant="info" className="gap-1">
                        <Video className="w-3 h-3" />
                        Video Call
                      </Badge>
                    )}
                    {event.type === "other" && (
                      <Badge variant="default" className="gap-1">
                        <Link2 className="w-3 h-3" />
                        External
                      </Badge>
                    )}
                    {event.scope === "global" && (
                      <Badge variant="purple" className="gap-1">
                        <Globe className="w-3 h-3" />
                        Global
                      </Badge>
                    )}
                    {event.scope === "national" && event.nationName && (
                      <Badge variant="info">{event.nationName}</Badge>
                    )}
                    {event.scope === "city" && event.cityName && (
                      <Badge variant="success">{event.cityName}</Badge>
                    )}
                  </div>
                  <h1 className="text-lg font-black text-slate-900 leading-snug">
                    {event.title}
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Hosted by{" "}
                    <span className="font-semibold text-slate-700">{event.hostName}</span>
                  </p>
                  {event.isScheduled && event.scheduledAt && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Scheduled for {formatDateTime(event.scheduledAt)}</span>
                    </div>
                  )}
                  {event.description && (
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Host controls */}
              {isHost && event.isLive && (
                <div className="flex-shrink-0">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleEndStream}
                    loading={ending}
                  >
                    <StopCircle className="w-4 h-4" />
                    End Stream
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Right: chat sidebar ─────────────────────────────── */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <ChatSidebar />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VideoEmbed
// ─────────────────────────────────────────────────────────────

function VideoEmbed({ event }: { event: LiveEvent }) {
  if (event.type === "youtube") {
    const videoId = event.streamUrl ? getYouTubeId(event.streamUrl) : null;
    if (videoId) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          className="w-full aspect-video rounded-2xl"
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          title={event.title}
        />
      );
    }
    // Invalid or missing URL
    return (
      <div className="aspect-video flex flex-col items-center justify-center gap-4 p-6">
        <Video className="w-10 h-10 text-slate-500" />
        <p className="text-sm text-slate-400 text-center">
          Could not embed video. Use the link below.
        </p>
        {event.streamUrl && (
          <a
            href={event.streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open in YouTube
          </a>
        )}
      </div>
    );
  }

  if (event.type === "jitsi") {
    const roomName = event.roomName || `llgp-${event.id}`;
    return (
      <div className="space-y-0">
        <iframe
          src={`https://meet.jit.si/${roomName}`}
          className="w-full rounded-2xl"
          style={{ height: "600px" }}
          allow="camera; microphone; display-capture; fullscreen; autoplay"
          title={event.title}
        />
        <div className="bg-blue-950 px-4 py-2.5 rounded-b-2xl">
          <p className="text-xs text-blue-300 font-medium">
            This is a live video call. Make sure to allow camera and microphone access when prompted.
          </p>
        </div>
      </div>
    );
  }

  // Other / External
  return (
    <div className="aspect-video flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
        <Link2 className="w-7 h-7 text-slate-400" />
      </div>
      <div>
        <p className="text-white font-bold text-lg">{event.title}</p>
        <p className="text-sm text-slate-400 mt-1">
          This meeting uses an external link.
        </p>
      </div>
      {event.externalUrl ? (
        <a
          href={event.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="lg">
            <ExternalLink className="w-4 h-4" />
            Join Meeting
          </Button>
        </a>
      ) : (
        <p className="text-xs text-slate-500">No meeting link provided.</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ChatSidebar (placeholder)
// ─────────────────────────────────────────────────────────────

function ChatSidebar() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm h-full flex flex-col overflow-hidden" style={{ minHeight: "400px" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <MessageSquare className="w-4 h-4 text-slate-400" />
        <h2 className="text-sm font-bold text-slate-700">Live Chat</h2>
      </div>

      {/* Empty state */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <MessageSquare className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Live chat coming soon</p>
        <p className="text-xs text-slate-400 mt-1 max-w-[180px]">
          Real-time chat will be available in a future update.
        </p>
      </div>

      {/* Disabled input */}
      <div className="px-3 py-3 border-t border-slate-100">
        <div className="relative group">
          <input
            disabled
            placeholder="Chat will be available soon…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400 placeholder:text-slate-400 cursor-not-allowed"
          />
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Chat will be available in a future update
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
