import { tool } from 'ai';
import { MCPClient, type MCPTool } from '@/lib/mcp/client';
import { zodFromJsonSchema } from '@/lib/mcp/zod-from-json';
import { z } from 'zod';

export interface WordPressToolConfig {
  wpBase: string;
  jwt: string;
  writeMode: boolean;
  allowedTools?: string[];
}

export async function loadWordPressTools(config: WordPressToolConfig) {
  const client = new MCPClient(config.wpBase, config.jwt);

  try {
    // Initialize MCP connection
    await client.initialize();

    // Get available tools from WordPress
    const { tools: mcpTools } = await client.listTools();

    // Convert MCP tools to AI SDK tools
    const aiTools: Record<string, any> = {};

    for (const mcpTool of mcpTools) {
      // Skip tools that are not in the allowed list (if specified)
      if (config.allowedTools && !config.allowedTools.includes(mcpTool.name)) {
        continue;
      }

      // Skip write operations if write mode is disabled
      const isWriteOperation =
        mcpTool.kind === 'action' ||
        ['create', 'update', 'delete', 'edit', 'publish', 'trash'].some((op) =>
          mcpTool.name.toLowerCase().includes(op),
        );

      if (isWriteOperation && !config.writeMode) {
        continue;
      }

      // Convert JSON Schema to Zod schema
      const inputSchema = mcpTool.inputSchema
        ? zodFromJsonSchema(mcpTool.inputSchema)
        : z.object({});

      // Create AI SDK tool
      aiTools[mcpTool.name] = tool({
        description: mcpTool.description || `WordPress tool: ${mcpTool.name}`,
        inputSchema: inputSchema,
        execute: async (args: any) => {
          try {
            const result = await client.callTool(mcpTool.name, args);
            return result;
          } catch (error) {
            console.error(
              `Error executing WordPress tool ${mcpTool.name}:`,
              error,
            );
            throw error;
          }
        },
      });
    }

    return aiTools;
  } catch (error) {
    console.error('Error loading WordPress tools:', error);
    return {};
  }
}

// Helper function to get tool categories
export function categorizeTools(tools: MCPTool[]): Record<string, MCPTool[]> {
  const categories: Record<string, MCPTool[]> = {
    posts: [],
    pages: [],
    media: [],
    users: [],
    settings: [],
    woocommerce: [],
    other: [],
  };

  for (const tool of tools) {
    const name = tool.name.toLowerCase();

    if (name.includes('post')) {
      categories.posts.push(tool);
    } else if (name.includes('page')) {
      categories.pages.push(tool);
    } else if (
      name.includes('media') ||
      name.includes('image') ||
      name.includes('attachment')
    ) {
      categories.media.push(tool);
    } else if (name.includes('user')) {
      categories.users.push(tool);
    } else if (name.includes('setting') || name.includes('option')) {
      categories.settings.push(tool);
    } else if (
      name.includes('woo') ||
      name.includes('product') ||
      name.includes('order')
    ) {
      categories.woocommerce.push(tool);
    } else {
      categories.other.push(tool);
    }
  }

  // Remove empty categories
  return Object.fromEntries(
    Object.entries(categories).filter(([_, tools]) => tools.length > 0),
  );
}
