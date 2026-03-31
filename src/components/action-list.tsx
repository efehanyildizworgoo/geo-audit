"use client";

import type { ActionItem } from "@/lib/types";
import { AlertTriangle, AlertCircle, Info, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const PRIORITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    label: "Kritik",
    badgeClass: "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/10",
    iconClass: "text-red-400",
  },
  high: {
    icon: AlertCircle,
    label: "Yüksek",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/10",
    iconClass: "text-amber-400",
  },
  medium: {
    icon: Info,
    label: "Orta",
    badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10",
    iconClass: "text-indigo-400",
  },
  low: {
    icon: ChevronDown,
    label: "Düşük",
    badgeClass: "bg-muted text-muted-foreground border-border hover:bg-muted",
    iconClass: "text-muted-foreground",
  },
};

export function ActionList({ actions }: { actions: ActionItem[] }) {
  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Aksiyon öğesi bulunamadı.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {actions.map((a, i) => {
        const cfg = PRIORITY_CONFIG[a.priority];
        const Icon = cfg.icon;
        return (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-3.5 transition-colors hover:bg-accent/50"
          >
            <div className="flex items-start gap-3">
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.iconClass}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0 h-5 ${cfg.badgeClass}`}
                  >
                    {cfg.label}
                  </Badge>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {a.category}
                  </span>
                </div>
                <h4 className="text-[13px] font-bold text-foreground">
                  {a.title}
                </h4>
                <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                  {a.description}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
