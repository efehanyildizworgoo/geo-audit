"use client";

import type { FullSiteAudit, PageSummary, SiteWideIssue } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Bot, Globe, FileText, AlertTriangle, CheckCircle2, XCircle,
  Clock, HardDrive, Link2, Search, BarChart3, Layers,
} from "lucide-react";

// ─── Crawl Stats ─────────────────────────────────────────────────────

function CrawlStats({ data }: { data: FullSiteAudit }) {
  const s = data.crawlStats;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {[
        { label: "Toplam Sayfa", value: `${s.totalPages}`, icon: Layers },
        { label: "Başarılı", value: `${s.crawledPages}`, icon: CheckCircle2 },
        { label: "Hatalı", value: `${s.errorPages}`, icon: XCircle },
        { label: "Ort. Skor", value: `${s.avgScore}/100`, icon: BarChart3 },
        { label: "Ort. Yanıt", value: `${s.avgResponseTime}ms`, icon: Clock },
        { label: "Ort. Boyut", value: `${(s.avgPageSize / 1024).toFixed(0)}KB`, icon: HardDrive },
        { label: "Toplam Süre", value: `${(s.totalTime / 1000).toFixed(1)}s`, icon: Search },
        { label: "Site Türü", value: data.siteType.label, icon: Globe },
      ].map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-lg bg-secondary border border-border p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className="w-3 h-3 text-muted-foreground" />
              <p className="text-[10px] font-medium text-muted-foreground">{item.label}</p>
            </div>
            <p className="text-sm font-extrabold text-foreground tabular-nums">{item.value}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Site-Wide Issues ────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-muted text-muted-foreground border-border",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Kritik",
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
};

function SiteWideIssues({ issues }: { issues: SiteWideIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
        <p className="text-sm font-bold text-foreground">Site genelinde kritik sorun yok!</p>
        <p className="text-xs text-muted-foreground mt-1">Tüm sayfalar temel SEO gereksinimlerini karşılıyor.</p>
      </div>
    );
  }

  return (
    <Accordion type="multiple" className="space-y-1.5">
      {issues.map((issue, i) => (
        <AccordionItem key={i} value={`issue-${i}`} className="rounded-lg border border-border bg-card px-3">
          <AccordionTrigger className="py-2.5 hover:no-underline">
            <div className="flex items-center gap-2 text-xs w-full">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-bold flex-1 text-left">{issue.title}</span>
              <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${SEVERITY_COLORS[issue.severity]}`}>
                {SEVERITY_LABELS[issue.severity]}
              </Badge>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {issue.count}/{issue.total} (%{issue.percentage})
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-[11px] text-muted-foreground mb-2">{issue.description}</p>
            <Progress value={issue.percentage} className="h-1.5 mb-2" />
            <div className="space-y-1">
              {issue.affectedUrls.map((url, j) => (
                <div key={j} className="flex items-center gap-1.5">
                  <Link2 className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />
                  <span className="text-[10px] text-muted-foreground truncate">{url}</span>
                </div>
              ))}
              {issue.count > issue.affectedUrls.length && (
                <p className="text-[9px] text-muted-foreground/60 mt-1">
                  +{issue.count - issue.affectedUrls.length} sayfa daha…
                </p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

// ─── Page List ───────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function PageList({ pages }: { pages: PageSummary[] }) {
  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-1">
        {pages.map((page, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
          >
            <div className="shrink-0 w-8 text-center">
              {page.status === "success" ? (
                <span className={`text-sm font-extrabold tabular-nums ${scoreColor(page.score)}`}>
                  {page.score}
                </span>
              ) : (
                <XCircle className="w-4 h-4 text-red-400 mx-auto" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-foreground truncate">
                {page.title || page.url}
              </p>
              <p className="text-[9px] text-muted-foreground truncate">{page.url}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {page.issues.length > 0 && (
                <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-amber-500/5 text-amber-400 border-amber-500/20">
                  {page.issues.length} sorun
                </Badge>
              )}
              <span className="text-[9px] text-muted-foreground tabular-nums">
                {page.responseTime}ms
              </span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function CrawlResults({ data }: { data: FullSiteAudit }) {
  return (
    <div className="space-y-4">
      {/* Gullanbot header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Gullanbot Site Tarama Raporu
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {data.crawlStats.totalPages} sayfa tarandı • {(data.crawlStats.totalTime / 1000).toFixed(1)}s
          </p>
        </div>
      </div>

      {/* Stats */}
      <CrawlStats data={data} />

      {/* Site-Wide Issues */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Site Geneli Sorunlar ({data.siteWideIssues.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SiteWideIssues issues={data.siteWideIssues} />
        </CardContent>
      </Card>

      {/* Page List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Sayfa Listesi (en düşük skor önce)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PageList pages={data.pages} />
        </CardContent>
      </Card>
    </div>
  );
}
