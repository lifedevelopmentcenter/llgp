"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState, useCallback } from "react";
import {
  collection, query, orderBy, getDocs, addDoc, serverTimestamp,
  updateDoc, doc, increment, Timestamp, limit, where, deleteDoc, getDoc, setDoc,
} from "firebase/firestore";
import { Calendar, MapPin, Globe, Users, Plus, Clock, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { Avatar } from "@/components/ui/Avatar";
import toast from "react-hot-toast";
import type { Event } from "@/lib/types";

const EVENT_RSVPS = "eventRsvps";
const LEADER_ROLES = ["global_admin", "national_leader", "city_leader", "hub_leader"];

function formatEventDate(ts: Timestamp | undefined): string {
  if (!ts) return "";
  try {
    const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts as any);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function formatEventTime(ts: Timestamp | undefined): string {
  if (!ts) return "";
  try {
    const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts as any);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

interface AttendeePreview {
  id: string;
  displayName: string;
  photoURL: string | null;
}

export default function EventsPage() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rsvped, setRsvped] = useState<Set<string>>(new Set());
  const [rsvpLoading, setRsvpLoading] = useState<Set<string>>(new Set());
  const [attendeePreviews, setAttendeePreviews] = useState<Record<string, AttendeePreview[]>>({});
  const [form, setForm] = useState({
    title: "", description: "", startDate: "", endDate: "",
    location: "", isOnline: false, meetingLink: "",
  });

  // Load events and restore the current user's RSVPs from Firestore
  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      try {
        const [eventsSnap, rsvpSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.EVENTS), orderBy("startDate", "asc"), limit(50))),
          getDocs(query(collection(db, EVENT_RSVPS), where("userId", "==", profile.id))),
        ]);

        setEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Event)));

        const myRsvpIds = new Set(rsvpSnap.docs.map(d => d.data().eventId as string));
        setRsvped(myRsvpIds);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [profile]);

  // Fetch up to 5 attendee profiles for a given event
  const loadAttendees = useCallback(async (eventId: string) => {
    if (attendeePreviews[eventId]) return; // already loaded
    try {
      const rsvpSnap = await getDocs(
        query(collection(db, EVENT_RSVPS), where("eventId", "==", eventId), limit(5))
      );
      const userIds = rsvpSnap.docs.map(d => d.data().userId as string);
      const profiles = await Promise.all(
        userIds.map(uid => getDoc(doc(db, COLLECTIONS.USERS, uid)))
      );
      const previews: AttendeePreview[] = profiles
        .filter(p => p.exists())
        .map(p => {
          const data = p.data()!;
          return { id: p.id, displayName: data.displayName ?? "User", photoURL: data.photoURL ?? null };
        });
      setAttendeePreviews(prev => ({ ...prev, [eventId]: previews }));
    } catch (e) { console.error(e); }
  }, [attendeePreviews]);

  // Toggle RSVP: create or delete the eventRsvps doc and adjust the counter
  const toggleRsvp = async (eventId: string) => {
    if (!profile || rsvpLoading.has(eventId)) return;

    const rsvpDocId = `${eventId}_${profile.id}`;
    const rsvpRef = doc(db, EVENT_RSVPS, rsvpDocId);
    const alreadyRsvped = rsvped.has(eventId);

    // Optimistic UI update
    setRsvpLoading(prev => new Set([...prev, eventId]));
    setRsvped(prev => {
      const next = new Set(prev);
      alreadyRsvped ? next.delete(eventId) : next.add(eventId);
      return next;
    });
    setEvents(prev =>
      prev.map(e =>
        e.id === eventId
          ? { ...e, rsvpCount: Math.max(0, e.rsvpCount + (alreadyRsvped ? -1 : 1)) }
          : e
      )
    );

    try {
      if (alreadyRsvped) {
        await deleteDoc(rsvpRef);
        await updateDoc(doc(db, COLLECTIONS.EVENTS, eventId), { rsvpCount: increment(-1) });
        // Remove user from attendee preview cache so it refreshes on next expand
        setAttendeePreviews(prev => {
          const next = { ...prev };
          delete next[eventId];
          return next;
        });
      } else {
        await setDoc(rsvpRef, { eventId, userId: profile.id, createdAt: serverTimestamp() });
        await updateDoc(doc(db, COLLECTIONS.EVENTS, eventId), { rsvpCount: increment(1) });
        // Invalidate preview cache so the new attendee shows up
        setAttendeePreviews(prev => {
          const next = { ...prev };
          delete next[eventId];
          return next;
        });
      }
    } catch (e) {
      // Roll back optimistic update on error
      console.error(e);
      setRsvped(prev => {
        const next = new Set(prev);
        alreadyRsvped ? next.add(eventId) : next.delete(eventId);
        return next;
      });
      setEvents(prev =>
        prev.map(e =>
          e.id === eventId
            ? { ...e, rsvpCount: Math.max(0, e.rsvpCount + (alreadyRsvped ? 1 : -1)) }
            : e
        )
      );
      toast.error("Could not update RSVP. Please try again.");
    } finally {
      setRsvpLoading(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

  const createEvent = async () => {
    if (!profile || !form.title || !form.startDate) return;
    setSaving(true);
    try {
      const startTs = Timestamp.fromDate(new Date(form.startDate));
      const data = {
        title: form.title,
        description: form.description,
        startDate: startTs,
        endDate: form.endDate ? Timestamp.fromDate(new Date(form.endDate)) : null,
        location: form.location || null,
        isOnline: form.isOnline,
        meetingLink: form.meetingLink || null,
        organizerId: profile.id,
        organizerName: profile.displayName,
        nationId: profile.nationId || null,
        cityId: profile.cityId || null,
        rsvpCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, COLLECTIONS.EVENTS), data);
      setEvents(prev => [...prev, { id: ref.id, ...data } as any].sort((a, b) => {
        const aDate = a.startDate instanceof Timestamp ? a.startDate.toDate() : new Date();
        const bDate = b.startDate instanceof Timestamp ? b.startDate.toDate() : new Date();
        return aDate.getTime() - bDate.getTime();
      }));
      setModalOpen(false);
      setForm({ title: "", description: "", startDate: "", endDate: "", location: "", isOnline: false, meetingLink: "" });
      toast.success("Event created!");
    } catch (e) { toast.error("Failed to create event."); }
    finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;

  const isLeader = LEADER_ROLES.includes(profile?.role || "");
  const now = new Date();
  const upcoming = events.filter(e => {
    try { const d = e.startDate instanceof Timestamp ? e.startDate.toDate() : new Date(); return d >= now; } catch { return true; }
  });
  const past = events.filter(e => !upcoming.includes(e));
  const displayed = tab === "upcoming" ? upcoming : past;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Events</h1>
          <p className="text-sm text-slate-400 mt-0.5">{upcoming.length} upcoming event{upcoming.length !== 1 ? "s" : ""}</p>
        </div>
        {isLeader && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Create Event
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 p-1 shadow-sm">
        {(["upcoming", "past"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold capitalize transition-all duration-150 ${tab === t ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
            {t === "upcoming" ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-6 h-6" />}
          title={tab === "upcoming" ? "No upcoming events" : "No past events"}
          description={tab === "upcoming" ? "Events will appear here once published." : ""}
          action={isLeader && tab === "upcoming" ? <Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" />Create Event</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {displayed.map(event => {
            const hasRsvped = rsvped.has(event.id);
            const isRsvpLoading = rsvpLoading.has(event.id);
            const previews = attendeePreviews[event.id];
            return (
              <div
                key={event.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-150"
                onMouseEnter={() => event.rsvpCount > 0 && loadAttendees(event.id)}
              >
                {/* Date strip */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-white">
                    <Calendar className="w-3.5 h-3.5 opacity-80" />
                    <span className="text-xs font-bold">{formatEventDate(event.startDate)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-indigo-200">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">{formatEventTime(event.startDate)}</span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900">{event.title}</h3>
                      {event.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed">{event.description}</p>}
                      <div className="flex flex-wrap gap-3 mt-2.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          {event.isOnline ? <Globe className="w-3.5 h-3.5 text-indigo-500" /> : <MapPin className="w-3.5 h-3.5 text-slate-400" />}
                          <span>{event.isOnline ? "Online" : (event.location || "TBD")}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{event.rsvpCount} attending</span>
                        </div>
                      </div>

                      {/* Attendee avatar preview */}
                      {event.rsvpCount > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          {previews && previews.length > 0 ? (
                            <div className="flex items-center">
                              <div className="flex -space-x-1.5">
                                {previews.map(p => (
                                  <Avatar
                                    key={p.id}
                                    name={p.displayName}
                                    photoURL={p.photoURL}
                                    size="xs"
                                    className="ring-2 ring-white"
                                  />
                                ))}
                              </div>
                              {event.rsvpCount > 5 && (
                                <span className="ml-2 text-xs text-slate-400">+{event.rsvpCount - 5} more</span>
                              )}
                            </div>
                          ) : (
                            // Placeholder skeleton while loading
                            <div className="flex -space-x-1.5">
                              {Array.from({ length: Math.min(event.rsvpCount, 3) }).map((_, i) => (
                                <div key={i} className="w-6 h-6 rounded-full bg-slate-100 ring-2 ring-white animate-pulse" />
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-slate-400 mt-1.5">Organized by {event.organizerName}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {tab === "upcoming" ? (
                        <button
                          onClick={() => toggleRsvp(event.id)}
                          disabled={isRsvpLoading}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                            hasRsvped
                              ? "bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600"
                              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                          }`}
                          title={hasRsvped ? "Click to cancel RSVP" : "RSVP to this event"}
                        >
                          {hasRsvped ? <><CheckCircle2 className="w-3.5 h-3.5" />Going ✓</> : "RSVP"}
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2.5 py-1.5 rounded-xl">Past</span>
                      )}
                    </div>
                  </div>
                  {event.isOnline && event.meetingLink && hasRsvped && (
                    <a href={event.meetingLink} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                      <Globe className="w-3.5 h-3.5" />Join online meeting →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Event Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Event" size="md">
        <div className="space-y-3">
          <Input label="Event Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Leadership Summit 2025" />
          <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="What is this event about?" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Start Date & Time *</label>
              <input type="datetime-local" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">End Date & Time</label>
              <input type="datetime-local" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer py-1">
            <input type="checkbox" checked={form.isOnline} onChange={e => setForm(f => ({ ...f, isOnline: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
            This is an online event
          </label>
          {form.isOnline ? (
            <Input label="Meeting Link" value={form.meetingLink} onChange={e => setForm(f => ({ ...f, meetingLink: e.target.value }))} placeholder="https://zoom.us/..." />
          ) : (
            <Input label="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="City, Country or venue" />
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={createEvent} loading={saving} disabled={!form.title || !form.startDate}>Create Event</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
