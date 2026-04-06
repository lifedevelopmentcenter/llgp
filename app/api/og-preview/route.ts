import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LLGPBot/1.0)" },
      signal: AbortSignal.timeout(6000),
    });
    const html = await res.text();

    const get = (property: string): string | null => {
      // og: meta tags
      const ogMatch = html.match(
        new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i")
      ) || html.match(
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i")
      );
      if (ogMatch) return ogMatch[1];

      // twitter: meta tags
      const twMatch = html.match(
        new RegExp(`<meta[^>]+name=["']${property.replace("og:", "twitter:")}["'][^>]+content=["']([^"']+)["']`, "i")
      );
      if (twMatch) return twMatch[1];

      return null;
    };

    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const image = get("og:image") || get("twitter:image");
    const title = get("og:title") || get("twitter:title") || titleTagMatch?.[1]?.trim() || null;
    const description = get("og:description") || get("twitter:description") || null;

    return NextResponse.json({ image, title, description });
  } catch {
    return NextResponse.json({ image: null, title: null, description: null });
  }
}
