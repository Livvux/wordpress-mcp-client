export interface MCPRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: any;
}

export interface MCPResponse<T = any> {
  jsonrpc: '2.0';
  id: string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
  kind?: 'action' | 'read';
}

export interface MCPToolsListResponse {
  tools: MCPTool[];
}

export interface MCPToolCallParams {
  name: string;
  arguments?: any;
}

export class MCPClient {
  private wpBase: string;
  private jwt: string;

  constructor(wpBase: string, jwt: string) {
    this.wpBase = wpBase.replace(/\/$/, '');
    this.jwt = jwt;
  }

  async request<T = any>(method: string, params?: any): Promise<T> {
    const requestBody: MCPRequest = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
    };

    // Only include params if they are provided
    if (params !== undefined) {
      requestBody.params = params;
    }

    const endpoint = `${this.wpBase}/wp-json/wp/v2/wpmcp/streamable`;

    console.log('MCP Request:', {
      endpoint,
      method,
      requestBody: JSON.stringify(requestBody, null, 2),
      hasJwt: !!this.jwt,
      jwtStart: `${this.jwt.substring(0, 20)}...`,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${this.jwt}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('MCP Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorText = await response.text();
        console.log('MCP Error Response Body:', errorText);
        errorDetails = ` - ${errorText}`;
      } catch (e) {
        console.log('Could not read error response body');
      }

      throw new Error(
        `MCP request failed: ${response.status} ${response.statusText}${errorDetails}`,
      );
    }

    const data: MCPResponse<T> = await response.json();
    console.log('MCP Response Data:', data);

    if (data.error) {
      throw new Error(data.error.message || 'MCP error occurred');
    }

    return data.result as T;
  }

  async initialize(): Promise<any> {
    return this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { call: {} },
        resources: { read: {} },
        prompts: { get: {} },
      },
      clientInfo: {
        name: 'wpAgentic',
        version: '1.0.0',
      },
    });
  }

  async listTools(): Promise<MCPToolsListResponse> {
    return this.request<MCPToolsListResponse>('tools/list/all');
  }

  async callTool(name: string, args: any = {}): Promise<any> {
    return this.request('tools/call', {
      name,
      arguments: args,
    });
  }

  async listResources(): Promise<any> {
    return this.request('resources/list');
  }

  async readResource(uri: string): Promise<any> {
    return this.request('resources/read', { uri });
  }

  async listPrompts(): Promise<any> {
    return this.request('prompts/list');
  }

  async getPrompt(name: string): Promise<any> {
    return this.request('prompts/get', { name });
  }
}

export async function validateWordPressConnection(
  wpBase: string,
  jwt: string,
): Promise<{
  valid: boolean;
  mcpResponse?: any;
  compat?: {
    ok: boolean;
    pluginVersion: string;
    minRequired: string;
    reason?: string | null;
  };
}> {
  try {
    // First, try to access WordPress site directly to check if it's reachable
    const siteCheckResponse = await fetch(wpBase, {
      method: 'HEAD',
      mode: 'no-cors',
    });

    // Try to validate the MCP endpoint exists via server-side proxy
    const response = await fetch('/api/mcp/connection/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wpBase: wpBase.replace(/\/$/, ''),
        jwt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Validation failed: ${response.status}`,
      );
    }

    const result = await response.json();
    console.log('Validation API response:', result);

    if (!result.valid) {
      throw new Error(result.message || 'Connection validation failed');
    }

    return {
      valid: true,
      mcpResponse: result.mcpResponse,
      compat: result.compat,
    };
  } catch (error) {
    console.error('WordPress connection validation failed:', error);

    // Provide more specific error information
    if (
      error instanceof TypeError &&
      error.message.includes('Failed to fetch')
    ) {
      throw new Error(
        'Network error: Unable to reach WordPress site. Check if the URL is correct and accessible.',
      );
    }

    throw error;
  }
}
