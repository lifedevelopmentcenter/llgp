"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, Users, Building2, FileText,
  Globe, Settings,
  ChevronDown, ChevronRight, LogOut, X, Rss,
  Calendar, Radio, Search, Film,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { ROLE_LABELS } from "@/lib/types";
import type { UserRole } from "@/lib/types";

interface NavChild { label: string; href: string; roles: UserRole[]; }
interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  roles: UserRole[];
  badge?: string;
  children?: NavChild[];
  section?: string;
}

const navItems: NavItem[] = [
  {
    label: "Global Hub Central", href: "/dashboard",
    icon: <LayoutDashboard className="w-[18px] h-[18px]" />,
    roles: ["global_admin", "national_leader", "city_leader", "hub_leader", "participant"],
    section: "main",
  },
  {
    label: "Feed", href: "/feed",
    icon: <Rss className="w-[18px] h-[18px]" />,
    roles: ["global_admin", "national_leader", "city_leader", "hub_leader", "participant"],
    section: "main",
  },
  {
    label: "Stories", href: "/stories",
    icon: <Film className="w-[18px] h-[18px]" />,
    roles: ["global_admin", "national_leader", "city_leader", "hub_leader", "participant"],
    section: "main",
  },
  {
    label: "Search", href: "/search",
    icon: <Search className="w-[18px] h-[18px]" />,
    roles: ["global_admin", "national_leader", "city_leader", "hub_leader", "participant"],
    section: "main",
  },
  {
    label: "Live", href: "/live",
    icon: <Radio className="w-[18px] h-[18px]" />,
    roles: ["global_admin", "national_leader", "city_leader", "hub_leader", "participant"],
    section: "main",
  },
  {
    label: "Leading Lights University",
    icon: <BookOpen className="w-[18px] h-[18px]" />,
    roles: ["global_admin", "national_leader", "city_leader", "hub_leader", "participant"],
    section: "learn",
    children: [
      { label: "Venture 100", href: "/training", roles: ["global_admin", "national_leader", "city_leader", "hub_leader", "participant"] },
      { label: "Community Courses", href: "/training/community", roles: ["global_admin", "national_leader", "city_leader", "hub_leader", "participant"] },
      { label: "Leadership Incubator", href: "/incubator", roles: ["global_admin", "national_leader", "city_leader", "hub_leader", "participant"] },
      { label: "Resources", href: "/resources", roles: ["global_admin", "national_leader", "city_leader", "hub_leader", "participant"] },
    ],
  },
  {
    label: "Events", href: "/events",
    icon: <Calendar className="w-[18px] h-[18px]" />,
    roles: ["global_admin", "national_leader", "city_leader", "hub_leader", "participant"],
    section: "learn",
  },
  {
    label: "Community",
    icon: <Users className="w-[18px] h-[18px]" />,
    roles: ["global_admin", "national_leader", "city_leader", "hub_leader", "participant"],
    section: "community",
    children: [
      { label: "Member Directory", href: "/community/directory", roles: ["global_admin","national_leader","city_leader","hub_leader","participant"] },
      { label: "Groups", href: "/community/groups", roles: ["global_admin","national_leader","city_leader","hub_leader","participant"] },
      { label: "Prayer & Testimony", href: "/community/wall", roles: ["global_admin","national_leader","city_leader","hub_leader","participant"] },
      { label: "Announcements", href: "/community/announcements", roles: ["global_admin","national_leader","city_leader","hub_leader","participant"] },
    ],
  },
  {
    label: "Hubs", href: "/hubs",
    icon: <Building2 className="w-[18px] h-[18px]" />,
    roles: ["global_admin", "national_leader", "city_leader", "hub_leader"],
    section: "manage",
  },
  {
    label: "Reports", href: "/reports",
    icon: <FileText className="w-[18px] h-[18px]" />,
    roles: ["global_admin", "national_leader", "city_leader", "hub_leader"],
    section: "manage",
  },
  {
    label: "Admin",
    icon: <Settings className="w-[18px] h-[18px]" />,
    roles: ["global_admin"],
    section: "admin",
    children: [
      { label: "Users", href: "/admin/users", roles: ["global_admin"] },
      { label: "Nations & Cities", href: "/admin/nations", roles: ["global_admin"] },
      { label: "Courses", href: "/admin/courses", roles: ["global_admin"] },
      { label: "LLGLI Submissions", href: "/admin/submissions", roles: ["global_admin"] },
      { label: "Moderation", href: "/admin/moderation", roles: ["global_admin"] },
    ],
  },
];

const SECTION_LABELS: Record<string, string> = {
  main: "",
  learn: "Learn",
  community: "Community",
  manage: "Manage",
  admin: "Admin",
};

function NavLink({ item, onClose }: { item: NavItem; onClose?: () => void }) {
  const pathname = usePathname();
  const isChildActive = item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href));
  const [open, setOpen] = useState(isChildActive ?? false);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full transition-all duration-150",
            isChildActive
              ? "bg-indigo-50 text-indigo-700"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          )}
        >
          <span className={isChildActive ? "text-indigo-600" : ""}>{item.icon}</span>
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown className="w-3.5 h-3.5 opacity-60" /> : <ChevronRight className="w-3.5 h-3.5 opacity-40" />}
        </button>
        {open && (
          <div className="ml-6 mt-0.5 space-y-0.5 border-l-2 border-slate-100 pl-3">
            {item.children.map((child) => {
              const active = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onClose}
                  className={cn(
                    "block py-1.5 px-2 rounded-lg text-sm transition-colors duration-150",
                    active ? "text-indigo-700 font-semibold" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const active = pathname === item.href;
  return (
    <Link
      href={item.href!}
      onClick={onClose}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
        active
          ? "bg-indigo-50 text-indigo-700"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      )}
    >
      <span className={active ? "text-indigo-600" : ""}>{item.icon}</span>
      {item.label}
      {item.badge && (
        <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

interface SidebarProps { mobile?: boolean; onClose?: () => void; }

export function Sidebar({ mobile, onClose }: SidebarProps) {
  const { profile, logOut } = useAuth();
  const role = profile?.role ?? "participant";

  // Group nav items by section
  const sections: Record<string, NavItem[]> = {};
  navItems.forEach((item) => {
    if (!item.roles.includes(role)) return;
    const sec = item.section || "main";
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(item);
  });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Logo */}
      <div className="lg:hidden flex items-center justify-between px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm">
            <Globe className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900 leading-tight tracking-tight">Leading Lights</p>
            <p className="text-[10px] text-slate-400 leading-tight font-medium">Global Platform</p>
          </div>
        </div>
        {mobile && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
        {Object.entries(sections).map(([section, items]) => (
          <div key={section}>
            {SECTION_LABELS[section] && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 pt-4 pb-1.5">
                {SECTION_LABELS[section]}
              </p>
            )}
            {items.map((item, i) => (
              <NavLink key={i} item={item} onClose={onClose} />
            ))}
          </div>
        ))}
      </nav>

      {/* User block */}
      {profile && (
        <div className="px-3 pb-3 pt-2 border-t border-slate-100 space-y-1">
          <Link
            href={`/profile/${profile.id}`}
            onClick={onClose}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
          >
            <Avatar name={profile.displayName ?? "?"} photoURL={profile.photoURL} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{profile.displayName}</p>
              <p className="text-xs text-slate-400 truncate">{ROLE_LABELS[role]}</p>
            </div>
          </Link>
          <button
            onClick={logOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
