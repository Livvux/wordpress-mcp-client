import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const wpBase = cookieStore.get('wp_base')?.value;
    const wpJwt = cookieStore.get('wp_jwt')?.value;
    if (!wpBase || !wpJwt) {
      return NextResponse.json(
        { error: 'WordPress not connected' },
        { status: 401 },
      );
    }

    const endpoint = `${wpBase.replace(/\/$/, '')}/wp-json/wpcursor/v1/logs/tail`;
    const lastEventId = request.headers.get('last-event-id') || undefined;
    const upstream = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${wpJwt}`,
        ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
      },
      cache: 'no-store',
    });

    if (!upstream.body || !upstream.ok) {
      return NextResponse.json(
        { error: `Upstream failed: ${upstream.status} ${upstream.statusText}` },
        { status: 502 },
      );
    }

    const stream = new ReadableStream({
      start(controller) {
        const reader = upstream.body!.getReader();
        // Heartbeat (ping) every 15 seconds
        const interval = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode('event: ping\n\n'));
          } catch {}
        }, 15000);
        const pump = () =>
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                clearInterval(interval);
                controller.close();
                return;
              }
              if (value) controller.enqueue(value);
              pump();
            })
            .catch((err) => {
              try {
                clearInterval(interval);
                controller.error(err);
              } catch {}
            });
        pump();
      },
      cancel() {
        try {
          upstream.body?.cancel();
        } catch {}
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Logs tail proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy logs tail' },
      { status: 500 },
    );
  }
}
