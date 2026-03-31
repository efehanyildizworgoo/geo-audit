"use client";

import type { AuditResult } from "@/lib/types";
import {
  Shield, FileText, Code, Bot, Globe, Users,
  CheckCircle2, XCircle, HelpCircle,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function Check({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
  ) : (
    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
  );
}

function Row({
  label,
  value,
  check,
  guide,
  hint,
}: {
  label: string;
  value?: string;
  check?: boolean;
  guide?: string;
  hint?: string;
}) {
  const showHint = check === false && hint;
  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center justify-between py-1.5">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          {label}
          {guide && (
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-muted-foreground/50 hover:text-primary cursor-help transition-colors" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                {guide}
              </TooltipContent>
            </Tooltip>
          )}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          {check !== undefined && <Check ok={check} />}
          {value && (
            <span className="max-w-[300px] truncate text-right">{value}</span>
          )}
        </span>
      </div>
      {showHint && (
        <div className="pb-2 -mt-0.5">
          <p className="text-[10px] leading-relaxed text-amber-400/90 bg-amber-500/5 border border-amber-500/10 rounded-md px-2.5 py-1.5">
            💡 {hint}
          </p>
        </div>
      )}
    </div>
  );
}

export function DetailSections({ data }: { data: AuditResult }) {
  const t = data.technical;
  const c = data.content;
  const sc = data.schema;
  const ci = data.citability;
  const cr = data.crawlerAccess;
  const ba = data.brandAuthority;
  const st = data.siteType.type;
  const isLocal = st === "local-business" || st === "medical";
  const isEcom = st === "ecommerce";

  return (
    <Accordion
      type="multiple"
      defaultValue={["technical", "content", "schema", "citability", "crawler", "brand"]}
      className="space-y-2"
    >
      {/* Technical */}
      <AccordionItem value="technical" className="rounded-lg border border-border bg-card px-4">
        <AccordionTrigger className="py-3 hover:no-underline">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Shield className="w-4 h-4 text-primary" />
            Teknik SEO
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {data.scores.technical}/100
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <Row label="SSL Sertifikası" check={t.ssl.valid} value={t.ssl.valid ? "Geçerli" : t.ssl.error || "Geçersiz"}
            guide="HTTPS bağlantısının aktif ve sertifikanın geçerli olup olmadığını kontrol eder. Let's Encrypt ile ücretsiz sertifika alabilirsiniz."
            hint="Hosting panelinizden (cPanel, Plesk vb.) SSL sertifikasını etkinleştirin veya Cloudflare gibi bir CDN üzerinden otomatik SSL kullanın."
          />
          <Row label="Başlık" value={`${t.title} (${t.titleLength} kr)`} check={t.titleLength > 0 && t.titleLength <= 60}
            guide="Sayfa başlığı (<title>) 30-60 karakter arası olmalı. AI modelleri ve arama motorları bu etiketi öncelikli olarak kullanır."
            hint={t.titleLength === 0 ? "WordPress: Yoast SEO → Sayfa düzenle → SEO başlığını girin. Diğer: <title> etiketini <head> içine ekleyin." : t.titleLength > 60 ? `Başlık ${t.titleLength} karakter — 60 karaktere düşürün. Fazla uzun başlıklar arama sonuçlarında kesilir.` : undefined}
          />
          <Row label="Meta Açıklama" value={`${t.metaDescription.slice(0, 60)}… (${t.metaDescriptionLength} kr)`} check={t.metaDescriptionLength > 0 && t.metaDescriptionLength <= 160}
            guide="Meta açıklama 120-160 karakter arası, sayfanın ne hakkında olduğunu özetlemeli. AI Overviews snippet seçiminde etkili."
            hint={t.metaDescriptionLength === 0 ? "WordPress: Yoast SEO → Sayfa düzenle → Meta açıklama alanını doldurun. HTML: <meta name='description' content='...'> ekleyin." : t.metaDescriptionLength > 160 ? `Açıklama ${t.metaDescriptionLength} karakter — 160'a kısaltın.` : undefined}
          />
          <Row label="Canonical" check={t.hasCanonical} value={t.canonical || "—"}
            guide="Canonical URL, sayfanın birincil adresini belirtir. Yinelenen içerik sorunlarını önler."
            hint="<head> içine <link rel='canonical' href='https://siteniz.com/sayfa'> ekleyin. WordPress: Yoast SEO otomatik ekler, kontrol edin."
          />
          <Row label="Robots Meta" value={t.robotsMeta || "—"}
            guide="Robots meta etiketi, arama motorlarına sayfayı indeksleyip indekslemeyeceğini söyler. 'index, follow' ideal değerdir."
          />
          <Row label="Sunucu" value={t.server}
            guide="Web sunucusu türü. Performans ve güvenlik açısından güncel tutulmalıdır."
          />
          <Row label="Yanıt Süresi" value={`${t.responseTime}ms`} check={t.responseTime < 2000}
            guide="Sunucunun ilk yanıt süresi (TTFB). 500ms altı ideal, 2000ms üstü kritik."
            hint={t.responseTime >= 2000 ? "Sunucu önbelleği (Redis, Varnish), CDN (Cloudflare) veya daha güçlü bir hosting planı ile iyileştirin." : undefined}
          />
          <Row label="Sayfa Boyutu" value={`${(t.pageSize / 1024).toFixed(0)} KB`} check={t.pageSize < 500000}
            guide="Toplam HTML boyutu. 500KB altı ideal. Büyük sayfalar yavaş yüklenir ve tarayıcıları zorlar."
            hint={t.pageSize >= 500000 ? "Kullanılmayan CSS/JS'yi kaldırın, görselleri lazy-load yapın, HTML'i minify edin. WordPress: Autoptimize veya WP Rocket kullanın." : undefined}
          />
          <Row label="H1 / H2 / H3" value={`${t.h1Count} / ${t.h2Count} / ${t.h3Count}`} check={t.h1Count === 1}
            guide="Her sayfada tam olarak 1 adet H1 olmalı. H2-H3'ler alt konuları hiyerarşik olarak yapılandırır."
            hint={t.h1Count === 0 ? "Sayfaya bir ana başlık (<h1>) ekleyin. Genellikle sayfa en üstündeki başlık H1 olmalıdır." : t.h1Count > 1 ? `${t.h1Count} adet H1 var — yalnızca ana başlığı H1 bırakın, diğerlerini H2'ye çevirin.` : undefined}
          />
          <Row label="Alt Etiketi Eksik Görseller" value={`${t.imgWithoutAlt} / ${t.imgCount}`} check={t.imgWithoutAlt === 0}
            guide="Alt (alternatif metin) etiketi, görselin ne olduğunu açıklar. Erişilebilirlik, SEO ve AI görsel tanıma için kritik."
            hint={t.imgWithoutAlt > 0 ? `${t.imgWithoutAlt} görselde alt etiketi eksik. Her görsele açıklayıcı alt metin ekleyin. WordPress: Medya kütüphanesinden görsel → 'Alternatif metin' alanını doldurun.` : undefined}
          />
          <Row label="Open Graph" check={Object.keys(t.ogTags).length > 0} value={`${Object.keys(t.ogTags).length} etiket`}
            guide="Open Graph (og:) etiketleri sosyal medya paylaşımlarında başlık, görsel ve açıklama belirler. AI platformları da kullanır."
            hint="<head> içine og:title, og:description, og:image, og:url etiketlerini ekleyin. WordPress: Yoast SEO → Sosyal sekmesinden ayarlayın."
          />
          <Row label="Twitter Card" check={Object.keys(t.twitterTags).length > 0} value={`${Object.keys(t.twitterTags).length} etiket`}
            guide="Twitter Card meta etiketleri, X/Twitter'da paylaşım önizlemesini kontrol eder."
            hint="<meta name='twitter:card' content='summary_large_image'>, twitter:title ve twitter:image etiketlerini ekleyin."
          />
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">
              Güvenlik Başlıkları
            </p>
            <Row label="HSTS" check={t.securityHeaders.hsts}
              guide="HTTP Strict Transport Security — tarayıcıları her zaman HTTPS kullanmaya zorlar."
              hint="Sunucu ayarlarınıza 'Strict-Transport-Security: max-age=31536000; includeSubDomains' başlığını ekleyin. Cloudflare: SSL/TLS → Edge Certificates → HSTS etkinleştirin."
            />
            <Row label="X-Frame-Options" check={t.securityHeaders.xFrameOptions}
              guide="Sitenizin iframe içinde gösterilmesini engeller, clickjacking saldırılarını önler."
              hint="Sunucu ayarlarına 'X-Frame-Options: SAMEORIGIN' ekleyin. Nginx: add_header X-Frame-Options SAMEORIGIN;"
            />
            <Row label="Content-Security-Policy" check={t.securityHeaders.contentSecurityPolicy}
              guide="CSP, hangi kaynakların yüklenebileceğini belirler. XSS saldırılarını büyük ölçüde önler."
              hint="Temel CSP başlangıcı: Content-Security-Policy: default-src 'self'; script-src 'self'. report-uri ile test edin."
            />
            <Row label="X-Content-Type-Options" check={t.securityHeaders.xContentTypeOptions}
              guide="MIME type sniffing'i engeller, güvenlik açıklarını azaltır."
              hint="'X-Content-Type-Options: nosniff' başlığını sunucu yapılandırmanıza ekleyin."
            />
            <Row label="X-Powered-By" check={!t.securityHeaders.xPoweredBy} value={t.securityHeaders.xPoweredBy || "Gizli"}
              guide="Sunucu teknolojisini ifşa eder (PHP, Express vb.). Saldırganların hedefli exploit denemesini kolaylaştırır."
              hint={t.securityHeaders.xPoweredBy ? `'${t.securityHeaders.xPoweredBy}' bilgisi görünüyor. PHP: php.ini'de expose_php = Off. Express: app.disable('x-powered-by'). Nginx: proxy_hide_header X-Powered-By;` : undefined}
            />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Content */}
      <AccordionItem value="content" className="rounded-lg border border-border bg-card px-4">
        <AccordionTrigger className="py-3 hover:no-underline">
          <div className="flex items-center gap-2 text-sm font-bold">
            <FileText className="w-4 h-4 text-primary" />
            İçerik Kalitesi & E-E-A-T
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {data.scores.content}/100
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <Row label="Kelime Sayısı" value={`${c.wordCount.toLocaleString("tr-TR")} kelime`} check={c.wordCount > 300}
            guide="AI modelleri uzun, kapsamlı içerikleri tercih eder. Ana sayfalar için 300+, blog yazıları için 800+ kelime hedefleyin."
            hint={c.wordCount <= 300 ? "Sayfaya daha fazla açıklayıcı metin ekleyin. Hizmetlerinizi, SSS bölümü, vaka çalışmaları ve uzmanlık alanlarınızı detaylandırın." : undefined}
          />
          <Row label="H1 Başlık" check={c.hasH1}
            guide="H1, sayfanın ana konusunu belirler. Hem kullanıcılar hem de AI modelleri için önemli."
            hint="Sayfanın en başına konuyu özetleyen tek bir <h1> etiketi ekleyin."
          />
          <Row label="Başlıklar" value={`${c.headings.length} adet`} check={c.headings.length > 3}
            guide="Başlık sayısı içeriğin yapısal derinliğini gösterir. 4+ başlık AI'nın konuyu daha iyi anlamasını sağlar."
            hint={c.headings.length <= 3 ? "İçeriği H2 ve H3 başlıklarla alt bölümlere ayırın. Her hizmet veya konu için ayrı başlık kullanın." : undefined}
          />
          <Row label="İç Bağlantılar" value={`${c.internalLinks}`} check={c.internalLinks > 5}
            guide="İç bağlantılar, site yapısını ve sayfa ilişkilerini arama motorlarına anlatır. 5+ ideal."
            hint={c.internalLinks <= 5 ? "İlgili hizmet sayfalarına, blog yazılarına ve iletişim sayfasına iç bağlantılar ekleyin." : undefined}
          />
          <Row label="Dış Bağlantılar" value={`${c.externalLinks}`} check={c.externalLinks > 0}
            guide="Otoriter dış kaynaklara verilen bağlantılar güvenilirliği artırır. Perplexity ve ChatGPT kaynak referanslarına değer verir."
            hint="Tıbbi yayınlar, resmi kurumlar veya sektör otoriteleri gibi güvenilir dış kaynaklara referans bağlantıları ekleyin."
          />
          <Row label="SSS Bölümü" check={c.hasFAQ}
            guide="Sıkça Sorulan Sorular bölümü, Google AI Overviews'da doğrudan görüntülenme şansını artırır."
            hint="Sayfaya 'Sık Sorulan Sorular' başlığı altında en az 3-5 soru-cevap ekleyin. FAQPage şemasıyla birlikte kullanın."
          />
          <Row label="Tablolar" check={c.hasTables}
            guide="Tablolar, AI Overviews ve Perplexity tarafından en çok atıf yapılan format. Karşılaştırma ve fiyat tabloları çok etkili."
            hint="Hizmet karşılaştırması, fiyat tablosu veya işlem adımlarını HTML <table> ile ekleyin."
          />
          <Row label="Listeler" check={c.hasLists}
            guide="Sıralı/sırasız listeler (<ul>, <ol>) içeriğin taranabilirliğini artırır ve AI snippet'leri tarafından tercih edilir."
            hint="Özellik listeleri, adım adım rehberler veya hizmet listelerini <ul> / <ol> ile yapılandırın."
          />
          <Row label="Yazar / Uzman Sinyali" check={c.hasAuthorInfo}
            guide="E-E-A-T (Deneyim, Uzmanlık, Otorite, Güvenilirlik) sinyali. AI modelleri uzman içeriği önceliklendirir."
            hint="Sayfaya yazar bilgisi, uzmanlık alanı, unvan (Dr., Prof. vb.) ve yazar bio bölümü ekleyin. Person şeması ile destekleyin."
          />
          <Row label="Tarih Sinyali" check={c.hasDateInfo}
            guide="Yayınlanma ve güncellenme tarihi, içeriğin güncel olduğunu gösterir. AI modelleri güncel kaynakları tercih eder."
            hint="Sayfaya 'Yayınlanma: GG.AA.YYYY' ve 'Son Güncelleme: GG.AA.YYYY' bilgisi ekleyin. Schema'da datePublished ve dateModified kullanın."
          />
          {c.languageSignals.length > 0 && (
            <Row label="Dil Sinyalleri" value={c.languageSignals.join(", ").toUpperCase()} />
          )}
        </AccordionContent>
      </AccordionItem>

      {/* Schema */}
      <AccordionItem value="schema" className="rounded-lg border border-border bg-card px-4">
        <AccordionTrigger className="py-3 hover:no-underline">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Code className="w-4 h-4 text-primary" />
            Yapısal Veri (Schema)
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {data.scores.schema}/100
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <Row label="Organization" check={sc.hasOrganization}
            guide="Marka/kurum bilgisini tanımlar. AI modelleri varlık tanıma için kullanır."
            hint="JSON-LD ile Organization şeması ekleyin: name, url, logo, sameAs (sosyal profiller), contactPoint alanlarını doldurun."
          />
          <Row label="WebSite" check={sc.hasWebSite}
            guide="Sitenin genel yapısını tanımlar. Google Sitelinks arama kutusu için gerekli."
            hint="Ana sayfaya WebSite şeması ekleyin: name, url, potentialAction (SearchAction) alanlarını tanımlayın."
          />
          <Row label="WebPage" check={sc.hasWebPage}
            guide="Her sayfanın türünü ve içeriğini tanımlar. breadcrumb ve isPartOf ile site hiyerarşisini güçlendirir."
            hint="Her sayfaya WebPage şeması ekleyin. WordPress: Yoast SEO veya Rank Math otomatik ekler."
          />
          <Row label="Article / BlogPosting" check={sc.hasArticle}
            guide="Blog yazıları ve makaleler için. author, datePublished, dateModified alanları AI atıfı için önemli."
            hint="Blog sayfalarına Article veya BlogPosting şeması ekleyin. headline, author (Person), datePublished zorunlu alanlardır."
          />
          <Row label="FAQPage" check={sc.hasFAQPage}
            guide="Google AI Overviews'da doğrudan SSS zengin sonucu gösterir. En etkili şema türlerinden biri."
            hint="SSS bölümünüze FAQPage şeması ekleyin. Her soru Question, her cevap acceptedAnswer → Answer olarak tanımlanır. schema.org/FAQPage referans alın."
          />
          <Row label="BreadcrumbList" check={sc.hasBreadcrumb}
            guide="Sayfa hiyerarşisini arama motorlarına açıklar. Zengin sonuçlarda breadcrumb gösterir."
            hint="BreadcrumbList şeması ekleyin: her seviye bir ListItem, position ve name ile tanımlanır. WordPress: Yoast SEO otomatik ekler."
          />
          <Row label="LocalBusiness" check={sc.hasLocalBusiness}
            guide={isLocal ? "Yerel işletmeler için kritik. Google Haritalar, Gemini ve yerel AI arama sonuçlarında görünürlük sağlar." : isEcom ? "E-ticaret siteleri için genellikle gerekli değil. Fiziksel mağazanız varsa ekleyin." : "Fiziksel konumu olan işletmeler için geçerli bir şema türüdür."}
            hint={isLocal && !sc.hasLocalBusiness ? "LocalBusiness (veya alt türü: MedicalClinic, Dentist, Attorney vb.) şeması ekleyin: name, address, telephone, openingHours, geo, image alanları zorunlu." : undefined}
          />
          <Row label="Review / Rating" check={sc.hasReview}
            guide={isEcom ? "Ürün değerlendirmeleri arama sonuçlarında yıldız gösterir. AI modelleri ürün karşılaştırmalarında puanları kullanır." : "Müşteri yorumları ve puanlar zengin snippet'lerde yıldız gösterir. Güvenilirlik sinyali."}
            hint={!sc.hasReview ? (isEcom ? "Ürün sayfalarına AggregateRating şeması ekleyin. ratingValue, reviewCount ve bestRating alanlarını doldurun." : "AggregateRating veya Review şeması ekleyin. ratingValue, reviewCount, author alanlarını doldurun.") : undefined}
          />
          <Row label="HowTo" check={sc.hasHowTo}
            guide="Adım adım rehberler için. AI Overviews adımlı içerikleri tercih eder."
            hint="Adım adım içeriklerinize HowTo şeması ekleyin. Her adım HowToStep: name ve text alanları ile tanımlanır."
          />
          <Row label="Person" check={sc.hasPerson}
            guide="Yazar/uzman bilgisi. E-E-A-T sinyali olarak AI modelleri tarafından kullanılır."
            hint="Person şeması ekleyin: name, jobTitle, worksFor, sameAs (LinkedIn profili vb.), image alanlarını tanımlayın."
          />
          <Row label="Tıbbi Şema" check={sc.hasMedicalSchema}
            guide="Sağlık sektörü için özel şema türleri. Google sağlık panellerinde görünürlük sağlar."
            hint="MedicalClinic, Physician veya MedicalWebPage şeması ekleyin. medicalSpecialty, availableService alanlarını tanımlayın."
          />
          {sc.sameAsLinks.length > 0 && (
            <Row label="sameAs Bağlantıları" value={`${sc.sameAsLinks.length} adet`} />
          )}
          {sc.schemas.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                Tespit Edilen Şemalar
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sc.schemas.map((s, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-[10px] bg-primary/10 text-primary border-primary/20"
                  >
                    {s.type}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* AI Citability */}
      <AccordionItem value="citability" className="rounded-lg border border-border bg-card px-4">
        <AccordionTrigger className="py-3 hover:no-underline">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Bot className="w-4 h-4 text-primary" />
            YZ Atıf Uygunluğu
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {data.scores.citability}/100
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <Row label="llms.txt" check={ci.hasLlmsTxt}
            guide="llms.txt, AI modellerinin sitenizi anlamasına yardımcı olan bir dosyadır. ChatGPT ve Claude bu dosyayı okuyabilir."
            hint="Site kök dizinine /llms.txt dosyası oluşturun. İçeriğe: marka adı, uzmanlık alanları, hizmetler ve iletişim bilgilerini yazın. llmstxt.org referans alın."
          />
          <Row label="Özet Paragraflar" check={ci.hasSummaryParagraphs}
            guide="AI modelleri 3+ paragraf içeren sayfaları daha kolay özetler. Kısa ama öz paragraflar ideal."
            hint="Her bölümün başına 2-3 cümlelik özet paragraf ekleyin. 'X nedir?' veya 'X nasıl yapılır?' formatı kullanın."
          />
          <Row label="Tanım İçeriği" check={ci.hasDefinitions}
            guide="'X nedir?', 'X ne demek?' tarzı tanım cümleleri AI'nın doğrudan alıntı yapmasını kolaylaştırır."
            hint="Her hizmet/konu için 'X nedir?' başlığı altında 40-80 kelimelik net bir tanım paragrafı yazın. AI bu blokları doğrudan atıf olarak kullanır."
          />
          <Row label="İstatistik / Sayısal Veri" check={ci.hasStats}
            guide="Sayısal veriler (%, rakam, istatistik) AI modellerinin atıf önceliğini artırır. Perplexity özellikle veri odaklı."
            hint="İçeriğe somut istatistikler ekleyin: '%95 başarı oranı', '10.000+ hasta' gibi. Kaynak belirtin: 'TÜİK 2024 verilerine göre…'"
          />
          <Row label="Tablolar" check={ci.hasTables}
            guide="Tablolar, AI Overviews ve Perplexity'nin en çok atıf yaptığı içerik formatıdır."
            hint="Hizmet karşılaştırma tablosu, fiyat listesi veya tedavi yöntemleri tablosu ekleyin. HTML <table> kullanın."
          />
          <Row label="Atıf Alabilir Pasajlar" check={ci.hasQuotableContent}
            guide="Tanım + istatistik birlikte bulunduğunda atıf olasılığı çok yükselir."
            hint="Her ana konunun altına hem tanım hem sayısal veri içeren kısa paragraflar (40-80 kelime) ekleyin."
          />
          <Row label="Cevap Blokları (40-100 kelime)" value={`${ci.answerBlockCount} adet`} check={ci.answerBlockCount > 3}
            guide="H2/H3 altındaki 40-100 kelimelik paragraflar AI'nın 'cevap bloğu' olarak kullandığı formattır. 3+ adet ideal."
            hint={ci.answerBlockCount <= 3 ? "Her H2/H3 başlığının hemen altına 40-80 kelimelik net bir yanıt paragrafı yazın. Soruyu cevaplayan, özlü ve bağımsız okunabilir bloklar oluşturun." : undefined}
          />
          <Row label="Ort. Paragraf Uzunluğu" value={`${ci.avgParagraphLength} kelime`}
            guide="AI modelleri 30-80 kelimelik paragrafları tercih eder. Çok kısa veya çok uzun paragraflar atıf şansını düşürür."
          />
          {ci.hasLlmsTxt && ci.llmsTxtContent && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                llms.txt Önizleme
              </p>
              <ScrollArea className="h-32">
                <pre className="text-[11px] text-muted-foreground bg-secondary rounded-md p-3 whitespace-pre-wrap">
                  {ci.llmsTxtContent}
                </pre>
              </ScrollArea>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* Crawler Access */}
      <AccordionItem value="crawler" className="rounded-lg border border-border bg-card px-4">
        <AccordionTrigger className="py-3 hover:no-underline">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Globe className="w-4 h-4 text-primary" />
            AI Tarayıcı Erişimi
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {data.scores.crawlerAccess}/100
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <Row label="Sitemap" check={cr.hasSitemap} value={cr.sitemapUrl || "—"}
            guide="XML Sitemap, arama motorları ve AI tarayıcılarının tüm sayfalarınızı keşfetmesini sağlar."
            hint="XML sitemap oluşturun ve robots.txt'e 'Sitemap: https://siteniz.com/sitemap.xml' satırını ekleyin. WordPress: Yoast SEO otomatik oluşturur."
          />
          <Row label="İzin Verilen Botlar" value={`${cr.allowedBots}`} check={cr.allowedBots > 10}
            guide="AI görünürlüğü için GPTBot, ClaudeBot, PerplexityBot, Google-Extended gibi botlara erişim verilmelidir."
          />
          <Row label="Engellenen Botlar" value={`${cr.blockedBots}`} check={cr.blockedBots === 0}
            guide="Engellenen AI botları, sitenizin AI arama sonuçlarında görünmemesine neden olur."
            hint={cr.blockedBots > 0 ? `${cr.blockedBots} bot engelli. robots.txt dosyanızdan ilgili 'Disallow' kurallarını kaldırın veya 'Allow: /' olarak değiştirin.` : undefined}
          />
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">
              Bot Erişim Kuralları
            </p>
            {Object.entries(cr.crawlerRules).map(([bot, rule]) => (
              <Row
                key={bot}
                label={bot}
                value={rule}
                check={!rule.includes("Engellendi")}
              />
            ))}
          </div>
          {cr.robotsTxt && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                robots.txt
              </p>
              <ScrollArea className="h-32">
                <pre className="text-[11px] text-muted-foreground bg-secondary rounded-md p-3 whitespace-pre-wrap">
                  {cr.robotsTxt}
                </pre>
              </ScrollArea>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* Brand Authority */}
      <AccordionItem value="brand" className="rounded-lg border border-border bg-card px-4">
        <AccordionTrigger className="py-3 hover:no-underline">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Users className="w-4 h-4 text-primary" />
            Marka Otoritesi Sinyalleri
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {data.scores.brandAuthority}/100
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <Row label="Facebook" check={ba.hasFacebook}
            guide="Facebook işletme sayfası varlık doğrulama sinyali olarak AI modelleri tarafından kullanılır."
            hint="Facebook işletme sayfası oluşturun ve Organization şemasındaki sameAs alanına URL'yi ekleyin."
          />
          <Row label="X / Twitter" check={ba.hasTwitter}
            guide="X/Twitter profili marka görünürlüğünü artırır. Aktif profil AI atıf şansını yükseltir."
            hint="X/Twitter profili oluşturun, düzenli içerik paylaşın ve sameAs'a ekleyin."
          />
          <Row label="Instagram" check={ba.hasInstagram}
            guide="Instagram varlığı marka bilinirliği ve sosyal kanıt katmanı oluşturur."
            hint="İşletme Instagram hesabı açın ve sameAs'a ekleyin. Görsel içerik paylaşımı AI modelleri için ek sinyal oluşturur."
          />
          <Row label="LinkedIn" check={ba.hasLinkedIn}
            guide="LinkedIn profili Bing Copilot için çok önemli. Profesyonel varlık doğrulama sinyali."
            hint="LinkedIn şirket sayfası oluşturun, çalışanların profillerini bağlayın ve sameAs'a ekleyin. Bing Copilot LinkedIn verilerini öncelikli kullanır."
          />
          <Row label="YouTube" check={ba.hasYouTube}
            guide="YouTube kanalı Gemini için özellikle etkili. Video içerik Google ekosisteminde güçlü sinyal."
            hint="YouTube kanalı açın, hizmetlerinizle ilgili videolar yükleyin ve sameAs'a ekleyin. Gemini YouTube verilerini aktif olarak kullanır."
          />
          <Row label="Wikipedia" check={ba.hasWikipedia}
            guide="Wikipedia varlığı en güçlü varlık tanıma sinyalidir. ChatGPT ve tüm AI modelleri Wikipedia'yı öncelikli kaynak olarak kullanır."
            hint="Wikipedia sayfası oluşturmak zordur ama Wikidata girişi daha kolaydır. wikidata.org'da kurumunuz için bir varlık sayfası oluşturun."
          />
          <Row label="Sosyal Profil Sayısı" value={`${ba.socialProfileCount}`} check={ba.socialProfileCount >= 3}
            guide="3+ aktif sosyal profil, AI modellerinin markanızı ‘gerçek varlık’ olarak tanımasını sağlar."
            hint={ba.socialProfileCount < 3 ? "En az Facebook, Instagram ve LinkedIn profillerini oluşturun. Tümünü Organization şemasındaki sameAs alanına ekleyin." : undefined}
          />
          <Row label="sameAs Bağlantıları" value={`${ba.sameAsLinks.length} adet`} check={ba.sameAsLinks.length > 3}
            guide="sameAs bağlantıları Organization şemasında tüm resmi profilleri listeler. AI varlık eşleştirmesinin temelidir."
            hint={ba.sameAsLinks.length <= 3 ? "Organization şemasına sameAs alanı ekleyin: Facebook, Instagram, LinkedIn, YouTube, Twitter URL'lerini listeleyin. 5+ bağlantı ideal." : undefined}
          />
          {ba.brandMentionSignals.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                Tespit Edilen Sinyaller
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ba.brandMentionSignals.map((s, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
