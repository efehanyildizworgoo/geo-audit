import { NextRequest } from "next/server";
import { crawlSite } from "@/lib/gullanbot";
import { generateAIRecommendations } from "@/lib/ai-recommendations";
import type { CrawlProgress } from "@/lib/types";

export const maxDuration = 120; // Allow up to 2 min for full crawl

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http")) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Use SSE to stream progress
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function sendProgress(progress: CrawlProgress) {
          const data = JSON.stringify({ type: "progress", data: progress });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        try {
          const result = await crawlSite(normalizedUrl, sendProgress);

          // AI recommendations on the full site audit
          if (result.homepageAudit) {
            try {
              const aiRecs = await generateAIRecommendations(result.homepageAudit);
              if (aiRecs.length > 0) {
                result.aiRecommendations = aiRecs;
                result.homepageAudit.aiRecommendations = aiRecs;
              }
            } catch (e) {
              console.error("[API/crawl] AI recs failed:", e);
            }
          }

          const data = JSON.stringify({ type: "result", data: result });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Crawl failed";
          const data = JSON.stringify({ type: "error", data: { message } });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Crawl failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
