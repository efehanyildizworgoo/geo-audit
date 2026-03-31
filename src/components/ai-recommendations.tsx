"use client";

import type { AIRecommendation } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, Zap, Clock, Target } from "lucide-react";

const IMPACT_CONFIG = {
  high: { label: "Yüksek Etki", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  medium: { label: "Orta Etki", class: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  low: { label: "Düşük Etki", class: "bg-muted text-muted-foreground border-border" },
};

const EFFORT_CONFIG = {
  easy: { label: "Kolay", icon: Zap },
  medium: { label: "Orta", icon: Clock },
  hard: { label: "Zor", icon: Target },
};

export function AIRecommendations({ recommendations }: { recommendations: AIRecommendation[] }) {
  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Yapay Zekâ Önerileri</h3>
          <p className="text-[10px] text-muted-foreground">Site türüne özel, GPT-4o destekli akıllı analiz</p>
        </div>
      </div>

      {recommendations.map((rec, i) => {
        const impact = IMPACT_CONFIG[rec.impact];
        const effort = EFFORT_CONFIG[rec.effort];
        const EffortIcon = effort.icon;

        return (
          <Card key={i} className="border-violet-500/10 bg-violet-500/[0.02]">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-[13px] font-bold leading-tight">
                  {rec.title}
                </CardTitle>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${impact.class}`}>
                    {impact.label}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 gap-0.5">
                    <EffortIcon className="w-2.5 h-2.5" />
                    {effort.label}
                  </Badge>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                {rec.description}
              </p>
              <Badge variant="secondary" className="text-[9px] w-fit mt-1.5">
                {rec.category}
              </Badge>
            </CardHeader>
            {rec.steps.length > 0 && (
              <CardContent className="px-4 pb-4 pt-0">
                <div className="mt-2 space-y-1.5">
                  {rec.steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <div className="mt-1 shrink-0">
                        <ArrowRight className="w-3 h-3 text-violet-400" />
                      </div>
                      <span className="text-[11px] text-foreground/80 leading-relaxed">
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
