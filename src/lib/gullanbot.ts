/**
 * Gullanbot — Full-site crawler for GEO Audit
 *
 * Crawls like Googlebot: discovers pages via sitemap + internal links,
 * performs a lightweight audit on each page, and aggregates site-wide issues.
 */

import * as cheerio from "cheerio";
import type {
  PageSummary,
  FullSiteAudit,
  SiteWideIssue,
  AuditResult,
  CrawlProgress,
} from "./types";
import { runAudit } from "./audit-engine";

// ─── Config ──────────────────────────────────────────────────────────

const MAX_PAGES = 50;
const CONCURRENCY = 3;
const FETCH_TIMEOUT = 8000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ─── Helpers ─────────────────────────────────────────────────────────

async function safeFetch(
  url: string,
  timeout = FETCH_TIMEOUT
): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    clearTimeout(id);
    return res;
  } catch {
    return null;
  }
}

function normalizeUrl(href: string, base: string): string | null {
  try {
    const url = new URL(href, base);
    // Strip hash and trailing slash for dedup
    url.hash = "";
    let path = url.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    url.pathname = path;
    // Remove common tracking params
    url.searchParams.delete("utm_source");
    url.searchParams.delete("utm_medium");
    url.searchParams.delete("utm_campaign");
    url.searchParams.delete("utm_term");
    url.searchParams.delete("utm_content");
    url.searchParams.delete("fbclid");
    url.searchParams.delete("gclid");
    return url.toString();
  } catch {
    return null;
  }
}

function isSameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

function shouldSkipUrl(url: string): boolean {
  const lower = url.toLowerCase();
  const SKIP_EXTENSIONS = [
    ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".ico", ".bmp",
    ".pdf", ".zip", ".rar", ".gz", ".tar",
    ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".webm",
    ".css", ".js", ".json", ".xml", ".woff", ".woff2", ".ttf", ".eot",
  ];
  if (SKIP_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  if (/\/(wp-admin|wp-includes|wp-json|feed|xmlrpc|cart|checkout|my-account|login|register|admin)\b/i.test(url)) return true;
  if (lower.includes("?add-to-cart=") || lower.includes("?action=")) return true;
  return false;
}

// ─── Sitemap Parser ──────────────────────────────────────────────────

async function discoverFromSitemap(baseUrl: string): Promise<string[]> {
  const urls: Set<string> = new Set();
  const origin = new URL(baseUrl).origin;

  // Try common sitemap locations
  const sitemapUrls = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/wp-sitemap.xml`,
    `${origin}/sitemap/sitemap-index.xml`,
  ];

  // Also check robots.txt for Sitemap directives
  try {
    const robotsRes = await safeFetch(`${origin}/robots.txt`, 5000);
    if (robotsRes && robotsRes.ok) {
      const robotsTxt = await robotsRes.text();
      const matches = robotsTxt.matchAll(/Sitemap:\s*(.+)/gi);
      for (const m of matches) {
        const smUrl = m[1].trim();
        if (!sitemapUrls.includes(smUrl)) {
          sitemapUrls.unshift(smUrl);
        }
      }
    }
  } catch { /* ignore */ }

  for (const smUrl of sitemapUrls) {
    if (urls.size >= MAX_PAGES) break;
    try {
      const res = await safeFetch(smUrl, 5000);
      if (!res || !res.ok) continue;
      const text = await res.text();

      // Sitemap index — contains <sitemap><loc> entries
      if (text.includes("<sitemapindex")) {
        const $ = cheerio.load(text, { xmlMode: true });
        const childSitemaps: string[] = [];
        $("sitemap > loc").each((_, el) => {
          childSitemaps.push($(el).text().trim());
        });
        // Parse first few child sitemaps
        for (const childUrl of childSitemaps.slice(0, 3)) {
          const childRes = await safeFetch(childUrl, 5000);
          if (!childRes || !childRes.ok) continue;
          const childText = await childRes.text();
          const $c = cheerio.load(childText, { xmlMode: true });
          $c("url > loc").each((_, el) => {
            const loc = $c(el).text().trim();
            if (isSameOrigin(loc, origin) && !shouldSkipUrl(loc) && urls.size < MAX_PAGES) {
              urls.add(loc);
            }
          });
        }
      } else if (text.includes("<urlset")) {
        // Regular sitemap
        const $ = cheerio.load(text, { xmlMode: true });
        $("url > loc").each((_, el) => {
          const loc = $(el).text().trim();
          if (isSameOrigin(loc, origin) && !shouldSkipUrl(loc) && urls.size < MAX_PAGES) {
            urls.add(loc);
          }
        });
      }

      if (urls.size > 0) break; // Found a working sitemap
    } catch { /* try next */ }
  }

  return [...urls];
}

// ─── Internal Link Discovery ─────────────────────────────────────────

function extractInternalLinks(
  html: string,
  pageUrl: string,
  origin: string
): string[] {
  const $ = cheerio.load(html);
  const links: Set<string> = new Set();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

    const normalized = normalizeUrl(href, pageUrl);
    if (normalized && isSameOrigin(normalized, origin) && !shouldSkipUrl(normalized)) {
      links.add(normalized);
    }
  });

  return [...links];
}

// ─── Lightweight Page Audit ──────────────────────────────────────────

async function auditPage(url: string, origin: string): Promise<{ page: PageSummary; html: string }> {
  const start = Date.now();
  const res = await safeFetch(url);
  const responseTime = Date.now() - start;

  if (!res) {
    return { html: "", page: {
      url, status: "error", error: "Bağlantı kurulamadı", title: "", wordCount: 0,
      h1Count: 0, imgCount: 0, imgWithoutAlt: 0, hasCanonical: false, hasMeta: false,
      hasOG: false, schemaTypes: [], internalLinks: 0, externalLinks: 0,
      responseTime, pageSize: 0, score: 0, issues: ["Sayfa erişilemedi"],
    }};
  }

  if (!res.ok) {
    return { html: "", page: {
      url, status: "error", statusCode: res.status, error: `HTTP ${res.status}`, title: "",
      wordCount: 0, h1Count: 0, imgCount: 0, imgWithoutAlt: 0, hasCanonical: false,
      hasMeta: false, hasOG: false, schemaTypes: [], internalLinks: 0, externalLinks: 0,
      responseTime, pageSize: 0, score: 0, issues: [`HTTP ${res.status} hatası`],
    }};
  }

  const html = await res.text();
  const pageSize = new Blob([html]).size;
  const $ = cheerio.load(html);
  const issues: string[] = [];

  // Title
  const title = $("title").first().text().trim();
  if (!title) issues.push("Başlık eksik");
  else if (title.length > 60) issues.push("Başlık çok uzun");

  // Meta description
  const metaDesc = $('meta[name="description"]').attr("content") || "";
  const hasMeta = metaDesc.length > 0;
  if (!hasMeta) issues.push("Meta açıklama eksik");

  // Canonical
  const hasCanonical = !!$('link[rel="canonical"]').attr("href");
  if (!hasCanonical) issues.push("Canonical eksik");

  // H1
  const h1Count = $("h1").length;
  if (h1Count === 0) issues.push("H1 eksik");
  else if (h1Count > 1) issues.push(`${h1Count} adet H1`);

  // Images
  const imgCount = $("img").length;
  let imgWithoutAlt = 0;
  $("img").each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt === undefined || alt === "") imgWithoutAlt++;
  });
  if (imgWithoutAlt > 0) issues.push(`${imgWithoutAlt} alt eksik görsel`);

  // OG tags
  const hasOG = $('meta[property^="og:"]').length > 0;
  if (!hasOG) issues.push("OG etiketleri eksik");

  // Schema
  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "{}");
      const items = data["@graph"] || [data];
      for (const item of items) {
        const t = item["@type"];
        if (t) {
          const types = Array.isArray(t) ? t : [t];
          schemaTypes.push(...types);
        }
      }
    } catch { /* skip */ }
  });

  // Word count
  const $content = cheerio.load(html);
  $content("script, style, nav, footer, header, noscript").remove();
  const text = $content("body").text().replace(/\s+/g, " ").trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Links
  let internalLinks = 0;
  let externalLinks = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    try {
      const normalized = normalizeUrl(href, url);
      if (normalized) {
        if (isSameOrigin(normalized, origin)) internalLinks++;
        else externalLinks++;
      }
    } catch { /* skip */ }
  });

  // Performance issues
  if (responseTime > 3000) issues.push("Yavaş yanıt (>3s)");
  if (pageSize > 500000) issues.push("Büyük sayfa (>500KB)");

  // Calculate quick score (0-100)
  let score = 100;
  if (!title) score -= 20;
  if (!hasMeta) score -= 15;
  if (!hasCanonical) score -= 10;
  if (h1Count === 0) score -= 15;
  if (h1Count > 1) score -= 5;
  if (imgWithoutAlt > 0) score -= Math.min(10, imgWithoutAlt * 2);
  if (!hasOG) score -= 5;
  if (schemaTypes.length === 0) score -= 10;
  if (responseTime > 3000) score -= 10;
  if (pageSize > 500000) score -= 5;
  if (wordCount < 100) score -= 5;
  score = Math.max(0, Math.min(100, score));

  return { html, page: {
    url, status: "success", statusCode: res.status, title, wordCount,
    h1Count, imgCount, imgWithoutAlt, hasCanonical, hasMeta, hasOG,
    schemaTypes, internalLinks, externalLinks, responseTime, pageSize,
    score, issues,
  }};
}

// ─── Site-Wide Issue Aggregation ─────────────────────────────────────

function aggregateIssues(pages: PageSummary[]): SiteWideIssue[] {
  const successPages = pages.filter((p) => p.status === "success");
  const total = successPages.length;
  if (total === 0) return [];

  const issues: SiteWideIssue[] = [];

  function check(
    type: SiteWideIssue["type"],
    severity: SiteWideIssue["severity"],
    title: string,
    description: string,
    filter: (p: PageSummary) => boolean
  ) {
    const affected = successPages.filter(filter);
    if (affected.length > 0) {
      issues.push({
        type, severity, title, description,
        count: affected.length, total,
        percentage: Math.round((affected.length / total) * 100),
        affectedUrls: affected.slice(0, 10).map((p) => p.url),
      });
    }
  }

  check("missing-title", "critical", "Başlık Eksik Sayfalar",
    "Sayfa başlığı (<title>) olmayan sayfalar. SEO ve AI keşfedilebilirliği için zorunlu.",
    (p) => !p.title);

  check("missing-meta", "high", "Meta Açıklama Eksik Sayfalar",
    "Meta description etiketi olmayan sayfalar.",
    (p) => !p.hasMeta);

  check("missing-h1", "high", "H1 Başlık Eksik Sayfalar",
    "H1 başlığı olmayan sayfalar.",
    (p) => p.h1Count === 0);

  check("missing-canonical", "medium", "Canonical Eksik Sayfalar",
    "Canonical URL tanımlı olmayan sayfalar.",
    (p) => !p.hasCanonical);

  check("missing-alt", "medium", "Alt Etiketi Eksik Görseller",
    "En az bir alt etiketi eksik görseli olan sayfalar.",
    (p) => p.imgWithoutAlt > 0);

  check("missing-og", "medium", "Open Graph Eksik Sayfalar",
    "OG meta etiketleri olmayan sayfalar.",
    (p) => !p.hasOG);

  check("missing-schema", "medium", "Yapısal Veri Eksik Sayfalar",
    "Hiçbir JSON-LD şeması olmayan sayfalar.",
    (p) => p.schemaTypes.length === 0);

  check("slow-page", "high", "Yavaş Sayfalar (>3s)",
    "3 saniyeden uzun yanıt süresi olan sayfalar.",
    (p) => p.responseTime > 3000);

  check("large-page", "medium", "Büyük Sayfalar (>500KB)",
    "500KB'dan büyük sayfalar.",
    (p) => p.pageSize > 500000);

  // Duplicate title check
  const titleMap = new Map<string, string[]>();
  for (const p of successPages) {
    if (p.title) {
      const existing = titleMap.get(p.title) || [];
      existing.push(p.url);
      titleMap.set(p.title, existing);
    }
  }
  const dupTitles = [...titleMap.entries()].filter(([, urls]) => urls.length > 1);
  if (dupTitles.length > 0) {
    const allDupUrls = dupTitles.flatMap(([, urls]) => urls);
    issues.push({
      type: "duplicate-title", severity: "high",
      title: "Yinelenen Başlıklar",
      description: `${dupTitles.length} farklı başlık birden fazla sayfada kullanılıyor.`,
      count: allDupUrls.length, total,
      percentage: Math.round((allDupUrls.length / total) * 100),
      affectedUrls: allDupUrls.slice(0, 10),
    });
  }

  return issues.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });
}

// ─── Concurrent Crawl with BFS ───────────────────────────────────────

async function crawlWithBFS(
  startUrl: string,
  sitemapUrls: string[],
  onProgress?: (progress: CrawlProgress) => void
): Promise<PageSummary[]> {
  const origin = new URL(startUrl).origin;
  const visited = new Set<string>();
  const queue: string[] = [];
  const results: PageSummary[] = [];

  // Seed with sitemap URLs + start URL
  const normalizedStart = normalizeUrl(startUrl, startUrl) || startUrl;
  queue.push(normalizedStart);
  for (const u of sitemapUrls) {
    const n = normalizeUrl(u, startUrl);
    if (n && !queue.includes(n)) queue.push(n);
  }

  const totalEstimate = Math.min(queue.length, MAX_PAGES);

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    // Take a batch
    const batch: string[] = [];
    while (batch.length < CONCURRENCY && queue.length > 0) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);
      batch.push(url);
    }

    if (batch.length === 0) break;

    onProgress?.({
      phase: "crawling",
      discovered: queue.length + visited.size,
      crawled: visited.size,
      total: Math.min(queue.length + visited.size, MAX_PAGES),
      currentUrl: batch[0],
      message: `${visited.size} / ~${Math.min(queue.length + visited.size, MAX_PAGES)} sayfa taranıyor…`,
    });

    // Crawl batch concurrently
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const { page, html } = await auditPage(url, origin);

        // Discover new internal links from the same HTML (no double fetch)
        if (page.status === "success" && html) {
          const newLinks = extractInternalLinks(html, url, origin);
          for (const link of newLinks) {
            if (!visited.has(link) && !queue.includes(link) && visited.size + queue.length < MAX_PAGES) {
              queue.push(link);
            }
          }
        }

        return page;
      })
    );

    results.push(...batchResults);
  }

  return results;
}

// ─── Main Crawl Function ─────────────────────────────────────────────

export async function crawlSite(
  url: string,
  onProgress?: (progress: CrawlProgress) => void
): Promise<FullSiteAudit> {
  const startTime = Date.now();

  // Phase 1: Discover pages from sitemap
  onProgress?.({
    phase: "sitemap",
    discovered: 0, crawled: 0, total: 0,
    message: "Sitemap taranıyor…",
  });

  const sitemapUrls = await discoverFromSitemap(url);

  onProgress?.({
    phase: "sitemap",
    discovered: sitemapUrls.length, crawled: 0, total: sitemapUrls.length,
    message: `Sitemap'ten ${sitemapUrls.length} URL bulundu.`,
  });

  // Phase 2: Crawl all discovered pages with BFS
  const pages = await crawlWithBFS(url, sitemapUrls, onProgress);

  // Phase 3: Run full audit on homepage
  onProgress?.({
    phase: "auditing",
    discovered: pages.length, crawled: pages.length, total: pages.length,
    message: "Ana sayfa detaylı denetleniyor…",
  });

  const homepageAudit = await runAudit(url);

  // Phase 4: Aggregate results
  const successPages = pages.filter((p) => p.status === "success");
  const errorPages = pages.filter((p) => p.status === "error");
  const skippedPages = pages.filter((p) => p.status === "skipped");

  const siteWideIssues = aggregateIssues(pages);

  const avgResponseTime = successPages.length > 0
    ? Math.round(successPages.reduce((a, p) => a + p.responseTime, 0) / successPages.length)
    : 0;
  const avgPageSize = successPages.length > 0
    ? Math.round(successPages.reduce((a, p) => a + p.pageSize, 0) / successPages.length)
    : 0;
  const avgScore = successPages.length > 0
    ? Math.round(successPages.reduce((a, p) => a + p.score, 0) / successPages.length)
    : 0;

  const totalTime = Date.now() - startTime;

  onProgress?.({
    phase: "done",
    discovered: pages.length, crawled: pages.length, total: pages.length,
    message: `Tamamlandı! ${pages.length} sayfa ${(totalTime / 1000).toFixed(1)}s'de tarandı.`,
  });

  return {
    url,
    timestamp: new Date().toISOString(),
    siteType: homepageAudit.siteType,
    crawlStats: {
      totalPages: pages.length,
      crawledPages: successPages.length,
      errorPages: errorPages.length,
      skippedPages: skippedPages.length,
      totalTime,
      avgResponseTime,
      avgPageSize,
      avgScore,
    },
    siteWideIssues,
    pages: pages.sort((a, b) => a.score - b.score), // worst first
    homepageAudit,
    scores: homepageAudit.scores,
    actions: homepageAudit.actions,
    aiRecommendations: homepageAudit.aiRecommendations,
  };
}
