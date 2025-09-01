import { tool } from 'ai';
import { z } from 'zod';
import { firecrawl } from '@/lib/firecrawl/client';
import type { ScrapeOptions } from '@/lib/firecrawl/types';

export const firecrawlTools = {
  /**
   * Scrape and analyze a single URL for content insights
   */
  analyzeWebContent: tool({
    description:
      'Scrape and analyze a website for content strategy insights including SEO metrics, readability, and content structure',
    inputSchema: z.object({
      url: z.string().url().describe('The URL to analyze'),
      includeHtml: z
        .boolean()
        .optional()
        .describe('Whether to include HTML content in the analysis'),
      mainContentOnly: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          'Extract only main content, filtering out navigation and footers',
        ),
    }),
    execute: async ({ url, includeHtml = false, mainContentOnly = true }) => {
      try {
        const formats: ScrapeOptions['formats'] = includeHtml
          ? ['markdown', 'html']
          : ['markdown'];

        const result = await firecrawl.scrape(url, {
          formats,
          onlyMainContent: mainContentOnly,
          timeout: 30000,
        });

        const analysis = await firecrawl.analyzeContent(url);

        return {
          success: true,
          url,
          content: {
            markdown: result.markdown,
            html: includeHtml ? result.html : undefined,
          },
          metadata: result.metadata,
          analysis,
        };
      } catch (error) {
        return {
          error: `Failed to analyze content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  }),

  /**
   * Analyze competitor websites for content strategy insights
   */
  analyzeCompetitor: tool({
    description:
      'Analyze a competitor website to identify content gaps, topics, and strategic opportunities',
    inputSchema: z.object({
      competitorUrl: z
        .string()
        .url()
        .describe('The competitor website URL to analyze'),
      maxPages: z
        .number()
        .optional()
        .default(5)
        .describe(
          'Maximum number of pages to analyze from the competitor site',
        ),
      focusAreas: z
        .array(z.string())
        .optional()
        .describe(
          'Specific areas to focus analysis on (e.g., "blog", "products", "services")',
        ),
    }),
    execute: async ({ competitorUrl, maxPages = 5, focusAreas = [] }) => {
      try {
        const analysis = await firecrawl.analyzeCompetitor(
          competitorUrl,
          maxPages,
        );

        if (!analysis) {
          return { error: 'Failed to analyze competitor website' };
        }

        // Generate strategic insights based on the analysis
        const insights = {
          contentVolume: {
            totalPages: analysis.totalPages,
            avgWordCount: analysis.avgWordCount,
            avgReadingTime: analysis.avgReadingTime,
          },
          topTopics: analysis.topTopics,
          contentTypes: analysis.content.map((c) => ({
            url: c.url,
            title: c.title,
            wordCount: c.wordCount,
            topics: c.topics,
            seoScore: c.seoScore,
          })),
          opportunities: {
            shortFormContent: analysis.content.filter((c) => c.wordCount < 500)
              .length,
            longFormContent: analysis.content.filter((c) => c.wordCount > 2000)
              .length,
            averageSeoScore: Math.round(
              analysis.content.reduce((sum, c) => sum + c.seoScore, 0) /
                analysis.content.length,
            ),
          },
        };

        return {
          success: true,
          competitor: competitorUrl,
          analysis,
          insights,
          recommendations: [
            `Competitor publishes ${analysis.avgWordCount} words per article on average`,
            `Top content topics: ${analysis.topTopics.slice(0, 5).join(', ')}`,
            `Content opportunity: ${insights.opportunities.shortFormContent} short-form vs ${insights.opportunities.longFormContent} long-form pieces`,
            `Average SEO score: ${insights.opportunities.averageSeoScore}/100`,
          ],
        };
      } catch (error) {
        return {
          error: `Failed to analyze competitor: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  }),

  /**
   * Search for content ideas and trending topics
   */
  searchContentIdeas: tool({
    description:
      'Search the web for content ideas and trending topics in a specific niche or industry',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'Search query for content ideas (e.g., "WordPress development trends 2024")',
        ),
      includeContent: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'Whether to scrape and include full content from search results',
        ),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe('Number of search results to return'),
      country: z
        .string()
        .optional()
        .default('US')
        .describe('Country code for localized results'),
    }),
    execute: async ({
      query,
      includeContent = false,
      limit = 5,
      country = 'US',
    }) => {
      try {
        const searchResult = await firecrawl.search(query, {
          limit,
          country,
          scrapeOptions: includeContent
            ? {
                formats: ['markdown'],
                onlyMainContent: true,
              }
            : undefined,
        });

        const webResults = (searchResult as any).web ?? [];
        type ContentIdea = {
          title: string;
          url: string;
          content?: string;
          insights: {
            estimatedWordCount: number;
            hasImages: boolean;
            hasHeadings: boolean;
          };
        };
        const ideas: ContentIdea[] = webResults.map((result: any) => ({
          title: (result.title ?? result.url) as string,
          url: result.url as string,
          content:
            includeContent && 'markdown' in result
              ? (result.markdown as string | undefined)
              : undefined,
          insights: {
            estimatedWordCount:
              'markdown' in result && result.markdown
                ? (result.markdown as string).split(/\s+/).length
                : 0,
            hasImages:
              'markdown' in result && result.markdown
                ? /!\[/.test(result.markdown as string)
                : false,
            hasHeadings:
              'markdown' in result && result.markdown
                ? /^#+\s/.test(result.markdown as string)
                : false,
          },
        }));

        // Extract common themes and topics
        const allTitles = ideas.map((idea) => idea.title).join(' ');
        const commonWords = allTitles
          .toLowerCase()
          .split(/\s+/)
          .filter((word) => word.length > 3)
          .reduce(
            (acc, word) => {
              acc[word] = (acc[word] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          );

        const trendingTopics = (
          Object.entries(commonWords) as Array<[string, number]>
        )
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([word]) => word);

        return {
          success: true,
          query,
          totalResults: ideas.length,
          contentIdeas: ideas,
          trendingTopics,
          recommendations: [
            `Found ${ideas.length} relevant content ideas for "${query}"`,
            `Trending topics: ${trendingTopics.slice(0, 5).join(', ')}`,
            `Average content length: ${Math.round(ideas.reduce((sum: number, idea: ContentIdea) => sum + idea.insights.estimatedWordCount, 0) / Math.max(ideas.length, 1))} words`,
            `${ideas.filter((idea: ContentIdea) => idea.insights.hasImages).length}/${ideas.length} results include images`,
          ],
        };
      } catch (error) {
        return {
          error: `Failed to search content ideas: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  }),

  /**
   * Extract structured data from a webpage
   */
  extractStructuredData: tool({
    description:
      'Extract specific structured data from a webpage using AI-powered extraction',
    inputSchema: z.object({
      url: z.string().url().describe('The URL to extract data from'),
      dataSchema: z
        .record(z.any())
        .describe('JSON schema defining what data to extract'),
      extractionPrompt: z
        .string()
        .optional()
        .describe('Custom prompt to guide the AI extraction'),
    }),
    execute: async ({ url, dataSchema, extractionPrompt }) => {
      try {
        const extractedData = await firecrawl.extractStructuredData(
          url,
          dataSchema,
          extractionPrompt,
        );

        if (!extractedData) {
          return {
            error: 'Failed to extract structured data from the webpage',
          };
        }

        return {
          success: true,
          url,
          extractedData,
          schema: dataSchema,
        };
      } catch (error) {
        return {
          error: `Failed to extract structured data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  }),

  /**
   * Batch analyze multiple URLs for content comparison
   */
  batchAnalyzeUrls: tool({
    description:
      'Analyze multiple URLs at once for content comparison and competitive analysis',
    inputSchema: z.object({
      urls: z.array(z.string().url()).describe('Array of URLs to analyze'),
      comparisonType: z
        .enum(['competitor', 'content-audit', 'topic-research'])
        .describe('Type of comparison analysis'),
    }),
    execute: async ({ urls, comparisonType }) => {
      try {
        if (urls.length > 10) {
          return { error: 'Maximum 10 URLs allowed for batch analysis' };
        }

        const analyses = [];
        for (const url of urls) {
          const analysis = await firecrawl.analyzeContent(url);
          if (analysis) {
            analyses.push(analysis);
          }
        }

        // Generate comparison insights
        const comparison = {
          totalUrls: analyses.length,
          avgWordCount: Math.round(
            analyses.reduce((sum, a) => sum + a.wordCount, 0) / analyses.length,
          ),
          avgReadingTime: Math.round(
            analyses.reduce((sum, a) => sum + a.readingTime, 0) /
              analyses.length,
          ),
          avgSeoScore: Math.round(
            analyses.reduce((sum, a) => sum + a.seoScore, 0) / analyses.length,
          ),
          contentLengthRange: {
            shortest: Math.min(...analyses.map((a) => a.wordCount)),
            longest: Math.max(...analyses.map((a) => a.wordCount)),
          },
          topTopics: analyses
            .flatMap((a) => a.topics)
            .reduce(
              (acc, topic) => {
                acc[topic] = (acc[topic] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>,
            ),
        };

        return {
          success: true,
          comparisonType,
          analyses,
          comparison,
          recommendations: [
            `Analyzed ${analyses.length} URLs with average ${comparison.avgWordCount} words per page`,
            `Content length varies from ${comparison.contentLengthRange.shortest} to ${comparison.contentLengthRange.longest} words`,
            `Average SEO score: ${comparison.avgSeoScore}/100`,
            `Average reading time: ${comparison.avgReadingTime} minutes`,
          ],
        };
      } catch (error) {
        return {
          error: `Failed to batch analyze URLs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  }),
};
