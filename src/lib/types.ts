export type SiteType =
  | "ecommerce"
  | "local-business"
  | "medical"
  | "blog"
  | "corporate"
  | "saas"
  | "portfolio"
  | "news"
  | "unknown";

export interface SiteTypeInfo {
  type: SiteType;
  confidence: number;
  signals: string[];
  label: string;
}

export interface AIRecommendation {
  title: string;
  description: string;
  category: string;
  impact: "high" | "medium" | "low";
  effort: "easy" | "medium" | "hard";
  steps: string[];
}

export interface AuditResult {
  url: string;
  timestamp: string;
  siteType: SiteTypeInfo;
  scores: {
    technical: number;
    content: number;
    schema: number;
    citability: number;
    crawlerAccess: number;
    brandAuthority: number;
    platform: number;
    overall: number;
  };
  technical: TechnicalAudit;
  content: ContentAudit;
  schema: SchemaAudit;
  citability: CitabilityAudit;
  crawlerAccess: CrawlerAudit;
  brandAuthority: BrandAuthorityAudit;
  platforms: PlatformScores;
  actions: ActionItem[];
  aiRecommendations?: AIRecommendation[];
}

export interface TechnicalAudit {
  ssl: { valid: boolean; error?: string };
  httpVersion: string;
  server: string;
  responseTime: number;
  pageSize: number;
  title: string;
  titleLength: number;
  metaDescription: string;
  metaDescriptionLength: number;
  canonical: string;
  hasCanonical: boolean;
  robotsMeta: string;
  ogTags: Record<string, string>;
  twitterTags: Record<string, string>;
  h1Count: number;
  h2Count: number;
  h3Count: number;
  imgCount: number;
  imgWithoutAlt: number;
  securityHeaders: {
    hsts: boolean;
    xFrameOptions: boolean;
    contentSecurityPolicy: boolean;
    xContentTypeOptions: boolean;
    permissionsPolicy: boolean;
    xPoweredBy: string | null;
  };
  cacheControl: string;
}

export interface ContentAudit {
  wordCount: number;
  headings: string[];
  hasH1: boolean;
  internalLinks: number;
  externalLinks: number;
  hasStructuredContent: boolean;
  hasFAQ: boolean;
  hasTables: boolean;
  hasLists: boolean;
  hasAuthorInfo: boolean;
  hasDateInfo: boolean;
  languageSignals: string[];
}

export interface SchemaAudit {
  schemas: SchemaItem[];
  hasOrganization: boolean;
  hasWebSite: boolean;
  hasWebPage: boolean;
  hasArticle: boolean;
  hasFAQPage: boolean;
  hasBreadcrumb: boolean;
  hasLocalBusiness: boolean;
  hasProduct: boolean;
  hasReview: boolean;
  hasHowTo: boolean;
  hasPerson: boolean;
  hasMedicalSchema: boolean;
  sameAsLinks: string[];
}

export interface SchemaItem {
  type: string;
  properties: string[];
}

export interface CitabilityAudit {
  hasLlmsTxt: boolean;
  llmsTxtContent: string;
  hasSummaryParagraphs: boolean;
  hasDefinitions: boolean;
  hasStats: boolean;
  hasTables: boolean;
  hasQuotableContent: boolean;
  answerBlockCount: number;
  avgParagraphLength: number;
}

export interface CrawlerAudit {
  robotsTxt: string;
  hasSitemap: boolean;
  sitemapUrl: string;
  crawlerRules: Record<string, string>;
  allowedBots: number;
  blockedBots: number;
}

export interface BrandAuthorityAudit {
  sameAsLinks: string[];
  hasFacebook: boolean;
  hasTwitter: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
  hasYouTube: boolean;
  hasWikipedia: boolean;
  socialProfileCount: number;
  brandMentionSignals: string[];
}

export interface PlatformScores {
  googleAIO: PlatformDetail;
  chatGPT: PlatformDetail;
  perplexity: PlatformDetail;
  gemini: PlatformDetail;
  bingCopilot: PlatformDetail;
}

export interface PlatformDetail {
  score: number;
  strengths: string[];
  weaknesses: string[];
}

export interface ActionItem {
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
}

// ─── Gullanbot: Full-Site Crawl Types ────────────────────────────────

export interface PageSummary {
  url: string;
  status: "success" | "error" | "skipped";
  statusCode?: number;
  error?: string;
  title: string;
  wordCount: number;
  h1Count: number;
  imgCount: number;
  imgWithoutAlt: number;
  hasCanonical: boolean;
  hasMeta: boolean;
  hasOG: boolean;
  schemaTypes: string[];
  internalLinks: number;
  externalLinks: number;
  responseTime: number;
  pageSize: number;
  score: number;
  issues: string[];
}

export interface CrawlProgress {
  phase: "sitemap" | "crawling" | "auditing" | "done" | "error";
  discovered: number;
  crawled: number;
  total: number;
  currentUrl?: string;
  message?: string;
}

export interface FullSiteAudit {
  url: string;
  timestamp: string;
  siteType: SiteTypeInfo;
  crawlStats: {
    totalPages: number;
    crawledPages: number;
    errorPages: number;
    skippedPages: number;
    totalTime: number;
    avgResponseTime: number;
    avgPageSize: number;
    avgScore: number;
  };
  siteWideIssues: SiteWideIssue[];
  pages: PageSummary[];
  homepageAudit: AuditResult;
  scores: {
    technical: number;
    content: number;
    schema: number;
    citability: number;
    crawlerAccess: number;
    brandAuthority: number;
    platform: number;
    overall: number;
  };
  actions: ActionItem[];
  aiRecommendations?: AIRecommendation[];
}

export interface SiteWideIssue {
  type: "missing-title" | "missing-meta" | "missing-h1" | "missing-alt" | "missing-canonical" | "missing-og" | "missing-schema" | "slow-page" | "large-page" | "duplicate-title" | "duplicate-meta";
  severity: "critical" | "high" | "medium" | "low";
  count: number;
  total: number;
  percentage: number;
  affectedUrls: string[];
  title: string;
  description: string;
}
