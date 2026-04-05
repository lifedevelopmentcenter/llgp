import React from "react";
import { cn, getInitials } from "@/lib/utils";

interface AvatarProps {
  name: string;
  photoURL?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
};

const bgColors = [
  "bg-indigo-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-emerald-500",
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return bgColors[hash % bgColors.length];
}

export function Avatar({ name, photoURL, size = "md", className }: AvatarProps) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        className={cn("rounded-full object-cover flex-shrink-0", sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0",
        sizes[size],
        getColor(name || "?"),
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
