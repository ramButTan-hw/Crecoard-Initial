import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, rateLimit, getClientIp } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`import-playlist:${auth.userId ?? getClientIp(req)}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return limited.response;

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (platform === "youtube") {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) return NextResponse.json({ error: "YOUTUBE_API_KEY not configured" }, { status: 503 });

    const tracks: { title: string; url: string }[] = [];
    let pageToken: string | undefined;

    try {
      do {
        const apiUrl =
          `https://www.googleapis.com/youtube/v3/playlistItems` +
          `?part=snippet&playlistId=${encodeURIComponent(id)}&maxResults=50` +
          (pageToken ? `&pageToken=${pageToken}` : "") +
          `&key=${key}`;

        const res = await fetch(apiUrl, { next: { revalidate: 300 } });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return NextResponse.json(
            { error: (err as any)?.error?.message ?? "YouTube API error" },
            { status: res.status }
          );
        }

        const data: {
          items?: { snippet?: { title?: string; resourceId?: { videoId?: string } } }[];
          nextPageToken?: string;
        } = await res.json();

        for (const item of data.items ?? []) {
          const videoId = item.snippet?.resourceId?.videoId;
          const title = item.snippet?.title;
          if (videoId && title && title !== "Private video" && title !== "Deleted video") {
            tracks.push({ title, url: `https://www.youtube.com/watch?v=${videoId}` });
          }
        }

        pageToken = data.nextPageToken;
      } while (pageToken && tracks.length < 200);
    } catch {
      return NextResponse.json({ error: "Failed to fetch playlist" }, { status: 500 });
    }

    return NextResponse.json({ tracks });
  }

  return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
}
