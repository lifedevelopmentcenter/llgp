"use client";
import React, { useEffect, useState } from "react";
import { use } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  limit,
  Timestamp,
} from "firebase/firestore";
import {
  Radio,
  Video,
  Link2,
  Plus,
  Calendar,
  Clock,
  Globe,
  MapPin,
  Users,
  StopCircle,
} from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import toast from "react-hot-toast";
import type { LiveEvent } from "@/lib/types";
import Link from "next/link";

const LEADER_ROLES = ["global_admin", "national_leader", "city_leader", "hub_leader"];

function formatScheduled(ts: Timestamp | null | undefined): string {
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

function getCountdown(ts: Timestamp | null | undefined): string {
  if (!ts) return "";
  try {
    const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts as unknown as string);
    const diff = d.getTime() - Date.now();
    if (diff <= 0) return "Starting soon";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 48) {
      const days = Math.floor(hours / 24);
      return `In ${days} day${days !== 1 ? "s" : ""}`;
    }
    if (hours > 0) return `In ${hours}h ${mins}m`;
    return `In ${mins}m`;
  } catch {
    return "";
  }
}

type EventType = "youtube" | "jitsi" | "other";
type EventScope = "global" | "national" | "city";

interface CreateForm {
  title: string;
  description: string;
  type: EventType;
  streamUrl: string;
  externalUrl: string;
  isScheduled: boolean;
  scheduledAt: string;
  scope: EventScope;
}

const defaultForm: CreateForm = {
  title: "",
  description: "",
  type: "jitsi",
  streamUrl: "",
  externalUrl: "",
  isScheduled: false,
  scheduledAt: "",
  scope: "global",
};

export default function LivePage() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ending, setEnding] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [form, setForm] = useState<CreateForm>(defaultForm);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, COLLECTIONS.LIVE_EVENTS), orderBy("createdAt", "desc"), limit(20))
        );
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LiveEvent)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const isLeader = LEADER_ROLES.includes(profile?.role ?? "");

  const liveNow = events.filter((e) => e.isLive);
  const scheduled = events.filter((e) => e.isScheduled && !e.isLive);
  const past = events.filter((e) => !e.isLive && !e.isScheduled);

  const handleGoLive = async () => {
    if (!profile || !form.title) return;
    setSaving(true);
    try {
      const roomName = form.type === "jitsi" ? `llgp-${Date.now()}` : undefined;
      const data = {
        title: form.title,
        description: form.description || null,
        type: form.type,
        streamUrl: form.type === "youtube" ? form.streamUrl || null : null,
        roomName: form.type === "jitsi" ? roomName : null,
        externalUrl: form.type === "other" ? form.externalUrl || null : null,
        hostedBy: profile.id,
        hostName: profile.displayName,
        hostPhoto: profile.photoURL ?? null,
        isLive: true,
        isScheduled: false,
        startedAt: serverTimestamp(),
        scope: form.scope,
        nationId: profile.nationId ?? null,
        nationName: profile.nationName ?? null,
        cityId: form.scope === "city" ? (profile.cityId ?? null) : null,
        cityName: form.scope === "city" ? (profile.cityName ?? null) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, COLLECTIONS.LIVE_EVENTS), data);
      const newEvent = { id: ref.id, ...data } as unknown as LiveEvent;
      setEvents((prev) => [newEvent, ...prev]);
      setModalOpen(false);
      setForm(defaultForm);
      toast.success("You are live!");
    } catch {
      toast.error("Failed to go live.");
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!profile || !form.title || !form.scheduledAt) return;
    setSaving(true);
    try {
      const scheduledTs = Timestamp.fromDate(new Date(form.scheduledAt));
      const roomName = form.type === "jitsi" ? `llgp-${Date.now()}` : undefined;
      const data = {
        title: form.title,
        description: form.description || null,
        type: form.type,
        streamUrl: form.type === "youtube" ? form.streamUrl || null : null,
        roomName: form.type === "jitsi" ? roomName : null,
        externalUrl: form.type === "other" ? form.externalUrl || null : null,
        hostedBy: profile.id,
        hostName: profile.displayName,
        hostPhoto: profile.photoURL ?? null,
        isLive: false,
        isScheduled: true,
        scheduledAt: scheduledTs,
        scope: form.scope,
        nationId: profile.nationId ?? null,
        nationName: profile.nationName ?? null,
        cityId: form.scope === "city" ? (profile.cityId ?? null) : null,
        cityName: form.scope === "city" ? (profile.cityName ?? null) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, COLLECTIONS.LIVE_EVENTS), data);
      const newEvent = { id: ref.id, ...data } as unknown as LiveEvent;
      setEvents((prev) => [newEvent, ...prev]);
      setModalOpen(false);
      setForm(defaultForm);
      toast.success("Event scheduled!");
    } catch {
      toast.error("Failed to schedule event.");
    } finally {
      setSaving(false);
    }
  };

  const handleEndStream = async (eventId: string) => {
    setEnding(eventId);
    try {
      await updateDoc(doc(db, COLLECTIONS.LIVE_EVENTS, eventId), {
        isLive: false,
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, isLive: false } : e))
      );
      toast.success("Stream ended.");
    } catch {
      toast.error("Failed to end stream.");
    } finally {
      setEnding(null);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Live & Meetings</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Join live events and scheduled meetings
          </p>
        </div>
        {isLeader && (
          <Button onClick={() => setModalOpen(true)}>
            <Radio className="w-4 h-4" />
            Go Live
          </Button>
        )}
      </div>

      {/* Live Now Section */}
      {liveNow.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Live Now
            </h2>
          </div>
          {liveNow.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              currentUserId={profile?.id}
              onEndStream={handleEndStream}
              ending={ending === event.id}
            />
          ))}
        </section>
      )}

      {/* Scheduled Section */}
      {scheduled.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Scheduled
          </h2>
          {scheduled.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              currentUserId={profile?.id}
              onEndStream={handleEndStream}
              ending={ending === event.id}
            />
          ))}
        </section>
      )}

      {/* Empty state for no live/scheduled */}
      {liveNow.length === 0 && scheduled.length === 0 && (
        <EmptyState
          icon={<Radio className="w-6 h-6" />}
          title="No live events right now"
          description="Check back later or schedule an upcoming session."
          action={
            isLeader ? (
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="w-4 h-4" />
                Go Live or Schedule
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Past Section */}
      {past.length > 0 && (
        <section className="space-y-3">
          <button
            onClick={() => setShowPast((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <span className="text-sm font-black uppercase tracking-wider">
              Past ({past.length})
            </span>
            <span className="text-xs">{showPast ? "▲ Hide" : "▼ Show"}</span>
          </button>
          {showPast &&
            past.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                currentUserId={profile?.id}
                onEndStream={handleEndStream}
                ending={ending === event.id}
              />
            ))}
        </section>
      )}

      {/* Create Event Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setForm(defaultForm); }}
        title="Go Live or Schedule"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Title *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Leadership Training Session"
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            placeholder="What is this session about?"
          />
          <Select
            label="Event Type"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EventType }))}
          >
            <option value="jitsi">Jitsi Video Call</option>
            <option value="youtube">YouTube Live</option>
            <option value="other">External Link</option>
          </Select>

          {form.type === "youtube" && (
            <Input
              label="YouTube URL"
              value={form.streamUrl}
              onChange={(e) => setForm((f) => ({ ...f, streamUrl: e.target.value }))}
              placeholder="https://youtube.com/watch?v=..."
            />
          )}
          {form.type === "jitsi" && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700 font-medium">
              A video call room will be created automatically when you go live or schedule.
            </div>
          )}
          {form.type === "other" && (
            <Input
              label="Meeting URL"
              value={form.externalUrl}
              onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))}
              placeholder="https://zoom.us/..."
            />
          )}

          {/* Schedule toggle */}
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={form.isScheduled}
              onChange={(e) => setForm((f) => ({ ...f, isScheduled: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600"
            />
            Schedule for later
          </label>
          {form.isScheduled && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Date & Time *
              </label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <Select
            label="Audience Scope"
            value={form.scope}
            onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as EventScope }))}
          >
            <option value="global">Global — Everyone</option>
            <option value="national">My Nation</option>
            <option value="city">My City</option>
          </Select>

          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => { setModalOpen(false); setForm(defaultForm); }}
            >
              Cancel
            </Button>
            {form.isScheduled ? (
              <Button
                className="flex-1"
                onClick={handleSchedule}
                loading={saving}
                disabled={!form.title || !form.scheduledAt}
              >
                <Calendar className="w-4 h-4" />
                Schedule
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={handleGoLive}
                loading={saving}
                disabled={!form.title}
              >
                <Radio className="w-4 h-4" />
                Go Live Now
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EventCard component
// ─────────────────────────────────────────────────────────────

interface EventCardProps {
  event: LiveEvent;
  currentUserId: string | undefined;
  onEndStream: (id: string) => void;
  ending: boolean;
}

function typeBadge(type: LiveEvent["type"]) {
  if (type === "youtube") {
    return (
      <Badge variant="danger" className="gap-1">
        <Video className="w-3 h-3" />
        YouTube
      </Badge>
    );
  }
  if (type === "jitsi") {
    return (
      <Badge variant="info" className="gap-1">
        <Video className="w-3 h-3" />
        Video Call
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="gap-1">
      <Link2 className="w-3 h-3" />
      External
    </Badge>
  );
}

function EventCard({ event, currentUserId, onEndStream, ending }: EventCardProps) {
  const isHost = currentUserId === event.hostedBy;
  const isPast = !event.isLive && !event.isScheduled;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-150 overflow-hidden">
      {/* Top accent stripe for live */}
      {event.isLive && (
        <div className="h-1 bg-gradient-to-r from-red-500 to-rose-400" />
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar name={event.hostName} photoURL={event.hostPhoto} size="sm" />
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              {typeBadge(event.type)}
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
            <h3 className="font-bold text-slate-900 leading-snug">{event.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Hosted by {event.hostName}</p>
            {event.description && (
              <p className="text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                {event.description}
              </p>
            )}
            {event.isScheduled && event.scheduledAt && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>{formatScheduled(event.scheduledAt)}</span>
                <span className="font-semibold text-indigo-600">
                  {getCountdown(event.scheduledAt)}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            {!isPast && (
              <Link href={`/live/${event.id}`}>
                <Button size="sm" variant={event.isLive ? "primary" : "secondary"}>
                  {event.isLive ? "Watch" : "View"}
                </Button>
              </Link>
            )}
            {isHost && event.isLive && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => onEndStream(event.id)}
                loading={ending}
              >
                <StopCircle className="w-3.5 h-3.5" />
                End
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
