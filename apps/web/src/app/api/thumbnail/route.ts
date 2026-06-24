import { NextRequest, NextResponse } from "next/server";

const OEMBED: { test: RegExp; endpoint: (url: string) => string }[] = [
  {
    test: /open\.spotify\.com/,
    endpoint: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
  },
  {
    test: /soundcloud\.com/,
    endpoint: (u) => `https://soundcloud.com/oembed?url=${encodeURIComponent(u)}&format=json`,
  },
  {
    test: /music\.apple\.com/,
    endpoint: (u) => `https://embed.music.apple.com/oembed?url=${encodeURIComponent(u)}`,
  },
];

export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return NextResponse.json({ thumbnail: null });

  for (const { test, endpoint } of OEMBED) {
    if (test.test(url)) {
      try {
        const res = await fetch(endpoint(url), { next: { revalidate: 3600 } });
        if (!res.ok) break;
        const data: { thumbnail_url?: string } = await res.json();
        if (data.thumbnail_url) return NextResponse.json({ thumbnail: data.thumbnail_url });
      } catch {}
      break;
    }
  }

  return NextResponse.json({ thumbnail: null });
}
