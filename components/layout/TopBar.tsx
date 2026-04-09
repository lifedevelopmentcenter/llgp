"use client";
import { useEffect, useRef, useState } from "react";
import { Menu, MessageSquare, Megaphone, Search } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/lib/hooks/useAuth";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { timeAgo } from "@/lib/utils";
import type { Announcement, UserProfile } from "@/lib/types";

function MessagesIcon({ userId }: { userId: string }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const q = query(collection(db, COLLECTIONS.CONVERSATIONS), where("participants", "array-contains", userId));
    return onSnapshot(q, snap => {
      const total = snap.docs.reduce((sum: number, d) => sum + ((d.data().unreadCounts?.[userId]) || 0), 0);
      setUnread(total);
    }, () => {});
  }, [userId]);
  return (
    <Link href="/messages" className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
      <MessageSquare className="w-5 h-5" />
      {unread > 0 && (
        <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

function AnnouncementsIcon({ profile }: { profile: UserProfile }) {
  const [open, setOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.ANNOUNCEMENTS),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    return onSnapshot(q, snap => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
    }, () => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
      >
        <Megaphone className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900">Announcements</p>
          </div>
          <div className="divide-y divide-slate-50">
            {announcements.length === 0 && (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">No announcements yet</p>
            )}
            {announcements.map(a => (
              <div key={a.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900 leading-snug">{a.title}</p>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">
                    {a.scope}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{timeAgo(a.createdAt)}</p>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100 text-center">
            <Link
              href="/community/announcements"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              View all →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 h-14">
      {/* Left: hamburger (mobile only) + logo */}
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <Logo variant="dark" size="sm" />
      </div>

      {/* Right: icons */}
      <div className="flex items-center gap-1">
        <Link href="/search" className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
          <Search className="w-5 h-5" />
        </Link>
        {profile && <AnnouncementsIcon profile={profile} />}
        {profile && <MessagesIcon userId={profile.id} />}
        <NotificationBell />
        {profile && (
          <Link href={`/profile/${profile.id}`} className="ml-1">
            <Avatar name={profile.displayName ?? "?"} photoURL={profile.photoURL} size="sm" />
          </Link>
        )}
      </div>
    </header>
  );
}
