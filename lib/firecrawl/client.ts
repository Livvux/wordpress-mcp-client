import Firecrawl from '@mendable/firecrawl-js';
import type { Document, SearchData, SearchRequest } from '@mendable/firecrawl-js';
import type {
  FirecrawlConfig,
  ScrapeOptions,
  ContentAnalysis,
  CompetitorAnalysis,
} from './types';

export class FirecrawlClient {
  private client: Firecrawl;

  constructor(config?: Partial<FirecrawlConfig>) {
    const apiKey = config?.apiKey || process.env.FIRECRAWL_API_KEY;
    const apiUrl = config?.apiUrl || process.env.FIRECRAWL_API_URL;

    if (!apiKey) {
      throw new Error('Firecrawl API key is required');
    }

    this.client = new Firecrawl({
      apiKey,
      ...(apiUrl && { apiUrl }),
    });
  }

  /**
   * Scrape a single URL and return the document
   */
  async scrape(url: string, options: ScrapeOptions = {}): Promise<Document> {
    const formats = options.formats || ['markdown'];
    
    return await this.client.scrape(url, {
      formats,
      timeout: options.timeout,
      waitFor: options.waitFor,
      onlyMainContent: options.onlyMainContent,
      removeBase64Images: options.removeBase64Images,
      maxAge: options.maxAge,
      location: options.location,
    });
  }

  /**
   * Search the web and optionally scrape results
   */
  async search(
    query: string,
    options: {
      limit?: number;
      lang?: string;
      country?: string; // mapped to Firecrawl's `location`
      scrapeOptions?: ScrapeOptions;
    } = {},
  ): Promise<SearchData> {
    const req: Omit<SearchRequest, 'query'> = {
      limit: options.limit ?? 5,
      location: options.country, // country code (e.g., 'US')
      scrapeOptions: options.scrapeOptions as any,
    };
    return await this.client.search(query, req);
  }

  /**
   * Analyze content from a URL for SEO and content insights
   */
  async analyzeContent(url: string): Promise<ContentAnalysis | null> {
    try {
      const result = await this.scrape(url, {
        formats: ['markdown', 'html'],
        onlyMainContent: true,
      });

      if (!result.markdown) {
        return null;
      }

      const markdown = result.markdown;
      const metadata = result.metadata || {};

      // Basic content analysis from markdown
      const wordCount = markdown.split(/\s+/).length;
      const readingTime = Math.ceil(wordCount / 200); // Average reading speed

      // Extract headings
      const h1Matches = markdown.match(/^# (.+)$/gm) || [];
      const h2Matches = markdown.match(/^## (.+)$/gm) || [];
      const h3Matches = markdown.match(/^### (.+)$/gm) || [];

      // Count links and images
      const linkMatches = markdown.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
      const imageMatches = markdown.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || [];

      // Handle keywords - can be string or array
      let keywords: string[] = [];
      if (metadata.keywords) {
        if (Array.isArray(metadata.keywords)) {
          keywords = metadata.keywords;
        } else if (typeof metadata.keywords === 'string') {
          keywords = metadata.keywords.split(',').map(k => k.trim());
        }
      }

      return {
        url,
        title: metadata.title || '',
        description: metadata.description || '',
        wordCount,
        readingTime,
        headings: {
          h1: h1Matches.map(h => h.replace(/^# /, '')),
          h2: h2Matches.map(h => h.replace(/^## /, '')),
          h3: h3Matches.map(h => h.replace(/^### /, '')),
        },
        links: {
          internal: linkMatches.filter(link => !link.includes('http')).length,
          external: linkMatches.filter(link => link.includes('http')).length,
        },
        images: imageMatches.length,
        keywords,
        topics: [], // Would be populated by AI analysis
        sentiment: 'neutral' as const,
        seoScore: Math.min(100, Math.max(0, 
          (metadata.title ? 20 : 0) + 
          (metadata.description ? 20 : 0) + 
          (keywords.length > 0 ? 20 : 0) + 
          (h1Matches.length > 0 ? 20 : 0) + 
          (wordCount > 300 ? 20 : 0)
        )),
      };
    } catch (error) {
      console.error('Content analysis error:', error);
      return null;
    }
  }

  /**
   * Analyze competitor websites for content strategy insights
   */
  async analyzeCompetitor(competitorUrl: string, maxPages = 10): Promise<CompetitorAnalysis | null> {
    try {
      // First, scrape the main page to understand the site structure
      const mainPageResult = await this.scrape(competitorUrl, {
        formats: ['markdown', 'links'],
        onlyMainContent: true,
      });

      if (!mainPageResult.markdown) {
        return null;
      }

      // Get internal links for additional pages to analyze
      const links = mainPageResult.links || [];
      const internalLinks = links
        .filter(link => link.includes(competitorUrl) || !link.includes('http'))
        .slice(0, maxPages - 1);

      // Analyze multiple pages
      const pagesToAnalyze = [competitorUrl, ...internalLinks];
      const analyses: ContentAnalysis[] = [];

      for (const pageUrl of pagesToAnalyze) {
        const analysis = await this.analyzeContent(pageUrl);
        if (analysis) {
          analyses.push(analysis);
        }
      }

      if (analyses.length === 0) {
        return null;
      }

      // Aggregate insights
      const totalWords = analyses.reduce((sum, a) => sum + a.wordCount, 0);
      const totalReadingTime = analyses.reduce((sum, a) => sum + a.readingTime, 0);
      
      // Extract all topics and find most common ones
      const allTopics = analyses.flatMap(a => a.topics);
      const topicCounts = allTopics.reduce((acc, topic) => {
        acc[topic] = (acc[topic] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topTopics = Object.entries(topicCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([topic]) => topic);

      return {
        competitor: competitorUrl,
        content: analyses,
        totalPages: analyses.length,
        avgWordCount: Math.round(totalWords / analyses.length),
        avgReadingTime: Math.round(totalReadingTime / analyses.length),
        topTopics,
        contentGaps: [], // Will be populated by AI analysis
        strengths: [], // Will be populated by AI analysis
        weaknesses: [], // Will be populated by AI analysis
      };
    } catch (error) {
      console.error('Competitor analysis error:', error);
      return null;
    }
  }

  /**
   * Extract structured data from a URL using AI
   */
  async extractStructuredData(url: string, schema: Record<string, any>, prompt?: string): Promise<any> {
    try {
      const result = await this.client.scrape(url, {
        formats: [{ type: 'json', schema, prompt }],
      });

      return result.json || null;
    } catch (error) {
      console.error('Structured data extraction error:', error);
      return null;
    }
  }
}

// Export singleton instance
export const firecrawl = new FirecrawlClient();
