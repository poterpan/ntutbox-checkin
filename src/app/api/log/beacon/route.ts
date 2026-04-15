import { NextRequest, NextResponse } from 'next/server';

const MAX_BODY_BYTES = 2048; // 2KB cap — beacons are small structured payloads

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'body_too_large' }, { status: 413 });
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    // Structured log; Workers Observability parses JSON fields automatically.
    console.log('[beacon]', JSON.stringify({
      ...parsed,
      server_ua: req.headers.get('user-agent'),
      ip: req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for'),
      received_at: Date.now(),
    }));

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
