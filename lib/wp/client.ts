import { isOss } from '@/lib/config';

type FetchOptions = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  jwt?: string;
  headers?: Record<string, string>;
  body?: any;
  idempotencyKey?: string;
};

export interface WPCreatePostInput {
  title: string;
  content: string;
  status?: 'draft' | 'publish';
  categories?: string[];
  tags?: string[];
  idempotencyKey?: string;
}

export interface WPUpdatePostInput extends Partial<WPCreatePostInput> {}

export interface WPClientResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

export class WPClient {
  constructor(private siteUrl: string, private jwt?: string) {}

  private async request<T = any>({ method, path, jwt, headers, body, idempotencyKey }: FetchOptions) {
    const base = this.siteUrl.replace(/\/$/, '');
    const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;
    const h: Record<string, string> = {
      'Accept': 'application/json',
      ...(headers || {}),
    };
    const token = jwt || this.jwt;
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (idempotencyKey) h['Idempotency-Key'] = idempotencyKey;
    let bodyPayload: BodyInit | undefined;
    if (body && !(body instanceof FormData)) {
      h['Content-Type'] = 'application/json';
      bodyPayload = JSON.stringify(body);
    } else if (body instanceof FormData) {
      bodyPayload = body as any;
    }

    const res = await fetch(url, {
      method,
      headers: h,
      body: bodyPayload,
      cache: 'no-store',
    });
    const text = await res.text();
    let data: any = undefined;
    try { data = text ? JSON.parse(text) : undefined; } catch {}
    if (!res.ok) {
      const message = data?.message || res.statusText || 'WP request failed';
      return { ok: false as const, status: res.status, error: message, data };
    }
    return { ok: true as const, status: res.status, data: data as T };
  }

  async validate(): Promise<WPClientResult> {
    if (isOss) return { ok: false, error: 'Not available in OSS mode' };
    const r = await this.request({ method: 'GET', path: '/wp-json' });
    return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error };
  }

  async createPost(_input: WPCreatePostInput): Promise<WPClientResult<{ id: number; link?: string }>> {
    if (isOss) return { ok: false, error: 'Not available in OSS mode' };
    const payload: any = {
      title: _input.title,
      content: _input.content,
      status: _input.status || 'draft',
    };
    if (_input.categories) payload.categories = _input.categories;
    if (_input.tags) payload.tags = _input.tags;

    const r = await this.request<{ id: number; link?: string}>({
      method: 'POST',
      path: '/wp-json/wp/v2/posts',
      body: payload,
      idempotencyKey: _input.idempotencyKey,
    });
    return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error };
  }

  async updatePost(_id: string, _input: WPUpdatePostInput): Promise<WPClientResult> {
    if (isOss) return { ok: false, error: 'Not available in OSS mode' };
    const payload: any = { ..._input };
    const r = await this.request({
      method: 'PATCH',
      path: `/wp-json/wp/v2/posts/${_id}`,
      body: payload,
    });
    return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error };
  }

  async uploadMedia(_file: File): Promise<WPClientResult<{ id: number; url: string }>> {
    if (isOss) return { ok: false, error: 'Not available in OSS mode' };
    const form = new FormData();
    form.append('file', _file);
    const r = await this.request<{ id: number; source_url: string }>({
      method: 'POST',
      path: '/wp-json/wp/v2/media',
      body: form,
      headers: {},
    });
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, data: { id: r.data.id, url: r.data.source_url } };
  }
}
