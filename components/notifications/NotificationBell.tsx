"use client";
import React, { useEffect, useRef, useState } from "react";
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc, writeBatch } from "firebase/firestore";
import { Bell } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { timeAgo } from "@/lib/utils";
import type { Notification } from "@/lib/types";

const TYPE_ICON: Record<string, string> = {
  message: "💬",
  comment: "🗨️",
  reaction: "❤️",
  group_activity: "👥",
  announcement: "📢",
  operation: "📋",
};

export function NotificationBell() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where("userId", "==", profile.id),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    }, () => {});
    return unsub;
  }, [profile]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = notifications.filter(n => !n.isRead).length;

  const markRead = async (notif: Notification) => {
    try {
      if (!notif.isRead) await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notif.id), { isRead: true });
      if (notif.link) window.location.assign(notif.link);
    } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    const unreadList = notifications.filter(n => !n.isRead);
    if (unreadList.length === 0) return;
    try {
      const batch = writeBatch(db);
      unreadList.forEach(n => batch.update(doc(db, COLLECTIONS.NOTIFICATIONS, n.id), { isRead: true }));
      await batch.commit();
    } catch (e) { console.error(e); }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 relative transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
            <p className="text-sm font-bold text-slate-900">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-indigo-600 font-semibold hover:text-indigo-700">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No notifications yet</p>
              </div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${!n.isRead ? "bg-indigo-50/40" : ""}`}
                onClick={() => markRead(n)}
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-base flex-shrink-0 mt-0.5">
                  {TYPE_ICON[n.type] || "🔔"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 line-clamp-1">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
