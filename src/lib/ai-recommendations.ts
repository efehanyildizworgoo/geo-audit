import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AuditResult, AIRecommendation } from "./types";

const SYSTEM_PROMPT = `GEO uzmanısın. Site denetim verilerine göre AI aramalarda görünürlüğü artıracak 5 öneri üret. Türkçe yaz. Kısa ve öz tut. Site türüne uygun öner. SADECE JSON döndür:
{"recommendations":[{"title":"...","description":"...","category":"Yapısal Veri|İçerik|Teknik|AI Atıf|Tarayıcı|Marka","impact":"high|medium|low","effort":"easy|medium|hard","steps":["1","2","3"]}]}`;

export async function generateAIRecommendations(
  audit: AuditResult
): Promise<AIRecommendation[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("[AI] GEMINI_API_KEY not set, skipping recommendations");
    return [];
  }

  console.log("[AI] Generating Gemini recommendations for", audit.url);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        // @ts-expect-error - thinkingConfig not yet in types but supported by API
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const siteContext = buildSiteContext(audit);
    const result = await model.generateContent([
      SYSTEM_PROMPT + "\n\n" + siteContext,
    ]);

    const content = result.response.text();
    console.log("[AI] Gemini raw response length:", content?.length, "first 500 chars:", content?.substring(0, 500));
    if (!content) return [];

    // Handle potentially truncated JSON from Gemini
    let jsonStr = content.trim();
    // Try to fix truncated JSON by closing open arrays/objects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Attempt to salvage truncated JSON
      const lastComplete = jsonStr.lastIndexOf("}");
      if (lastComplete > 0) {
        jsonStr = jsonStr.substring(0, lastComplete + 1);
        // Close any unclosed arrays
        const openBrackets = (jsonStr.match(/\[/g) || []).length - (jsonStr.match(/\]/g) || []).length;
        const openBraces = (jsonStr.match(/\{/g) || []).length - (jsonStr.match(/\}/g) || []).length;
        jsonStr += "]".repeat(Math.max(0, openBrackets)) + "}".repeat(Math.max(0, openBraces));
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          console.error("[AI] Could not parse Gemini response even after fix attempt");
          return [];
        }
      } else {
        console.error("[AI] Gemini returned invalid JSON");
        return [];
      }
    }
    const recs: AIRecommendation[] = (parsed.recommendations || []).map(
      (r: Record<string, unknown>) => ({
        title: String(r.title || ""),
        description: String(r.description || ""),
        category: String(r.category || "Genel"),
        impact: validateImpact(r.impact),
        effort: validateEffort(r.effort),
        steps: Array.isArray(r.steps)
          ? r.steps.map((s: unknown) => String(s))
          : [],
      })
    );

    console.log("[AI] Generated", recs.length, "recommendations");
    return recs.slice(0, 5);
  } catch (error: unknown) {
    console.error("[AI] Gemini recommendation error:", error);
    return [];
  }
}

function validateImpact(v: unknown): "high" | "medium" | "low" {
  if (v === "high" || v === "medium" || v === "low") return v;
  return "medium";
}

function validateEffort(v: unknown): "easy" | "medium" | "hard" {
  if (v === "easy" || v === "medium" || v === "hard") return v;
  return "medium";
}

function buildSiteContext(audit: AuditResult): string {
  const s = audit.scores;
  const st = audit.siteType;

  return `## Site Denetim Özeti

URL: ${audit.url}
Site Türü: ${st.label} (${st.type}, güven: %${st.confidence})
Tespit Sinyalleri: ${st.signals.join(", ")}

## Skorlar (0-100)
- Genel: ${s.overall}
- Teknik SEO: ${s.technical}
- İçerik Kalitesi: ${s.content}
- Yapısal Veri (Schema): ${s.schema}
- AI Atıf Uygunluğu: ${s.citability}
- Tarayıcı Erişimi: ${s.crawlerAccess}
- Marka Otoritesi: ${s.brandAuthority}
- Platform Hazırlığı: ${s.platform}

## Teknik Detaylar
- SSL: ${audit.technical.ssl.valid ? "Geçerli" : "SORUNLU"}
- Yanıt süresi: ${audit.technical.responseTime}ms
- Sayfa boyutu: ${(audit.technical.pageSize / 1024).toFixed(0)}KB
- H1 sayısı: ${audit.technical.h1Count}
- Alt eksik görsel: ${audit.technical.imgWithoutAlt}/${audit.technical.imgCount}
- OG etiket: ${Object.keys(audit.technical.ogTags).length > 0 ? "Var" : "Yok"}

## İçerik
- Kelime sayısı: ${audit.content.wordCount}
- Başlık sayısı: ${audit.content.headings.length}
- İç bağlantı: ${audit.content.internalLinks}
- Dış bağlantı: ${audit.content.externalLinks}
- SSS: ${audit.content.hasFAQ ? "Var" : "Yok"}
- Tablo: ${audit.content.hasTables ? "Var" : "Yok"}
- Yazar bilgisi: ${audit.content.hasAuthorInfo ? "Var" : "Yok"}

## Yapısal Veri
- Organization: ${audit.schema.hasOrganization ? "✓" : "✗"}
- WebSite: ${audit.schema.hasWebSite ? "✓" : "✗"}
- Product: ${audit.schema.hasProduct ? "✓" : "✗"}
- LocalBusiness: ${audit.schema.hasLocalBusiness ? "✓" : "✗"}
- FAQPage: ${audit.schema.hasFAQPage ? "✓" : "✗"}
- Article: ${audit.schema.hasArticle ? "✓" : "✗"}
- Review: ${audit.schema.hasReview ? "✓" : "✗"}
- Person: ${audit.schema.hasPerson ? "✓" : "✗"}
- BreadcrumbList: ${audit.schema.hasBreadcrumb ? "✓" : "✗"}
- Tıbbi Şema: ${audit.schema.hasMedicalSchema ? "✓" : "✗"}
- Tespit edilen şemalar: ${audit.schema.schemas.map((s) => s.type).join(", ") || "Yok"}

## AI Atıf
- llms.txt: ${audit.citability.hasLlmsTxt ? "Var" : "Yok"}
- Tanım içeriği: ${audit.citability.hasDefinitions ? "Var" : "Yok"}
- İstatistik: ${audit.citability.hasStats ? "Var" : "Yok"}
- Cevap blokları: ${audit.citability.answerBlockCount}
- Ort. paragraf uzunluğu: ${audit.citability.avgParagraphLength} kelime

## Tarayıcı Erişimi
- İzin verilen AI botları: ${audit.crawlerAccess.allowedBots}
- Engellenen AI botları: ${audit.crawlerAccess.blockedBots}
- Sitemap: ${audit.crawlerAccess.hasSitemap ? "Var" : "Yok"}

## Marka Otoritesi
- Sosyal profil sayısı: ${audit.brandAuthority.socialProfileCount}
- Wikipedia: ${audit.brandAuthority.hasWikipedia ? "Var" : "Yok"}
- sameAs bağlantısı: ${audit.brandAuthority.sameAsLinks.length}

Bu siteye özel, site türüne (${st.label}) uygun, en etkili 5 GEO optimizasyon önerisi üret.`;
}
