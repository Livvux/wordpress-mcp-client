import { AUTH_ENABLED, DB_ENABLED, isOss } from '@/lib/config';

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

  // TODO: Implement calls to WordPress (JWT/App Password). This is a stub.
  async validate(): Promise<WPClientResult> {
    if (isOss) return { ok: false, error: 'Not available in OSS mode' };
    return { ok: false, error: 'Not implemented' };
  }

  async createPost(_input: WPCreatePostInput): Promise<WPClientResult<{ id: number; link?: string }>> {
    if (isOss) return { ok: false, error: 'Not available in OSS mode' };
    return { ok: false, error: 'Not implemented' };
  }

  async updatePost(_id: string, _input: WPUpdatePostInput): Promise<WPClientResult> {
    if (isOss) return { ok: false, error: 'Not available in OSS mode' };
    return { ok: false, error: 'Not implemented' };
  }

  async uploadMedia(_file: File): Promise<WPClientResult<{ id: number; url: string }>> {
    if (isOss) return { ok: false, error: 'Not available in OSS mode' };
    return { ok: false, error: 'Not implemented' };
  }
}

