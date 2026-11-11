import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveVoice } from "@/lib/audio/voices";
import {
  MAX_SPEECH_CHARS,
  normaliseSpeechRate,
  normaliseSpeechText,
  speechCacheMaterial,
  type SpeechClip,
  type WordBoundary,
} from "@/lib/audio/tts-shared";

// msedge-tts talks WebSocket through `ws`, which only exists in node.
export const runtime = "nodejs";
// A worst case: Edge handshake plus a 600-character line plus upload.
export const maxDuration = 30;

const BUCKET = "tts";
/** Edge's mp3 is constant-bitrate, so duration follows from byte length. */
const MP3_KBPS = 48;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(MAX_SPEECH_CHARS),
  voice: z.string().max(64).optional(),
  rate: z.number().min(0.5).max(1.5).optional(),
});

function fallback(error: string, status: number) {
  return NextResponse.json({ error, fallback: true }, { status });
}

/** The text is dropped into SSML; anything XML-ish must not break it. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface EdgeMetadata {
  Metadata?: {
    Type?: string;
    /** Offsets and durations arrive in 100-nanosecond ticks. */
    Data?: { Offset?: number; Duration?: number; text?: { Text?: string } };
  }[];
}

const TICKS_PER_MS = 10_000;

async function synthesise(
  text: string,
  voice: string,
  rate: number,
): Promise<{ audio: Buffer; boundaries: WordBoundary[] }> {
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 8000, synthesisTimeoutMs: 15000 });
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
      wordBoundaryEnabled: true,
    });
    const { audioStream, metadataStream } = tts.toStream(escapeXml(text), { rate });
    const chunks: Buffer[] = [];
    const boundaries: WordBoundary[] = [];
    metadataStream?.on("data", (chunk: Buffer) => {
      let parsed: EdgeMetadata;
      try {
        parsed = JSON.parse(chunk.toString()) as EdgeMetadata;
      } catch {
        return;
      }
      for (const item of parsed.Metadata ?? []) {
        if (item.Type !== "WordBoundary" || !item.Data) continue;
        const word = item.Data.text?.Text ?? "";
        if (!word) continue;
        boundaries.push({
          word,
          offsetMs: Math.round((item.Data.Offset ?? 0) / TICKS_PER_MS),
          durationMs: Math.round((item.Data.Duration ?? 0) / TICKS_PER_MS),
          index: boundaries.length,
        });
      }
    });
    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      audioStream.once("end", resolve);
      audioStream.once("error", reject);
    });
    const audio = Buffer.concat(chunks);
    if (audio.length === 0) throw new Error("Edge TTS returned no audio");
    return { audio, boundaries };
  } finally {
    tts.close();
  }
}

/**
 * POST → the audio for one line of German in one voice. Every learner
 * who hears the same line at the same rate shares one mp3 in the `tts`
 * bucket, so Edge is asked exactly once per utterance; the word
 * boundaries ride along in tts_cache. Storage trouble degrades to an
 * inline data: URL and Edge trouble to a 502 the client reads as
 * "use the device voice" — the lesson never stalls on audio.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  if (process.env.TTS_DISABLE === "1") return fallback("tts_disabled", 503);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const text = normaliseSpeechText(parsed.data.text);
  const voice = resolveVoice(parsed.data.voice);
  const rate = normaliseSpeechRate(parsed.data.rate);
  const key = createHash("sha256").update(speechCacheMaterial(voice, rate, text)).digest("hex");
  const path = `${key}.mp3`;

  // The admin client needs the secret key; without it (local dev)
  // every request simply synthesises and streams inline.
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  if (admin) {
    try {
      const { data: hit } = await admin
        .from("tts_cache")
        .select("boundaries, duration_ms")
        .eq("key", key)
        .maybeSingle();
      if (hit) {
        const clip: SpeechClip = {
          url: admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
          boundaries: (hit.boundaries as WordBoundary[] | null) ?? [],
          durationMs: hit.duration_ms ?? undefined,
          cached: true,
        };
        return NextResponse.json(clip);
      }
    } catch (error) {
      console.warn("[tts] cache lookup failed:", error);
    }
  }

  let audio: Buffer;
  let boundaries: WordBoundary[];
  try {
    ({ audio, boundaries } = await synthesise(text, voice, rate));
  } catch (error) {
    console.warn("[tts] synthesis failed:", error);
    return fallback("synthesis_failed", 502);
  }
  const durationMs = Math.round((audio.length * 8) / MP3_KBPS);

  if (admin) {
    try {
      const { error } = await admin.storage.from(BUCKET).upload(path, audio, {
        contentType: "audio/mpeg",
        cacheControl: "31536000",
        upsert: true,
      });
      if (!error) {
        // The row is written only after the object exists, so a hit
        // never points at audio that is not there.
        await admin
          .from("tts_cache")
          .upsert({ key, voice, text, duration_ms: durationMs, boundaries });
        const clip: SpeechClip = {
          url: admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
          boundaries,
          durationMs,
        };
        return NextResponse.json(clip);
      }
      console.warn("[tts] upload failed, serving inline:", error.message);
    } catch (error) {
      console.warn("[tts] storage unavailable, serving inline:", error);
    }
  }

  const clip: SpeechClip = {
    url: `data:audio/mpeg;base64,${audio.toString("base64")}`,
    boundaries,
    durationMs,
  };
  return NextResponse.json(clip);
}
