export interface FirecrawlConfig {
  apiKey: string;
  apiUrl?: string;
}

export interface ScrapeOptions {
  formats?: (
    | 'markdown'
    | 'html'
    | 'rawHtml'
    | 'screenshot'
    | 'links'
    | 'json'
  )[];
  timeout?: number;
  waitFor?: number;
  onlyMainContent?: boolean;
  removeBase64Images?: boolean;
  maxAge?: number;
  location?: {
    country?: string;
    languages?: string[];
  };
  extract?: {
    prompt?: string;
    schema?: Record<string, any>;
  };
}

export interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    rawHtml?: string;
    screenshot?: string;
    links?: string[];
    json?: any;
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      keywords?: string;
      robots?: string;
      ogTitle?: string;
      ogDescription?: string;
      ogUrl?: string;
      ogImage?: string;
      sourceURL?: string;
      statusCode?: number;
    };
  };
  error?: string;
}

export interface BatchScrapeOptions extends ScrapeOptions {
  urls: string[];
  pollInterval?: number;
  timeout?: number;
}

export interface BatchScrapeResponse {
  success: boolean;
  id?: string;
  url?: string;
  status?: 'scraping' | 'completed' | 'failed' | 'cancelled';
  total?: number;
  completed?: number;
  creditsUsed?: number;
  expiresAt?: string;
  data?: FirecrawlResponse['data'][];
  error?: string;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  lang?: string;
  country?: string;
  filter?: string;
  scrapeOptions?: ScrapeOptions;
}

export interface SearchResponse {
  success: boolean;
  data?: Array<{
    url: string;
    title: string;
    description: string;
    markdown?: string;
    html?: string;
    metadata?: NonNullable<FirecrawlResponse['data']>['metadata'];
  }>;
  error?: string;
}

export interface ContentAnalysis {
  url: string;
  title: string;
  description: string;
  wordCount: number;
  readingTime: number;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  links: {
    internal: number;
    external: number;
  };
  images: number;
  keywords: string[];
  topics: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  seoScore: number;
}

export interface CompetitorAnalysis {
  competitor: string;
  content: ContentAnalysis[];
  totalPages: number;
  avgWordCount: number;
  avgReadingTime: number;
  topTopics: string[];
  contentGaps: string[];
  strengths: string[];
  weaknesses: string[];
}
