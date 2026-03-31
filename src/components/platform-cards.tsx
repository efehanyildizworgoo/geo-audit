"use client";

import type { PlatformScores } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle } from "lucide-react";

const PLATFORM_META: Record<
  keyof PlatformScores,
  { name: string; color: string; description: string }
> = {
  googleAIO: {
    name: "Google AI Overviews",
    color: "text-blue-400",
    description: "Cevap hedefi deseni ve şema kapsamı en belirleyici alanlar.",
  },
  chatGPT: {
    name: "ChatGPT Web Search",
    color: "text-emerald-400",
    description: "Varlık tanımı ve atıf alabilir pasajlar öne çıkıyor.",
  },
  perplexity: {
    name: "Perplexity AI",
    color: "text-purple-400",
    description: "Doğrudan kaynak olma ve topluluk sinyalleri etkili.",
  },
  gemini: {
    name: "Google Gemini",
    color: "text-amber-400",
    description: "Google ekosistemi ve zengin varlık katmanı önemli.",
  },
  bingCopilot: {
    name: "Bing Copilot",
    color: "text-cyan-400",
    description: "LinkedIn ve teknik altyapı sinyalleri öne çıkıyor.",
  },
};

function getScoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

export function PlatformCards({ platforms }: { platforms: PlatformScores }) {
  const entries = Object.entries(platforms) as [keyof PlatformScores, (typeof platforms)[keyof PlatformScores]][];

  // Sort by score descending
  const sorted = [...entries].sort((a, b) => b[1].score - a[1].score);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {sorted.map(([key, detail]) => {
        const meta = PLATFORM_META[key];
        return (
          <Card key={key} className="bg-card border-border">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className={`text-sm font-bold ${meta.color}`}>
                  {meta.name}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-xs font-extrabold tabular-nums"
                >
                  {detail.score}/100
                </Badge>
              </div>
              <Progress
                value={detail.score}
                className="h-1.5 mt-2"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {meta.description}
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-2">
              {detail.strengths.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Güçlü Yönler
                  </p>
                  {detail.strengths.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 py-0.5"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-foreground leading-tight">
                        {s}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {detail.weaknesses.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    İyileştirme Alanları
                  </p>
                  {detail.weaknesses.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 py-0.5"
                    >
                      <XCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-muted-foreground leading-tight">
                        {w}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
