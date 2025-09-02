export function getClientIp(request: Request): string {
  try {
    const h = request.headers;
    const xff = h.get('x-forwarded-for') || h.get('X-Forwarded-For');
    if (xff) {
      // First entry is the original client IP
      const first = xff.split(',')[0]?.trim();
      if (first) return first;
    }
    const realIp = h.get('x-real-ip') || h.get('X-Real-IP');
    if (realIp) return realIp;
    const cf = h.get('cf-connecting-ip');
    if (cf) return cf;
    const forwarded = h.get('forwarded');
    if (forwarded) {
      const match = forwarded.match(/for=([^;]+)/i);
      if (match && match[1]) return match[1].replace(/^"|"$/g, '');
    }
  } catch {}
  return '127.0.0.1';
}
