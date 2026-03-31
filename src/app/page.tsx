"use client";

import { useState, useRef } from "react";
import { Search, Loader2, Download, BarChart3, Globe, Sparkles, Tag, Bot, FileText } from "lucide-react";
import type { AuditResult, FullSiteAudit, CrawlProgress } from "@/lib/types";
import { ScoreGauge } from "@/components/score-gauge";
import { ActionList } from "@/components/action-list";
import { DetailSections } from "@/components/detail-section";
import { PlatformCards } from "@/components/platform-cards";
import { AIRecommendations } from "@/components/ai-recommendations";
import { CrawlResults } from "@/components/crawl-results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type ScanMode = "single" | "full";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [scanMode, setScanMode] = useState<ScanMode>("single");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [crawlResult, setCrawlResult] = useState<FullSiteAudit | null>(null);
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function runSingleAudit() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setCrawlResult(null);
    setCrawlProgress(null);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Denetim başarısız");
      setResult(data);
      saveHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir şeyler ters gitti");
    } finally {
      setLoading(false);
    }
  }

  async function runFullCrawl() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setCrawlResult(null);
    setCrawlProgress({ phase: "sitemap", discovered: 0, crawled: 0, total: 0, message: "Bağlanıyor…" });

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Tarama başlatılamadı");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream okunamıyor");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "progress") {
              setCrawlProgress(event.data);
            } else if (event.type === "result") {
              setCrawlResult(event.data);
              setResult(event.data.homepageAudit);
              saveHistory(event.data.homepageAudit);
            } else if (event.type === "error") {
              throw new Error(event.data.message);
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
              throw e;
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function handleScan() {
    if (scanMode === "single") runSingleAudit();
    else runFullCrawl();
  }

  function cancelCrawl() {
    abortRef.current?.abort();
    setLoading(false);
    setCrawlProgress(null);
  }

  function saveHistory(data: AuditResult) {
    const history = JSON.parse(localStorage.getItem("audit-history") || "[]");
    history.unshift({ url: data.url, timestamp: data.timestamp, overall: data.scores.overall });
    localStorage.setItem("audit-history", JSON.stringify(history.slice(0, 20)));
  }

  function exportJSON() {
    const exportData = crawlResult || result;
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    const hostname = new URL(crawlResult?.url || result?.url || "").hostname;
    link.href = URL.createObjectURL(blob);
    link.download = `geo-audit-${hostname}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <span className="text-sm font-extrabold text-foreground tracking-tight">
              GEO Audit
            </span>
            <Badge
              variant="outline"
              className="text-[9px] font-bold text-primary bg-primary/10 border-primary/20"
            >
              BETA
            </Badge>
          </div>
          {result && (
            <Button variant="outline" size="sm" onClick={exportJSON}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              JSON İndir
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* Hero + Search */}
        <div className="text-center mb-8">
          {!result && !loading && (
            <>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-3">
                Yapay Zekâ İndeks Kontrol Masası
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-8">
                AI arama motorları (ChatGPT, Perplexity, Gemini, Google AI
                Overviews) için site denetimi. Teknik SEO, yapısal veri, atıf
                uygunluğu ve platform hazırlığı tek panelde.
              </p>
            </>
          )}
          {/* Mode toggle */}
          <div className="flex items-center justify-center gap-1.5 mb-4">
            <Button
              variant={scanMode === "single" ? "default" : "outline"}
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={() => setScanMode("single")}
            >
              <FileText className="w-3 h-3" />
              Tek Sayfa
            </Button>
            <Button
              variant={scanMode === "full" ? "default" : "outline"}
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={() => setScanMode("full")}
            >
              <Bot className="w-3 h-3" />
              Tüm Site (Gullanbot)
            </Button>
          </div>

          <div className="flex gap-2 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                placeholder="https://example.com"
                className="pl-10 h-11 text-sm"
              />
            </div>
            <Button
              onClick={handleScan}
              disabled={loading || !url.trim()}
              className="h-11 px-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  {scanMode === "full" ? "Taranıyor" : "Analiz"}
                </>
              ) : (
                scanMode === "full" ? "Tara" : "Denetle"
              )}
            </Button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-destructive font-medium">
              {error}
            </p>
          )}
        </div>

        {/* Loading — Single Page */}
        {loading && scanMode === "single" && (
          <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground font-medium mt-6">
              Sayfa taranıyor ve analiz ediliyor…
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Bu işlem 10-30 saniye sürebilir
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md">
              {[
                "Çekirdek sayfa okuması",
                "Teknik altyapı taraması",
                "Yapısal veri analizi",
                "AI atıf uygunluğu",
                "Bot erişim kontrolü",
                "Platform hazırlığı",
              ].map((step, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="text-[10px] animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                >
                  {step}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Loading — Full Site Crawl (Gullanbot) */}
        {loading && scanMode === "full" && crawlProgress && (
          <div className="flex flex-col items-center justify-center py-16 animate-fadeIn">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <Bot className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">Gullanbot Tarama</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {crawlProgress.message}
            </p>
            {crawlProgress.total > 0 && (
              <div className="w-full max-w-md space-y-2">
                <Progress
                  value={crawlProgress.total > 0 ? (crawlProgress.crawled / crawlProgress.total) * 100 : 0}
                  className="h-2"
                />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                  <span>{crawlProgress.crawled} / {crawlProgress.total} sayfa</span>
                  <span>{crawlProgress.phase === "sitemap" ? "Sitemap keşfi" : crawlProgress.phase === "crawling" ? "Sayfalar taranıyor" : crawlProgress.phase === "auditing" ? "Detaylı denetim" : ""}</span>
                </div>
              </div>
            )}
            {crawlProgress.currentUrl && (
              <p className="text-[9px] text-muted-foreground/60 mt-3 max-w-md truncate">
                {crawlProgress.currentUrl}
              </p>
            )}
            <Button variant="outline" size="sm" className="mt-6 text-xs" onClick={cancelCrawl}>
              İptal Et
            </Button>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="animate-slideUp">
            {/* URL info bar */}
            <Card className="mb-6">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  {crawlResult ? <Bot className="w-5 h-5 text-primary" /> : <Globe className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {result.url}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(result.timestamp).toLocaleString("tr-TR")}
                    </p>
                    <Badge variant="secondary" className="text-[10px] gap-1 h-4 px-1.5">
                      <Tag className="w-2.5 h-2.5" />
                      {result.siteType.label}
                    </Badge>
                    {result.siteType.confidence >= 50 && (
                      <span className="text-[9px] text-muted-foreground/60">%{result.siteType.confidence} güven</span>
                    )}
                    {crawlResult && (
                      <Badge variant="outline" className="text-[9px] gap-1 h-4 px-1.5 bg-primary/5 text-primary border-primary/20">
                        <Bot className="w-2.5 h-2.5" />
                        {crawlResult.crawlStats.totalPages} sayfa tarandı
                      </Badge>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs font-bold tabular-nums shrink-0">
                  {result.scores.overall}/100
                </Badge>
              </CardContent>
            </Card>

            {/* Score gauges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
              <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex justify-center">
                <ScoreGauge
                  score={result.scores.overall}
                  label="Genel"
                  size="lg"
                />
              </div>
              <ScoreGauge
                score={result.scores.technical}
                label="Teknik"
              />
              <ScoreGauge
                score={result.scores.content}
                label="İçerik"
              />
              <ScoreGauge
                score={result.scores.schema}
                label="Yapısal Veri"
              />
              <ScoreGauge
                score={result.scores.citability}
                label="AI Atıf"
              />
              <ScoreGauge
                score={result.scores.crawlerAccess}
                label="Tarayıcılar"
              />
              <ScoreGauge
                score={result.scores.brandAuthority}
                label="Marka"
              />
              <ScoreGauge
                score={result.scores.platform}
                label="Platformlar"
              />
            </div>

            {/* Tabs */}
            <Tabs defaultValue={crawlResult ? "crawl" : "overview"} className="space-y-4">
              <TabsList className={`grid w-full h-10 ${crawlResult ? "grid-cols-6" : "grid-cols-5"}`}>
                {crawlResult && (
                  <TabsTrigger value="crawl" className="text-xs font-semibold gap-1">
                    <Bot className="w-3 h-3" />
                    Gullanbot
                  </TabsTrigger>
                )}
                <TabsTrigger value="overview" className="text-xs font-semibold">
                  Genel Bakış
                </TabsTrigger>
                <TabsTrigger value="details" className="text-xs font-semibold">
                  Derin İnceleme
                </TabsTrigger>
                <TabsTrigger
                  value="platforms"
                  className="text-xs font-semibold"
                >
                  Platformlar
                </TabsTrigger>
                <TabsTrigger value="actions" className="text-xs font-semibold">
                  Eylemler ({result.actions.length})
                </TabsTrigger>
                <TabsTrigger value="ai" className="text-xs font-semibold gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI Öneri
                </TabsTrigger>
              </TabsList>

              {/* Gullanbot Crawl Results */}
              {crawlResult && (
                <TabsContent value="crawl">
                  <CrawlResults data={crawlResult} />
                </TabsContent>
              )}

              {/* Overview */}
              <TabsContent value="overview">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Hızlı İstatistikler</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          {
                            label: "Yanıt Süresi",
                            value: `${result.technical.responseTime}ms`,
                          },
                          {
                            label: "Sayfa Boyutu",
                            value: `${(result.technical.pageSize / 1024).toFixed(0)} KB`,
                          },
                          {
                            label: "Kelime Sayısı",
                            value: result.content.wordCount.toLocaleString("tr-TR"),
                          },
                          {
                            label: "Başlıklar",
                            value: `${result.content.headings.length}`,
                          },
                          {
                            label: "Görseller",
                            value: `${result.technical.imgCount}`,
                          },
                          {
                            label: "Şemalar",
                            value: `${result.schema.schemas.length}`,
                          },
                          {
                            label: "İç Bağlantılar",
                            value: `${result.content.internalLinks}`,
                          },
                          {
                            label: "Cevap Blokları",
                            value: `${result.citability.answerBlockCount}`,
                          },
                          {
                            label: "AI Bot Erişimi",
                            value: `${result.crawlerAccess.allowedBots}/${result.crawlerAccess.allowedBots + result.crawlerAccess.blockedBots}`,
                          },
                          {
                            label: "Sosyal Profiller",
                            value: `${result.brandAuthority.socialProfileCount}`,
                          },
                        ].map((s) => (
                          <div
                            key={s.label}
                            className="rounded-lg bg-secondary border border-border p-3"
                          >
                            <p className="text-lg font-extrabold text-foreground tabular-nums">
                              {s.value}
                            </p>
                            <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                              {s.label}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">
                        Öncelikli Eylemler
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ActionList actions={result.actions.slice(0, 5)} />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Details */}
              <TabsContent value="details">
                <DetailSections data={result} />
              </TabsContent>

              {/* Platforms */}
              <TabsContent value="platforms">
                <PlatformCards platforms={result.platforms} />
              </TabsContent>

              {/* Actions */}
              <TabsContent value="actions">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      Tüm Eylemler ({result.actions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ActionList actions={result.actions} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* AI Recommendations */}
              <TabsContent value="ai">
                {result.aiRecommendations && result.aiRecommendations.length > 0 ? (
                  <AIRecommendations recommendations={result.aiRecommendations} />
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-6 h-6 text-violet-400" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground mb-1">
                        Yapay Zekâ Önerileri
                      </h3>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        {!process.env.NEXT_PUBLIC_HAS_AI
                          ? "OpenAI API anahtarı yapılandırıldığında, sitenize özel GPT-4o destekli akıllı öneriler burada görünecek."
                          : "AI önerileri yükleniyor veya bu site için öneri üretilemedi."}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
