"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Rss, Bell, MessageSquare, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/useAuth";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";

export function BottomNav() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, COLLECTIONS.CONVERSATIONS), where("participants", "array-contains", profile.id));
    const unsub = onSnapshot(q, snap => {
      const total = snap.docs.reduce((sum, d) => sum + ((d.data().unreadCounts?.[profile.id]) || 0), 0);
      setUnreadMsgs(total);
    });
    return unsub;
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, COLLECTIONS.NOTIFICATIONS), where("userId", "==", profile.id), where("isRead", "==", false));
    const unsub = onSnapshot(q, snap => setUnreadNotifs(snap.size));
    return unsub;
  }, [profile]);

  const items = [
    { label: "Home",     href: "/dashboard",   icon: LayoutDashboard, badge: 0 },
    { label: "Feed",     href: "/feed",         icon: Rss,             badge: 0 },
    { label: "Messages", href: "/messages",     icon: MessageSquare,   badge: unreadMsgs },
    { label: "Alerts",   href: "/notifications",icon: Bell,            badge: unreadNotifs },
    { label: "Profile",  href: profile ? `/profile/${profile.id}` : "/login", icon: UserCircle, badge: 0 },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white border-t border-slate-100 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && item.href !== "/login" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0 relative"
            >
              <div className="relative">
                <Icon
                  className={cn("w-5 h-5 transition-colors", active ? "text-indigo-600" : "text-slate-400")}
                  strokeWidth={active ? 2.5 : 1.75}
                />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>
              <span className={cn("text-[10px] font-medium truncate transition-colors", active ? "text-indigo-600" : "text-slate-400")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
