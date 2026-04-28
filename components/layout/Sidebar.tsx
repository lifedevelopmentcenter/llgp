"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, Users, Building2, FileText,
  Settings,
  ChevronDown, ChevronRight, LogOut, X,
  Calendar, Radio, Search, Film, Heart, BarChart2, Bell, UserPlus, Edit3,
  ClipboardList, ListChecks,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
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

const ALL_MEMBER_ROLES: UserRole[] = [
  "global_admin",
  "global_team_lead",
  "global_operations_member",
  "finance_coordinator",
  "travel_coordinator",
  "missions_coordinator",
  "national_leader",
  "city_leader",
  "hub_leader",
  "participant",
];

const LEADER_ROLES: UserRole[] = [
  "global_admin",
  "global_team_lead",
  "global_operations_member",
  "missions_coordinator",
  "national_leader",
  "city_leader",
  "hub_leader",
];

const OPERATIONS_ROLES: UserRole[] = [
  "global_admin",
  "global_team_lead",
  "global_operations_member",
  "finance_coordinator",
  "travel_coordinator",
  "missions_coordinator",
];

const navItems: NavItem[] = [
  {
    label: "Home", href: "/dashboard",
    icon: <LayoutDashboard className="w-[18px] h-[18px]" />,
    roles: ALL_MEMBER_ROLES,
    section: "main",
  },
  {
    label: "Stories", href: "/stories",
    icon: <Film className="w-[18px] h-[18px]" />,
    roles: ALL_MEMBER_ROLES,
    section: "main",
  },
  {
    label: "Prayer Wall", href: "/prayer",
    icon: <Heart className="w-[18px] h-[18px]" />,
    roles: ALL_MEMBER_ROLES,
    section: "main",
  },
  {
    label: "Search", href: "/search",
    icon: <Search className="w-[18px] h-[18px]" />,
    roles: ALL_MEMBER_ROLES,
    section: "main",
  },
  {
    label: "Live", href: "/live",
    icon: <Radio className="w-[18px] h-[18px]" />,
    roles: ALL_MEMBER_ROLES,
    section: "main",
  },
  {
    label: "Write Article", href: "/articles/new",
    icon: <Edit3 className="w-[18px] h-[18px]" />,
    roles: ALL_MEMBER_ROLES,
    section: "main",
  },
  {
    label: "Leading Lights University",
    icon: <BookOpen className="w-[18px] h-[18px]" />,
    roles: ALL_MEMBER_ROLES,
    section: "learn",
    children: [
      { label: "Venture 100", href: "/training", roles: ALL_MEMBER_ROLES },
      { label: "Community Courses", href: "/training/community", roles: ALL_MEMBER_ROLES },
      { label: "Leadership Incubator", href: "/incubator", roles: ALL_MEMBER_ROLES },
      { label: "Resources", href: "/resources", roles: ALL_MEMBER_ROLES },
    ],
  },
  {
    label: "Events", href: "/events",
    icon: <Calendar className="w-[18px] h-[18px]" />,
    roles: ALL_MEMBER_ROLES,
    section: "learn",
  },
  {
    label: "Community",
    icon: <Users className="w-[18px] h-[18px]" />,
    roles: ALL_MEMBER_ROLES,
    section: "community",
    children: [
      { label: "Member Directory", href: "/community/directory", roles: ALL_MEMBER_ROLES },
      { label: "Groups", href: "/community/groups", roles: ALL_MEMBER_ROLES },
      { label: "Prayer & Testimony", href: "/community/wall", roles: ALL_MEMBER_ROLES },
      { label: "Announcements", href: "/community/announcements", roles: ALL_MEMBER_ROLES },
    ],
  },
  {
    label: "Invite Members", href: "/invite",
    icon: <UserPlus className="w-[18px] h-[18px]" />,
    roles: ALL_MEMBER_ROLES,
    section: "community",
  },
  {
    label: "Hubs", href: "/hubs",
    icon: <Building2 className="w-[18px] h-[18px]" />,
    roles: LEADER_ROLES,
    section: "manage",
  },
  {
    label: "Global Operations", href: "/operations",
    icon: <ClipboardList className="w-[18px] h-[18px]" />,
    roles: OPERATIONS_ROLES,
    section: "manage",
  },
  {
    label: "My Assignments", href: "/operations/assignments",
    icon: <ListChecks className="w-[18px] h-[18px]" />,
    roles: OPERATIONS_ROLES,
    section: "manage",
  },
  {
    label: "Playbooks & Forms", href: "/operations/documents",
    icon: <FileText className="w-[18px] h-[18px]" />,
    roles: OPERATIONS_ROLES,
    section: "manage",
  },
  {
    label: "Global Team", href: "/operations/team",
    icon: <Users className="w-[18px] h-[18px]" />,
    roles: ["global_admin", "global_team_lead"],
    section: "manage",
  },
  {
    label: "Reports", href: "/reports",
    icon: <FileText className="w-[18px] h-[18px]" />,
    roles: LEADER_ROLES,
    section: "manage",
  },
  {
    label: "Metrics", href: "/metrics",
    icon: <BarChart2 className="w-[18px] h-[18px]" />,
    roles: ["global_admin", "global_team_lead", "global_operations_member", "national_leader", "city_leader"],
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
      { label: "Push Broadcast", href: "/admin/broadcast", roles: ["global_admin"] },
      { label: "Bulk Groups", href: "/admin/groups", roles: ["global_admin"] },
      { label: "Invitations", href: "/admin/invites", roles: ["global_admin"] },
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
        <Logo variant="dark" size="sm" />
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
