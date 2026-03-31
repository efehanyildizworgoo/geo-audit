"use client";

import { cn } from "@/lib/utils";

interface Props {
  score: number;
  label: string;
  size?: "sm" | "lg";
}

function getColor(score: number): string {
  if (score >= 80) return "hsl(142, 71%, 45%)";
  if (score >= 60) return "hsl(38, 92%, 50%)";
  if (score >= 40) return "hsl(25, 95%, 53%)";
  return "hsl(0, 84%, 60%)";
}

function getGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function ScoreGauge({ score, label, size = "sm" }: Props) {
  const color = getColor(score);
  const isLg = size === "lg";
  const r = isLg ? 56 : 32;
  const stroke = isLg ? 7 : 4;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const svgSize = (r + stroke) * 2;

  return (
    <div className={cn("flex flex-col items-center gap-1.5", isLg && "gap-2")}>
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg width={svgSize} height={svgSize} className="-rotate-90">
          <circle
            cx={r + stroke}
            cy={r + stroke}
            r={r}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={stroke}
          />
          <circle
            cx={r + stroke}
            cy={r + stroke}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-extrabold tabular-nums",
              isLg ? "text-3xl" : "text-base"
            )}
            style={{ color }}
          >
            {score}
          </span>
          {isLg && (
            <span className="text-xs font-bold text-muted-foreground">
              {getGrade(score)}
            </span>
          )}
        </div>
      </div>
      <span
        className={cn(
          "font-semibold text-muted-foreground text-center leading-tight",
          isLg ? "text-xs" : "text-[10px]"
        )}
      >
        {label}
      </span>
    </div>
  );
}
