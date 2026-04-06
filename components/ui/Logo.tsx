import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
  className?: string;
  iconOnly?: boolean;
}

const sizes = {
  sm: { icon: "w-7 h-7 text-xs", text: "text-sm" },
  md: { icon: "w-9 h-9 text-sm", text: "text-base" },
  lg: { icon: "w-12 h-12 text-base", text: "text-xl" },
};

export function Logo({ size = "md", variant = "dark", className, iconOnly }: LogoProps) {
  const s = sizes[size];
  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      {/* Flame icon */}
      <div className={cn(s.icon, "rounded-xl flex items-center justify-center flex-shrink-0",
        variant === "light" ? "bg-white/20" : "bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md"
      )}>
        <svg viewBox="0 0 24 24" className="w-1/2 h-1/2 fill-current text-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C10 5 8 6.5 8 9.5C8 12 9.5 14 12 14C9 14 7 16.5 7 19C7 21.2 8.8 23 12 23C15.2 23 17 21.2 17 19C17 16.5 15 14 12 14C14.5 14 16 12 16 9.5C16 6.5 14 5 12 2Z" />
        </svg>
      </div>
      {!iconOnly && (
        <span className={cn("font-black tracking-tight leading-none", s.text,
          variant === "light" ? "text-white" : "text-slate-900"
        )}>
          Leading <span className={variant === "light" ? "text-white/80" : "text-indigo-600"}>Lights</span>
        </span>
      )}
    </div>
  );
}
