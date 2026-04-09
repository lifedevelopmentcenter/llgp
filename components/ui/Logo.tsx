import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
  className?: string;
  iconOnly?: boolean;
}

const heights = { sm: 32, md: 40, lg: 52 };

export function Logo({ size = "md", variant = "dark", className, iconOnly }: LogoProps) {
  const h = heights[size];

  if (iconOnly) {
    // Just the LL square mark
    return (
      <div className={cn("flex-shrink-0", className)}>
        <Image
          src="/logo.png"
          alt="Leading Lights"
          width={h}
          height={h}
          className="object-contain"
          style={{ height: h, width: "auto" }}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex-shrink-0", variant === "light" && "brightness-0 invert", className)}>
      <Image
        src="/logo.png"
        alt="Leading Lights"
        width={240}
        height={h}
        className="object-contain"
        style={{ height: h, width: "auto", maxWidth: 240 }}
        priority
      />
    </div>
  );
}
