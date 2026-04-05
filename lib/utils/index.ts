import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import { Timestamp } from "firebase/firestore";
import type { UserRole } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp: Timestamp | Date | null | undefined): string {
  if (!timestamp) return "—";
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return format(date, "MMM d, yyyy");
}

export function formatDateTime(timestamp: Timestamp | Date | null | undefined): string {
  if (!timestamp) return "—";
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return format(date, "MMM d, yyyy · h:mm a");
}

export function timeAgo(timestamp: Timestamp | Date | null | undefined): string {
  if (!timestamp) return "just now";
  try {
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp instanceof Date ? timestamp : null;
    if (!date || isNaN(date.getTime())) return "just now";
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "just now";
  }
}

export function getMonthName(month: number): string {
  return format(new Date(2024, month - 1, 1), "MMMM");
}

export function canAccessNation(userRole: UserRole, userNationId: string | undefined, targetNationId: string): boolean {
  if (userRole === "global_admin") return true;
  if (userRole === "national_leader") return userNationId === targetNationId;
  return false;
}

export function canAccessCity(userRole: UserRole, userCityId: string | undefined, targetCityId: string): boolean {
  if (userRole === "global_admin" || userRole === "national_leader") return true;
  if (userRole === "city_leader") return userCityId === targetCityId;
  return false;
}

export function canAccessHub(userRole: UserRole, userHubId: string | undefined, targetHubId: string): boolean {
  if (["global_admin", "national_leader", "city_leader"].includes(userRole)) return true;
  if (userRole === "hub_leader") return userHubId === targetHubId;
  return false;
}

export function isLeader(role: UserRole): boolean {
  return ["global_admin", "national_leader", "city_leader", "hub_leader"].includes(role);
}

export function isAdmin(role: UserRole): boolean {
  return role === "global_admin";
}

export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    global_admin: "bg-purple-100 text-purple-800",
    national_leader: "bg-blue-100 text-blue-800",
    city_leader: "bg-indigo-100 text-indigo-800",
    hub_leader: "bg-teal-100 text-teal-800",
    participant: "bg-gray-100 text-gray-700",
  };
  return colors[role];
}

export function getInitials(name: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}
