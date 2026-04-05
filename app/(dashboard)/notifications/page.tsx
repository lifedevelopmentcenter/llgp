"use client";
import React, { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs, updateDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { Bell, MessageSquare, Heart, Users, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { timeAgo } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import type { Notification } from "@/lib/types";

const TYPE_ICONS: Record<string, { icon: React.ReactNode; bg: string }> = {
  message:        { icon: <MessageSquare className="w-4 h-4" />, bg: "bg-indigo-100 text-indigo-600" },
  comment:        { icon: <MessageSquare className="w-4 h-4" />, bg: "bg-teal-100 text-teal-600" },
  reaction:       { icon: <Heart className="w-4 h-4" />, bg: "bg-rose-100 text-rose-600" },
  group_activity: { icon: <Users className="w-4 h-4" />, bg: "bg-violet-100 text-violet-600" },
  announcement:   { icon: <Bell className="w-4 h-4" />, bg: "bg-amber-100 text-amber-600" },
};

export default function NotificationsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, COLLECTIONS.NOTIFICATIONS),
          where("userId", "==", profile.id),
          orderBy("createdAt", "desc"),
          limit(50)
        ));
        setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [profile]);

  const markRead = async (notif: Notification) => {
    if (!notif.isRead) {
      await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notif.id), { isRead: true });
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    }
    if (notif.link) router.push(notif.link);
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, COLLECTIONS.NOTIFICATIONS, n.id), { isRead: true }));
    await batch.commit();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    toast.success("All marked as read.");
  };

  const deleteNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDoc(doc(db, COLLECTIONS.NOTIFICATIONS, id));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (loading) return <PageLoader />;

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayNotifs = notifications.filter(n => {
    try { const d = n.createdAt instanceof Timestamp ? n.createdAt.toDate() : new Date(); return d >= today; } catch { return false; }
  });
  const earlierNotifs = notifications.filter(n => !todayNotifs.includes(n));

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={markAllRead}>
            <Check className="w-4 h-4" />
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-6 h-6" />}
          title="No notifications yet"
          description="You'll be notified when someone interacts with your posts or sends you a message."
        />
      ) : (
        <div className="space-y-4">
          {todayNotifs.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">Today</p>
              <div className="space-y-1">
                {todayNotifs.map(n => <NotifItem key={n.id} notif={n} onRead={markRead} onDelete={deleteNotif} />)}
              </div>
            </div>
          )}
          {earlierNotifs.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">Earlier</p>
              <div className="space-y-1">
                {earlierNotifs.map(n => <NotifItem key={n.id} notif={n} onRead={markRead} onDelete={deleteNotif} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotifItem({ notif, onRead, onDelete }: {
  notif: Notification;
  onRead: (n: Notification) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const meta = TYPE_ICONS[notif.type] || TYPE_ICONS.announcement;
  return (
    <div
      onClick={() => onRead(notif)}
      className={`flex items-start gap-3 p-3.5 rounded-2xl cursor-pointer transition-all duration-150 group ${notif.isRead ? "bg-white border border-slate-100 hover:shadow-sm" : "bg-indigo-50 border border-indigo-100 hover:bg-indigo-100/60"}`}
    >
      <div className="relative flex-shrink-0">
        {notif.fromPhoto || notif.fromName ? (
          <Avatar name={notif.fromName || "?"} photoURL={notif.fromPhoto} size="sm" />
        ) : (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
            {meta.icon}
          </div>
        )}
        {!notif.isRead && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-indigo-600 rounded-full border-2 border-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${notif.isRead ? "text-slate-700" : "text-slate-900 font-semibold"}`}>
          {notif.title}
        </p>
        {notif.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.body}</p>}
        <p className="text-xs text-slate-400 mt-1">{timeAgo(notif.createdAt)}</p>
      </div>
      <button
        onClick={(e) => onDelete(notif.id, e)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-white text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
