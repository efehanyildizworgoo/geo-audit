import { NextRequest, NextResponse } from "next/server";
import { runAudit } from "@/lib/audit-engine";
import { generateAIRecommendations } from "@/lib/ai-recommendations";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http")) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    const result = await runAudit(normalizedUrl);

    // AI recommendations — non-blocking, don't fail if no API key
    try {
      const aiRecs = await generateAIRecommendations(result);
      if (aiRecs.length > 0) {
        result.aiRecommendations = aiRecs;
      }
    } catch (e) {
      console.error("[API/audit] AI recs failed:", e);
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
