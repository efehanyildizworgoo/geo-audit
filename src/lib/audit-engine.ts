import * as cheerio from "cheerio";
import type {
  AuditResult,
  TechnicalAudit,
  ContentAudit,
  SchemaAudit,
  SchemaItem,
  CitabilityAudit,
  CrawlerAudit,
  BrandAuthorityAudit,
  PlatformScores,
  PlatformDetail,
  ActionItem,
  SiteType,
  SiteTypeInfo,
} from "./types";

// ─── Helpers ────────────────────────────────────────────────────────

async function safeFetch(url: string, timeout = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      redirect: "follow",
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    console.error("[safeFetch] Failed for", url, err);
    throw err;
  }
}

async function safeFetchText(url: string): Promise<string> {
  try {
    const res = await safeFetch(url);
    if (!res.ok) return "";
    return res.text();
  } catch {
    return "";
  }
}

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

// ─── Technical Audit ────────────────────────────────────────────────

async function auditTechnical(
  url: string,
  $: cheerio.CheerioAPI,
  headers: Headers,
  responseTime: number,
  html: string
): Promise<TechnicalAudit> {
  const title = $("title").first().text().trim();
  const metaDesc = $('meta[name="description"]').attr("content") || "";
  const canonical = $('link[rel="canonical"]').attr("href") || "";
  const robotsMeta = $('meta[name="robots"]').attr("content") || "";

  const ogTags: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr("property") || "";
    ogTags[prop] = $(el).attr("content") || "";
  });

  const twitterTags: Record<string, string> = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr("name") || "";
    twitterTags[name] = $(el).attr("content") || "";
  });

  let imgWithoutAlt = 0;
  $("img").each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt === undefined || alt === "") imgWithoutAlt++;
  });

  let sslValid = true;
  let sslError: string | undefined;
  if (!url.startsWith("https")) {
    try {
      const httpsUrl = url.replace("http://", "https://");
      const sslRes = await safeFetch(httpsUrl, 5000);
      if (!sslRes) {
        sslValid = false;
        sslError = "SSL bağlantısı kurulamadı veya sertifika geçersiz";
      }
    } catch {
      sslValid = false;
      sslError = "SSL doğrulama başarısız";
    }
  }

  return {
    ssl: { valid: sslValid, error: sslError },
    httpVersion: "HTTP/2",
    server: headers.get("server") || "Bilinmiyor",
    responseTime,
    pageSize: new Blob([html]).size,
    title,
    titleLength: title.length,
    metaDescription: metaDesc,
    metaDescriptionLength: metaDesc.length,
    canonical,
    hasCanonical: !!canonical,
    robotsMeta,
    ogTags,
    twitterTags,
    h1Count: $("h1").length,
    h2Count: $("h2").length,
    h3Count: $("h3").length,
    imgCount: $("img").length,
    imgWithoutAlt,
    securityHeaders: {
      hsts: !!headers.get("strict-transport-security"),
      xFrameOptions: !!headers.get("x-frame-options"),
      contentSecurityPolicy: !!headers.get("content-security-policy"),
      xContentTypeOptions: !!headers.get("x-content-type-options"),
      permissionsPolicy: !!headers.get("permissions-policy"),
      xPoweredBy: headers.get("x-powered-by"),
    },
    cacheControl: headers.get("cache-control") || "",
  };
}

// ─── Content Audit ──────────────────────────────────────────────────
// BUG FIX: Use a separate cheerio load so we don't mutate the shared $ instance

function auditContent(html: string, baseHostname: string): ContentAudit {
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    headings.push($(el).text().trim());
  });

  // BUG FIX: External link detection — old code compared href hostname to itself
  let internalLinks = 0;
  let externalLinks = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      if (href.startsWith("http")) {
        const linkHost = new URL(href).hostname;
        if (linkHost === baseHostname || linkHost === `www.${baseHostname}` || baseHostname === `www.${linkHost}`) {
          internalLinks++;
        } else {
          externalLinks++;
        }
      } else {
        internalLinks++;
      }
    } catch {
      internalLinks++;
    }
  });

  const lowerText = text.toLowerCase();
  const hasAuthorInfo =
    /(?:yazar|author|written by|hazırlayan|dr\.|doç\.|prof\.)/i.test(text);
  const hasDateInfo =
    /(?:yayınlanma|güncellen|published|updated|\d{1,2}[./]\d{1,2}[./]\d{2,4})/i.test(text);

  const languageSignals: string[] = [];
  if (/[çğıöşüÇĞIÖŞÜ]/.test(text)) languageSignals.push("tr");
  if (/\b(?:the|and|for|that|with)\b/i.test(text)) languageSignals.push("en");

  return {
    wordCount,
    headings,
    hasH1: $("h1").length > 0,
    internalLinks,
    externalLinks,
    hasStructuredContent: $("ul, ol").length > 0 || $("table").length > 0,
    hasFAQ:
      lowerText.includes("sık sorulan") ||
      lowerText.includes("sıkça sorulan") ||
      lowerText.includes("faq") ||
      lowerText.includes("frequently asked"),
    hasTables: $("table").length > 0,
    hasLists: $("ul, ol").length > 0,
    hasAuthorInfo,
    hasDateInfo,
    languageSignals,
  };
}

// ─── Schema Audit ───────────────────────────────────────────────────

function auditSchema($: cheerio.CheerioAPI): SchemaAudit {
  const schemas: SchemaItem[] = [];
  const allTypes = new Set<string>();
  const sameAsLinks: string[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || "{}";
      const data = JSON.parse(raw);
      const items = data["@graph"] || [data];
      for (const item of items) {
        const typeRaw = item["@type"];
        const types: string[] = Array.isArray(typeRaw) ? typeRaw : [typeRaw || "Unknown"];
        for (const t of types) {
          allTypes.add(t);
        }
        schemas.push({
          type: types.join(", "),
          properties: Object.keys(item).filter((k) => !k.startsWith("@")),
        });
        // Extract sameAs
        if (item.sameAs) {
          const links = Array.isArray(item.sameAs) ? item.sameAs : [item.sameAs];
          sameAsLinks.push(...links.filter((l: unknown) => typeof l === "string"));
        }
      }
    } catch {
      /* skip invalid json-ld */
    }
  });

  const MEDICAL_TYPES = [
    "MedicalWebPage", "MedicalClinic", "MedicalOrganization",
    "Physician", "Dentist", "Hospital",
  ];

  return {
    schemas,
    hasOrganization: allTypes.has("Organization"),
    hasWebSite: allTypes.has("WebSite"),
    hasWebPage: allTypes.has("WebPage") || allTypes.has("MedicalWebPage"),
    hasArticle:
      allTypes.has("Article") ||
      allTypes.has("BlogPosting") ||
      allTypes.has("NewsArticle") ||
      allTypes.has("MedicalWebPage"),
    hasFAQPage: allTypes.has("FAQPage"),
    hasBreadcrumb: allTypes.has("BreadcrumbList"),
    hasLocalBusiness:
      allTypes.has("LocalBusiness") ||
      allTypes.has("MedicalClinic") ||
      allTypes.has("LegalService") ||
      allTypes.has("Attorney") ||
      allTypes.has("Physician") ||
      allTypes.has("Dentist"),
    hasProduct: allTypes.has("Product"),
    hasReview: allTypes.has("Review") || allTypes.has("AggregateRating"),
    hasHowTo: allTypes.has("HowTo"),
    hasPerson: allTypes.has("Person"),
    hasMedicalSchema: MEDICAL_TYPES.some((t) => allTypes.has(t)),
    sameAsLinks: [...new Set(sameAsLinks)],
  };
}

// ─── Citability Audit ───────────────────────────────────────────────

async function auditCitability(url: string, html: string): Promise<CitabilityAudit> {
  const base = new URL(url).origin;
  const llmsTxt = await safeFetchText(`${base}/llms.txt`);

  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript").remove();
  const text = $("body").text();

  const hasDefinitions =
    /(?:nedir|ne demek|tanımı|means|definition|refers to|olarak tanımlan)/i.test(text);
  const hasStats =
    /(?:%\s*\d|\d+\s*%|\d+\.\d+|istatistik|statistics|according to|araştırma|çalışma)/i.test(text);
  const hasTables = $("table").length > 0;
  const paragraphs = $("p").toArray();
  const hasSummaryParagraphs = paragraphs.length > 3;
  const hasQuotableContent = hasDefinitions || hasStats;

  // Count answer-style blocks (40-80 word paragraphs under H2/H3)
  let answerBlockCount = 0;
  const paragraphLengths: number[] = [];
  paragraphs.forEach((p) => {
    const pText = $(p).text().trim();
    const words = pText.split(/\s+/).filter(Boolean).length;
    paragraphLengths.push(words);
    if (words >= 30 && words <= 100) answerBlockCount++;
  });

  const avgParagraphLength =
    paragraphLengths.length > 0
      ? Math.round(
          paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length
        )
      : 0;

  return {
    hasLlmsTxt: !!llmsTxt,
    llmsTxtContent: llmsTxt.slice(0, 500),
    hasSummaryParagraphs,
    hasDefinitions,
    hasStats,
    hasTables,
    hasQuotableContent,
    answerBlockCount,
    avgParagraphLength,
  };
}

// ─── Crawler Access Audit ───────────────────────────────────────────

const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Googlebot",
  "Bingbot",
  "FacebookBot",
  "Applebot",
  "Bytespider",
  "CCBot",
  "cohere-ai",
  "Diffbot",
];

async function auditCrawlerAccess(url: string): Promise<CrawlerAudit> {
  const base = new URL(url).origin;
  const robotsTxt = await safeFetchText(`${base}/robots.txt`);
  const sitemapMatch = robotsTxt.match(/Sitemap:\s*(.+)/i);
  const sitemapUrl = sitemapMatch ? sitemapMatch[1].trim() : "";

  function getCrawlerRule(botName: string): string {
    const regex = new RegExp(
      `User-agent:\\s*${botName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?(?=User-agent:|$)`,
      "i"
    );
    const match = robotsTxt.match(regex);
    if (!match) return "İzin veriliyor (varsayılan)";
    if (/Disallow:\s*\/\s*$/m.test(match[0])) return "Engellendi";
    if (/Disallow:\s*$/m.test(match[0])) return "İzin veriliyor";
    return "Kısmi erişim";
  }

  const crawlerRules: Record<string, string> = {};
  let allowed = 0;
  let blocked = 0;
  for (const bot of AI_BOTS) {
    const rule = getCrawlerRule(bot);
    crawlerRules[bot] = rule;
    if (rule.includes("Engellendi")) blocked++;
    else allowed++;
  }

  return {
    robotsTxt: robotsTxt.slice(0, 1500),
    hasSitemap: !!sitemapUrl,
    sitemapUrl,
    crawlerRules,
    allowedBots: allowed,
    blockedBots: blocked,
  };
}

// ─── Brand Authority Audit ──────────────────────────────────────────

function auditBrandAuthority(
  $: cheerio.CheerioAPI,
  schemaSameAs: string[]
): BrandAuthorityAudit {
  // Collect all potential social links from HTML + schema sameAs
  const allLinks = new Set<string>(schemaSameAs);

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (
      /facebook\.com|twitter\.com|x\.com|instagram\.com|linkedin\.com|youtube\.com|wikipedia\.org/i.test(
        href
      )
    ) {
      allLinks.add(href);
    }
  });

  const links = [...allLinks];
  const hasFacebook = links.some((l) => /facebook\.com/i.test(l));
  const hasTwitter = links.some((l) => /twitter\.com|x\.com/i.test(l));
  const hasInstagram = links.some((l) => /instagram\.com/i.test(l));
  const hasLinkedIn = links.some((l) => /linkedin\.com/i.test(l));
  const hasYouTube = links.some((l) => /youtube\.com/i.test(l));
  const hasWikipedia = links.some((l) => /wikipedia\.org/i.test(l));

  let count = 0;
  if (hasFacebook) count++;
  if (hasTwitter) count++;
  if (hasInstagram) count++;
  if (hasLinkedIn) count++;
  if (hasYouTube) count++;

  const signals: string[] = [];
  if (hasFacebook) signals.push("Facebook");
  if (hasTwitter) signals.push("X / Twitter");
  if (hasInstagram) signals.push("Instagram");
  if (hasLinkedIn) signals.push("LinkedIn");
  if (hasYouTube) signals.push("YouTube");
  if (hasWikipedia) signals.push("Wikipedia");
  if (schemaSameAs.length > 0)
    signals.push(`${schemaSameAs.length} sameAs bağlantısı`);

  return {
    sameAsLinks: links,
    hasFacebook,
    hasTwitter,
    hasInstagram,
    hasLinkedIn,
    hasYouTube,
    hasWikipedia,
    socialProfileCount: count,
    brandMentionSignals: signals,
  };
}

// ─── Scoring Functions ──────────────────────────────────────────────

function scoreTechnical(t: TechnicalAudit): number {
  let s = 100;
  if (!t.ssl.valid) s -= 25;
  if (!t.hasCanonical) s -= 10;
  if (t.titleLength === 0) s -= 15;
  else if (t.titleLength > 60) s -= 5;
  if (t.metaDescriptionLength === 0) s -= 15;
  else if (t.metaDescriptionLength > 160) s -= 5;
  if (t.h1Count === 0) s -= 10;
  else if (t.h1Count > 1) s -= 5;
  if (Object.keys(t.ogTags).length === 0) s -= 5;
  if (Object.keys(t.twitterTags).length === 0) s -= 5;
  if (t.imgWithoutAlt > 0) s -= Math.min(10, t.imgWithoutAlt * 2);
  if (!t.securityHeaders.hsts) s -= 3;
  if (!t.securityHeaders.xFrameOptions) s -= 2;
  if (!t.securityHeaders.contentSecurityPolicy) s -= 2;
  if (!t.securityHeaders.xContentTypeOptions) s -= 2;
  if (t.securityHeaders.xPoweredBy) s -= 3;
  if (t.pageSize > 500000) s -= 5;
  if (t.responseTime > 3000) s -= 10;
  else if (t.responseTime > 1500) s -= 5;
  return clamp(s);
}

function scoreContent(c: ContentAudit): number {
  let s = 40;
  if (c.wordCount > 300) s += 10;
  if (c.wordCount > 800) s += 10;
  if (c.wordCount > 2000) s += 5;
  if (c.hasH1) s += 5;
  if (c.headings.length > 3) s += 5;
  if (c.headings.length > 8) s += 5;
  if (c.internalLinks > 5) s += 5;
  if (c.externalLinks > 0) s += 3;
  if (c.hasFAQ) s += 5;
  if (c.hasStructuredContent) s += 3;
  if (c.hasTables) s += 3;
  if (c.hasLists) s += 3;
  if (c.hasAuthorInfo) s += 5;
  if (c.hasDateInfo) s += 3;
  return clamp(s);
}

function scoreSchema(sc: SchemaAudit, siteType: SiteType): number {
  const weights = SCHEMA_RELEVANCE[siteType] || SCHEMA_RELEVANCE["unknown"];
  let s = 0;
  if (sc.hasOrganization) s += weights.Organization || 0;
  if (sc.hasWebSite) s += weights.WebSite || 0;
  if (sc.hasWebPage) s += weights.WebPage || 0;
  if (sc.hasArticle) s += weights.Article || 0;
  if (sc.hasFAQPage) s += weights.FAQPage || 0;
  if (sc.hasBreadcrumb) s += weights.BreadcrumbList || 0;
  if (sc.hasLocalBusiness) s += weights.LocalBusiness || 0;
  if (sc.hasProduct) s += weights.Product || 0;
  if (sc.hasReview) s += weights.Review || 0;
  if (sc.hasHowTo) s += weights.HowTo || 0;
  if (sc.hasPerson) s += weights.Person || 0;
  if (sc.hasMedicalSchema) s += weights.MedicalSchema || 0;
  if (sc.sameAsLinks.length > 3) s += 5;
  return clamp(s);
}

function scoreCitability(ci: CitabilityAudit): number {
  let s = 15;
  if (ci.hasLlmsTxt) s += 20;
  if (ci.hasSummaryParagraphs) s += 10;
  if (ci.hasDefinitions) s += 15;
  if (ci.hasStats) s += 15;
  if (ci.hasTables) s += 10;
  if (ci.hasQuotableContent) s += 5;
  if (ci.answerBlockCount > 3) s += 10;
  if (ci.avgParagraphLength >= 30 && ci.avgParagraphLength <= 80) s += 5;
  return clamp(s);
}

function scoreCrawlerAccess(cr: CrawlerAudit): number {
  let s = 30;
  if (cr.hasSitemap) s += 15;
  // Each allowed key AI bot gives points
  const keyBots = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "Googlebot"];
  for (const bot of keyBots) {
    if (cr.crawlerRules[bot] && !cr.crawlerRules[bot].includes("Engellendi")) {
      s += 11;
    }
  }
  return clamp(s);
}

function scoreBrandAuthority(ba: BrandAuthorityAudit): number {
  let s = 20;
  s += Math.min(30, ba.socialProfileCount * 8);
  if (ba.hasWikipedia) s += 20;
  if (ba.sameAsLinks.length > 3) s += 10;
  if (ba.sameAsLinks.length > 6) s += 10;
  if (ba.hasLinkedIn) s += 5;
  if (ba.hasYouTube) s += 5;
  return clamp(s);
}

// ─── Platform-Specific Scoring ──────────────────────────────────────

function scorePlatforms(
  t: TechnicalAudit,
  c: ContentAudit,
  sc: SchemaAudit,
  ci: CitabilityAudit,
  cr: CrawlerAudit,
  ba: BrandAuthorityAudit,
  siteType: SiteType = "unknown"
): PlatformScores {
  function platform(
    calc: () => { score: number; strengths: string[]; weaknesses: string[] }
  ): PlatformDetail {
    const r = calc();
    r.score = clamp(r.score);
    return r;
  }

  const googleAIO = platform(() => {
    let score = 20;
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (sc.hasFAQPage) { score += 20; strengths.push("FAQPage şeması mevcut"); }
    else weaknesses.push("FAQPage şeması eksik");
    if (sc.hasOrganization) { score += 10; strengths.push("Organization şeması mevcut"); }
    if (t.hasCanonical) { score += 5; strengths.push("Canonical URL tanımlı"); }
    if (ci.hasDefinitions) { score += 15; strengths.push("Tanım içeren cevap blokları var"); }
    else weaknesses.push("H2/H3 altında 40-80 kelimelik cevap blokları ekle");
    if (ci.answerBlockCount > 3) { score += 10; strengths.push(`${ci.answerBlockCount} cevap bloğu tespit edildi`); }
    if (c.hasTables) { score += 5; strengths.push("Tablo içeriği var"); }
    else weaknesses.push("SSS ve karşılaştırma tabloları ekle");
    if (c.hasFAQ) { score += 10; strengths.push("SSS bölümü mevcut"); }
    if (c.hasLists) score += 5;
    return { score, strengths, weaknesses };
  });

  const chatGPT = platform(() => {
    let score = 20;
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (ci.hasLlmsTxt) { score += 25; strengths.push("llms.txt dosyası mevcut"); }
    else weaknesses.push("llms.txt dosyası oluştur");
    if (ci.hasQuotableContent) { score += 15; strengths.push("Atıf alabilir pasajlar var"); }
    else weaknesses.push("Atıf alabilir net pasajlar ekle");
    if (ba.hasWikipedia) { score += 10; strengths.push("Wikipedia varlık sinyali"); }
    else weaknesses.push("Wikipedia / Wikidata varlık sinyali yok");
    if (ba.sameAsLinks.length > 3) { score += 10; strengths.push("Güçlü sameAs bağlantıları"); }
    else weaknesses.push("sameAs bağlantılarını güçlendir");
    if (sc.hasOrganization) { score += 10; strengths.push("Organization şeması mevcut"); }
    if (c.hasAuthorInfo) { score += 5; strengths.push("Yazar bilgisi mevcut"); }
    if (cr.crawlerRules["GPTBot"] && !cr.crawlerRules["GPTBot"].includes("Engellendi")) {
      score += 5; strengths.push("GPTBot erişimi açık");
    } else {
      weaknesses.push("GPTBot erişimi engelli");
    }
    return { score, strengths, weaknesses };
  });

  const perplexity = platform(() => {
    let score = 20;
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (ci.hasSummaryParagraphs) { score += 15; strengths.push("Özet paragraflar mevcut"); }
    if (ci.hasStats) { score += 15; strengths.push("İstatistik ve veri noktaları var"); }
    else weaknesses.push("Birincil kaynak niteliğinde veri ekle");
    if (ci.hasDefinitions) { score += 10; strengths.push("Tanım içeriği var"); }
    if (cr.crawlerRules["PerplexityBot"] && !cr.crawlerRules["PerplexityBot"].includes("Engellendi")) {
      score += 10; strengths.push("PerplexityBot erişimi açık");
    } else {
      weaknesses.push("PerplexityBot erişimi engelli");
    }
    if (c.externalLinks > 0) { score += 5; strengths.push("Dış kaynak referansları var"); }
    else weaknesses.push("Dış kaynak referansları ekle");
    if (ci.hasLlmsTxt) { score += 10; }
    if (c.hasTables) { score += 5; strengths.push("Tablo içeriği mevcut"); }
    weaknesses.push("Reddit / forum görünürlük stratejisi kur");
    return { score, strengths, weaknesses };
  });

  const gemini = platform(() => {
    let score = 20;
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    // Context-aware entity schema check
    const isLocalType = siteType === "local-business" || siteType === "medical";
    const isEcomType = siteType === "ecommerce";
    if (isLocalType) {
      if (sc.hasLocalBusiness) { score += 20; strengths.push("LocalBusiness şeması mevcut"); }
      else weaknesses.push("LocalBusiness şeması eksik — yerel görünürlük için ekle");
    } else if (isEcomType) {
      if (sc.hasProduct) { score += 20; strengths.push("Product şeması mevcut"); }
      else weaknesses.push("Product şeması eksik — ürün zengin sonuçları için ekle");
    } else {
      if (sc.hasOrganization) { score += 20; strengths.push("Organization şeması mevcut"); }
      else weaknesses.push("Organization şeması eksik");
    }
    if (!isLocalType && sc.hasOrganization) { score += 5; }
    if (ba.hasYouTube) { score += 10; strengths.push("YouTube kanalı bağlı"); }
    else weaknesses.push("YouTube / video kanıt katmanı oluştur");
    if (sc.hasPerson) { score += 10; strengths.push("Person şeması var"); }
    if (ba.socialProfileCount >= 3) { score += 10; strengths.push("Güçlü sosyal profil katmanı"); }
    if (sc.sameAsLinks.length > 3) { score += 10; }
    if (c.hasAuthorInfo) { score += 5; }
    if (sc.hasFAQPage) { score += 5; }
    return { score, strengths, weaknesses };
  });

  const bingCopilot = platform(() => {
    let score = 20;
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (Object.keys(t.ogTags).length > 0) { score += 15; strengths.push("Open Graph meta verileri var"); }
    else weaknesses.push("OG meta etiketleri ekle");
    if (t.metaDescriptionLength > 0) { score += 10; strengths.push("Meta description tanımlı"); }
    if (ba.hasLinkedIn) { score += 15; strengths.push("LinkedIn profili bağlı"); }
    else weaknesses.push("LinkedIn profilini sameAs'a ekle");
    if (sc.hasOrganization) { score += 10; strengths.push("Organization şeması mevcut"); }
    if (ci.hasQuotableContent) { score += 10; strengths.push("Net ve kaynaklı içerik blokları var"); }
    else weaknesses.push("Profesyonel, net ve kaynaklı içerik blokları artır");
    if (cr.crawlerRules["Bingbot"] && !cr.crawlerRules["Bingbot"].includes("Engellendi")) {
      score += 10; strengths.push("Bingbot erişimi açık");
    }
    if (sc.hasBreadcrumb) { score += 5; }
    if (Object.keys(t.twitterTags).length > 0) { score += 5; }
    return { score, strengths, weaknesses };
  });

  return { googleAIO, chatGPT, perplexity, gemini, bingCopilot };
}

// ─── Site Type Detection ─────────────────────────────────────────────

const SITE_TYPE_LABELS: Record<SiteType, string> = {
  "ecommerce": "E-Ticaret Sitesi",
  "local-business": "Yerel İşletme",
  "medical": "Sağlık / Tıp Sitesi",
  "blog": "Blog / Haber",
  "corporate": "Kurumsal Site",
  "saas": "SaaS / Yazılım",
  "portfolio": "Portfolyo / Kişisel",
  "news": "Haber Sitesi",
  "unknown": "Genel Site",
};

function detectSiteType(
  $: cheerio.CheerioAPI,
  html: string,
  sc: SchemaAudit,
  url: string
): SiteTypeInfo {
  const scores: Record<SiteType, { score: number; signals: string[] }> = {
    "ecommerce": { score: 0, signals: [] },
    "local-business": { score: 0, signals: [] },
    "medical": { score: 0, signals: [] },
    "blog": { score: 0, signals: [] },
    "corporate": { score: 0, signals: [] },
    "saas": { score: 0, signals: [] },
    "portfolio": { score: 0, signals: [] },
    "news": { score: 0, signals: [] },
    "unknown": { score: 5, signals: [] },
  };

  const lowerHtml = html.toLowerCase();
  const text = $("body").text().toLowerCase();

  // ── E-Commerce Signals ──
  if (sc.hasProduct) { scores.ecommerce.score += 30; scores.ecommerce.signals.push("Product şeması"); }
  if ($("[class*='cart'], [class*='basket'], [id*='cart'], [id*='basket'], [class*='sepet']").length > 0) {
    scores.ecommerce.score += 20; scores.ecommerce.signals.push("Sepet/cart elementi");
  }
  if (lowerHtml.includes("add-to-cart") || lowerHtml.includes("sepete-ekle") || lowerHtml.includes("addtocart")) {
    scores.ecommerce.score += 20; scores.ecommerce.signals.push("Sepete ekle butonu");
  }
  if (/woocommerce|shopify|magento|prestashop|opencart|ticimax|ikas|t-soft|ideasoft/i.test(lowerHtml)) {
    scores.ecommerce.score += 25; scores.ecommerce.signals.push("E-ticaret platformu tespit edildi");
  }
  if ($("[class*='price'], [class*='fiyat'], [itemprop='price']").length > 0) {
    scores.ecommerce.score += 15; scores.ecommerce.signals.push("Fiyat elementleri");
  }
  if (/₺|TL|USD|\$|€|price|fiyat/i.test(text) && $("[class*='product'], [class*='urun']").length > 0) {
    scores.ecommerce.score += 10; scores.ecommerce.signals.push("Ürün + fiyat kombinasyonu");
  }

  // ── Local Business Signals ──
  if (sc.hasLocalBusiness) { scores["local-business"].score += 30; scores["local-business"].signals.push("LocalBusiness şeması"); }
  if (/harita|map|directions|yol tarifi|adres|address/i.test(text) && /telefon|phone|\+90|0\d{3}/i.test(text)) {
    scores["local-business"].score += 15; scores["local-business"].signals.push("Adres + telefon bilgisi");
  }
  if ($("iframe[src*='google.com/maps'], iframe[src*='maps.google']").length > 0) {
    scores["local-business"].score += 20; scores["local-business"].signals.push("Google Maps embed");
  }
  if (/randevu|appointment|rezervasyon|booking/i.test(text)) {
    scores["local-business"].score += 10; scores["local-business"].signals.push("Randevu/rezervasyon sinyali");
  }

  // ── Medical Signals ──
  if (sc.hasMedicalSchema) { scores.medical.score += 35; scores.medical.signals.push("Tıbbi şema"); }
  if (/doktor|dr\.|physician|tedavi|treatment|hasta|patient|klinik|clinic|ameliyat|surgery|hastal[ıi]k|disease/i.test(text)) {
    scores.medical.score += 15; scores.medical.signals.push("Tıbbi terminoloji");
  }
  if (/diş|dental|ortopedi|kardiyoloji|dermatoloji|göz|kulak burun|estetik/i.test(text)) {
    scores.medical.score += 15; scores.medical.signals.push("Tıbbi uzmanlık alanı");
  }
  // Medical sites are often also local businesses
  if (scores.medical.score > 20) {
    scores["local-business"].score += 10;
  }

  // ── Blog / News Signals ──
  if (sc.hasArticle) { scores.blog.score += 20; scores.blog.signals.push("Article/BlogPosting şeması"); }
  if ($("article, [class*='post'], [class*='blog'], [class*='entry']").length > 3) {
    scores.blog.score += 15; scores.blog.signals.push("Birden fazla article/post elementi");
  }
  if (/wordpress|blogger|ghost|medium|substack/i.test(lowerHtml)) {
    scores.blog.score += 10; scores.blog.signals.push("Blog platformu");
  }
  if (/yorum|comment|disqus/i.test(lowerHtml)) {
    scores.blog.score += 5; scores.blog.signals.push("Yorum sistemi");
  }

  // ── News Signals ──
  if (/NewsArticle|NewsMediaOrganization/i.test(lowerHtml)) {
    scores.news.score += 30; scores.news.signals.push("Haber şeması");
  }
  if (/son dakika|breaking|haber|gazete|ajans/i.test(text)) {
    scores.news.score += 10; scores.news.signals.push("Haber terminolojisi");
  }

  // ── SaaS Signals ──
  if (/pricing|fiyatlandırma|free trial|ücretsiz dene|sign up|kayıt ol|saas|api|dashboard|plan/i.test(text)) {
    scores.saas.score += 20; scores.saas.signals.push("SaaS terminolojisi");
  }
  if (/SoftwareApplication|WebApplication/i.test(lowerHtml)) {
    scores.saas.score += 25; scores.saas.signals.push("Yazılım şeması");
  }

  // ── Corporate Signals ──
  if (sc.hasOrganization && !sc.hasProduct && !sc.hasLocalBusiness) {
    scores.corporate.score += 15; scores.corporate.signals.push("Organization şeması (ürün/yerel yok)");
  }
  if (/hakkımızda|about us|misyon|vizyon|kurumsal|corporate/i.test(text)) {
    scores.corporate.score += 10; scores.corporate.signals.push("Kurumsal terminoloji");
  }

  // ── Portfolio Signals ──
  if (/portfolio|projeler|çalışmalarım|works|gallery|galeri/i.test(text)) {
    scores.portfolio.score += 20; scores.portfolio.signals.push("Portfolyo terminolojisi");
  }

  // Find the winner
  let bestType: SiteType = "unknown";
  let bestScore = 0;
  for (const [type, data] of Object.entries(scores) as [SiteType, { score: number; signals: string[] }][]) {
    if (data.score > bestScore) {
      bestScore = data.score;
      bestType = type;
    }
  }

  const confidence = clamp(bestScore, 0, 100);
  return {
    type: bestType,
    confidence,
    signals: scores[bestType].signals,
    label: SITE_TYPE_LABELS[bestType],
  };
}

// ─── Context-Aware Schema Scoring ────────────────────────────────────

const SCHEMA_RELEVANCE: Record<SiteType, Record<string, number>> = {
  "ecommerce": { Organization: 15, WebSite: 10, WebPage: 5, Product: 20, BreadcrumbList: 10, Review: 15, FAQPage: 10, Offer: 10, HowTo: 5 },
  "local-business": { Organization: 10, WebSite: 10, LocalBusiness: 25, Review: 15, FAQPage: 15, BreadcrumbList: 10, Person: 5, HowTo: 5, WebPage: 5 },
  "medical": { Organization: 10, WebSite: 10, LocalBusiness: 15, MedicalSchema: 20, Person: 15, FAQPage: 10, Review: 10, BreadcrumbList: 5, WebPage: 5 },
  "blog": { Organization: 10, WebSite: 10, Article: 20, Person: 15, FAQPage: 10, BreadcrumbList: 10, HowTo: 10, WebPage: 10, Review: 5 },
  "corporate": { Organization: 20, WebSite: 15, WebPage: 10, BreadcrumbList: 10, Person: 10, FAQPage: 10, Review: 10, Article: 10, HowTo: 5 },
  "saas": { Organization: 15, WebSite: 10, SoftwareApplication: 20, FAQPage: 15, Review: 15, BreadcrumbList: 10, HowTo: 10, WebPage: 5 },
  "portfolio": { Person: 25, Organization: 10, WebSite: 10, WebPage: 10, Article: 15, BreadcrumbList: 10, Review: 10, HowTo: 5, FAQPage: 5 },
  "news": { Organization: 15, WebSite: 10, Article: 25, Person: 10, BreadcrumbList: 10, FAQPage: 10, WebPage: 10, Review: 5, HowTo: 5 },
  "unknown": { Organization: 15, WebSite: 10, WebPage: 10, Article: 10, FAQPage: 15, BreadcrumbList: 10, LocalBusiness: 10, Review: 10, HowTo: 5, Person: 5 },
};

// ─── Actions ────────────────────────────────────────────────────────

function generateActions(
  t: TechnicalAudit,
  c: ContentAudit,
  sc: SchemaAudit,
  ci: CitabilityAudit,
  cr: CrawlerAudit,
  ba: BrandAuthorityAudit,
  siteType: SiteType
): ActionItem[] {
  const actions: ActionItem[] = [];
  const is = (types: SiteType[]) => types.includes(siteType);

  // Technical — universal
  if (!t.ssl.valid) actions.push({ priority: "critical", category: "Teknik", title: "SSL Sertifikasını Düzelt", description: "SSL sertifikası geçersiz veya süresi dolmuş. Tüm arama motorları ve AI tarayıcıları siteye güvenmiyor." });
  if (t.titleLength === 0) actions.push({ priority: "critical", category: "Teknik", title: "Sayfa Başlığı Ekle", description: "Eksik <title> etiketi. SEO ve AI keşfedilebilirliği için zorunlu." });
  if (t.metaDescriptionLength === 0) actions.push({ priority: "critical", category: "Teknik", title: "Meta Description Ekle", description: "Eksik meta açıklama. Arama motorları ve AI içeriği anlamak için kullanır." });
  if (!t.hasCanonical) actions.push({ priority: "high", category: "Teknik", title: "Canonical URL Ekle", description: "Eksik canonical URL. Yinelenen içerik sorunlarını önler." });
  if (t.h1Count === 0) actions.push({ priority: "high", category: "İçerik", title: "H1 Başlık Ekle", description: "H1 başlık bulunamadı. Her sayfada tam olarak bir H1 olmalı." });
  if (t.h1Count > 1) actions.push({ priority: "medium", category: "İçerik", title: "Çoklu H1 Düzelt", description: `${t.h1Count} adet H1 bulundu. Sayfa başına tek H1 kullan.` });
  if (t.imgWithoutAlt > 0) actions.push({ priority: "medium", category: "Teknik", title: "Eksik Alt Etiketleri Ekle", description: `${t.imgWithoutAlt} görsel alt özniteliği eksik. Erişilebilirlik ve SEO için açıklayıcı alt metin ekle.` });
  if (Object.keys(t.ogTags).length === 0) actions.push({ priority: "high", category: "Teknik", title: "Open Graph Etiketleri Ekle", description: "Eksik OG meta etiketleri. Sosyal paylaşım ve AI platformları için gerekli." });
  if (Object.keys(t.twitterTags).length === 0) actions.push({ priority: "medium", category: "Teknik", title: "Twitter Card Etiketleri Ekle", description: "Sosyal paylaşım için Twitter Card meta etiketleri eksik." });
  if (!t.securityHeaders.hsts) actions.push({ priority: "medium", category: "Teknik", title: "HSTS Başlığı Ekle", description: "Strict-Transport-Security başlığı eksik. HTTPS bağlantılarını zorunlu kılar." });
  if (t.securityHeaders.xPoweredBy) actions.push({ priority: "medium", category: "Teknik", title: "X-Powered-By Başlığını Kaldır", description: `Sunucu "${t.securityHeaders.xPoweredBy}" bilgisini ifşa ediyor.` });
  if (t.pageSize > 500000) actions.push({ priority: "medium", category: "Teknik", title: "Sayfa Boyutunu Küçült", description: `Sayfa ${(t.pageSize / 1024).toFixed(0)}KB. HTML, CSS/JS'yi optimize et.` });

  // Schema — context-aware
  if (!sc.hasOrganization) actions.push({ priority: "high", category: "Yapısal Veri", title: "Organization Şeması Ekle", description: "Eksik Organization yapısal veri. Marka varlığı tanınırlığı için kritik." });
  if (!sc.hasFAQPage && c.hasFAQ) actions.push({ priority: "high", category: "Yapısal Veri", title: "FAQPage Şeması Ekle", description: "SSS içeriği bulundu ama FAQPage şeması yok. Zengin sonuçları etkinleştirir." });

  // LocalBusiness — ONLY for local-business and medical sites
  if (!sc.hasLocalBusiness && is(["local-business", "medical"])) {
    actions.push({ priority: "high", category: "Yapısal Veri", title: "LocalBusiness Şeması Ekle", description: "Yerel işletme şeması yok. Fiziksel konum bilgisi, çalışma saatleri ve iletişim verisi Google Haritalar ve Gemini için kritik." });
  }

  // Product — for ecommerce sites
  if (!sc.hasProduct && is(["ecommerce"])) {
    actions.push({ priority: "critical", category: "Yapısal Veri", title: "Product Şeması Ekle", description: "Ürün yapısal verisi eksik. E-ticaret siteleri için Product şeması (name, price, availability, review) Google alışveriş sonuçları ve AI arama için zorunlu." });
  }
  if (!sc.hasReview && is(["ecommerce"])) {
    actions.push({ priority: "high", category: "Yapısal Veri", title: "Ürün Değerlendirme Şeması Ekle", description: "Review/AggregateRating eksik. Ürün puanları arama sonuçlarında yıldız gösterir, AI modellerinin güvenilirlik değerlendirmesini etkiler." });
  }

  // Article — for blog/news sites
  if (!sc.hasArticle && is(["blog", "news"])) {
    actions.push({ priority: "high", category: "Yapısal Veri", title: "Article Şeması Ekle", description: "Blog/haber içerikleri için Article şeması (headline, author, datePublished) ekleyin. AI modelleri yazı kalitesini ve güncelliğini buradan okur." });
  }

  // Person — for blog, medical, portfolio
  if (!sc.hasPerson && is(["blog", "medical", "portfolio"])) {
    actions.push({ priority: "high", category: "Yapısal Veri", title: "Person Şeması Ekle", description: "Yazar/uzman bilgisi yapısal verisi eksik. E-E-A-T sinyali olarak AI modelleri kişi bilgisini kullanır." });
  }

  // Medical-specific schemas
  if (!sc.hasMedicalSchema && is(["medical"])) {
    actions.push({ priority: "high", category: "Yapısal Veri", title: "Tıbbi Şema Ekle", description: "MedicalClinic, Physician veya MedicalWebPage şeması ekleyin. Google sağlık panellerinde görünürlük sağlar." });
  }

  // SaaS-specific
  if (is(["saas"]) && !sc.schemas.some(s => /SoftwareApplication|WebApplication/i.test(s.type))) {
    actions.push({ priority: "high", category: "Yapısal Veri", title: "SoftwareApplication Şeması Ekle", description: "Yazılım ürünü yapısal verisi eksik. AI modelleri yazılım karşılaştırma sorgularında bu şemayı kullanır." });
  }

  // E-commerce specific actions
  if (is(["ecommerce"])) {
    if (!sc.hasBreadcrumb) actions.push({ priority: "high", category: "Yapısal Veri", title: "BreadcrumbList Şeması Ekle", description: "E-ticarette breadcrumb ürün kategorisi hiyerarşisini netleştirir. Arama sonuçlarında kategori yolu gösterir." });
    if (!c.hasFAQ) actions.push({ priority: "medium", category: "İçerik", title: "Ürün SSS Bölümü Ekle", description: "Ürün sayfalarına Sık Sorulan Sorular ekleyin. AI Overviews ürün sorularını buradan yanıtlar." });
  } else {
    if (!sc.hasBreadcrumb) actions.push({ priority: "medium", category: "Yapısal Veri", title: "BreadcrumbList Şeması Ekle", description: "Breadcrumb yapısal verisi eksik. Sayfa hiyerarşisini netleştirir." });
  }

  // Review — for non-ecommerce (ecommerce handled above)
  if (!sc.hasReview && !is(["ecommerce"]) && is(["local-business", "medical", "saas"])) {
    actions.push({ priority: "medium", category: "Yapısal Veri", title: "Review Şeması Ekle", description: "Müşteri/hasta değerlendirme yapısal verisi bulunamadı. Güvenilirlik sinyali olarak AI modelleri tarafından kullanılır." });
  }

  // Citability
  if (!ci.hasLlmsTxt) actions.push({ priority: "high", category: "AI Atıf", title: "llms.txt Dosyası Oluştur", description: "llms.txt bulunamadı. AI modellerinin site yapısını anlamasına yardımcı olur." });
  if (ci.hasLlmsTxt && ci.llmsTxtContent.includes("My WordPress Blog")) actions.push({ priority: "medium", category: "AI Atıf", title: "llms.txt İçeriğini Özelleştir", description: "llms.txt varsayılan içerik barındırıyor. Marka, hizmet ve uzmanlık bilgisi ekle." });
  if (!ci.hasDefinitions) actions.push({ priority: "medium", category: "AI Atıf", title: "Tanım İçeriği Ekle", description: "Tanım tarzı içerik eksik. AI'ın alıntılayabileceği 'X nedir?' tarzı paragraflar ekle." });
  if (!ci.hasStats) actions.push({ priority: "medium", category: "AI Atıf", title: "İstatistik ve Sayısal Veri Ekle", description: "İçerikte sayısal veri eksik. AI modelleri somut istatistik içeren içerikleri tercih eder." });
  if (ci.answerBlockCount < 3) actions.push({ priority: "medium", category: "AI Atıf", title: "Cevap Bloğu Formatını Standartlaştır", description: "H2/H3 altına 40-80 kelimelik net yanıt blokları, veri noktası ve mini tablo ekle." });
  if (!ci.hasTables) actions.push({ priority: "low", category: "AI Atıf", title: "Karşılaştırma Tabloları Ekle", description: is(["ecommerce"]) ? "Ürün karşılaştırma tablosu ekle. AI Overviews e-ticaret sorgularında tablo formatını tercih eder." : "Tablo bulunamadı. Tablolar AI Overviews ve Perplexity tarafından yoğun atıf alır." });

  // Crawler
  if (!cr.hasSitemap) actions.push({ priority: "high", category: "Tarayıcı", title: "XML Sitemap Ekle", description: "Sitemap bulunamadı. Oluştur ve robots.txt'de referans ver." });
  if (cr.blockedBots > 0) actions.push({ priority: "high", category: "Tarayıcı", title: "Engellenen AI Botlarını Aç", description: `${cr.blockedBots} AI botu engellendi. AI görünürlüğü için erişimi aç.` });

  // Brand Authority
  if (!ba.hasWikipedia) actions.push({ priority: "medium", category: "Marka Otoritesi", title: "Wikipedia Varlık Sinyali Oluştur", description: "Wikipedia varlık sinyali yok. AI modelleri varlık tanıma için Wikipedia'yı kullanır." });
  if (ba.socialProfileCount < 3) actions.push({ priority: "medium", category: "Marka Otoritesi", title: "Sosyal Profil Katmanını Genişlet", description: "sameAs bağlantıları, LinkedIn / YouTube / Reddit profilleri ile varlık netliğini artır." });
  if (!ba.hasLinkedIn) actions.push({ priority: "low", category: "Marka Otoritesi", title: "LinkedIn Profili Bağla", description: "LinkedIn profili sameAs'a eklenmemiş. Bing Copilot için önemli." });

  return actions.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  });
}

// ─── Main Audit Function ────────────────────────────────────────────

export async function runAudit(url: string): Promise<AuditResult> {
  const start = Date.now();
  let res: Response;
  try {
    res = await safeFetch(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    throw new Error(`${url} adresine ulaşılamıyor: ${msg}`);
  }
  const responseTime = Date.now() - start;

  if (!res.ok)
    throw new Error(
      `${url} adresinden HTTP ${res.status} hatası döndü.`
    );

  const html = await res.text();
  const headers = res.headers;
  const $ = cheerio.load(html);
  const hostname = new URL(url).hostname;

  const [technical, content, schema, citability, crawlerAccess] =
    await Promise.all([
      auditTechnical(url, $, headers, responseTime, html),
      Promise.resolve(auditContent(html, hostname)),
      Promise.resolve(auditSchema($)),
      auditCitability(url, html),
      auditCrawlerAccess(url),
    ]);

  const brandAuthority = auditBrandAuthority($, schema.sameAsLinks);
  const siteType = detectSiteType($, html, schema, url);
  const platforms = scorePlatforms(
    technical, content, schema, citability, crawlerAccess, brandAuthority, siteType.type
  );

  const scores = {
    technical: scoreTechnical(technical),
    content: scoreContent(content),
    schema: scoreSchema(schema, siteType.type),
    citability: scoreCitability(citability),
    crawlerAccess: scoreCrawlerAccess(crawlerAccess),
    brandAuthority: scoreBrandAuthority(brandAuthority),
    platform: Math.round(
      (platforms.googleAIO.score +
        platforms.chatGPT.score +
        platforms.perplexity.score +
        platforms.gemini.score +
        platforms.bingCopilot.score) /
        5
    ),
    overall: 0,
  };

  scores.overall = Math.round(
    scores.technical * 0.2 +
      scores.content * 0.15 +
      scores.schema * 0.15 +
      scores.citability * 0.15 +
      scores.crawlerAccess * 0.1 +
      scores.brandAuthority * 0.1 +
      scores.platform * 0.15
  );

  const actions = generateActions(
    technical, content, schema, citability, crawlerAccess, brandAuthority, siteType.type
  );

  return {
    url,
    timestamp: new Date().toISOString(),
    siteType,
    scores,
    technical,
    content,
    schema,
    citability,
    crawlerAccess,
    brandAuthority,
    platforms,
    actions,
  };
}
