import React from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number; // 0-100
  size?: "sm" | "md";
  color?: "indigo" | "green" | "amber" | "rose";
  showLabel?: boolean;
  className?: string;
}

const colors = {
  indigo: "bg-indigo-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

const heights = {
  sm: "h-1.5",
  md: "h-2.5",
};

export function ProgressBar({ value, size = "md", color = "indigo", showLabel, className }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("w-full", className)}>
      <div className={cn("w-full bg-slate-100 rounded-full overflow-hidden", heights[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", colors[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-slate-500 mt-1 text-right">{pct}%</p>
      )}
    </div>
  );
}
