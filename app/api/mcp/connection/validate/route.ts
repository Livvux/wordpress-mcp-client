import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { wpBase, jwt } = await request.json();
    console.log('Validating WordPress connection:', { wpBase, jwtLength: jwt?.length });

    if (!wpBase || !jwt) {
      console.log('Missing required parameters');
      return NextResponse.json(
        { valid: false, message: 'Missing WordPress base URL or JWT token' },
        { status: 400 }
      );
    }

    // Normalize the WordPress base URL
    const normalizedWpBase = wpBase.replace(/\/$/, '');
    const mcpEndpoint = `${normalizedWpBase}/wp-json/wp/v2/wpmcp/streamable`;

    // Create the MCP initialize request
    const mcpRequest = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'initialize',
      params: {
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
      },
    };

    // Make the request to WordPress MCP endpoint
    console.log('Making request to:', mcpEndpoint);
    const response = await fetch(mcpEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify(mcpRequest),
    });

    console.log('Response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      // Try to get more specific error information
      try {
        const errorText = await response.text();
        console.log('Error response body:', errorText);
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      } catch {
        // Ignore if we can't read the error text
      }

      return NextResponse.json(
        { 
          valid: false, 
          message: `Failed to connect to WordPress MCP endpoint: ${errorMessage}`,
          details: {
            endpoint: mcpEndpoint,
            status: response.status,
            statusText: response.statusText
          }
        },
        { status: 200 }
      );
    }

    // Parse the MCP response
    const mcpResponse = await response.json();

    if (mcpResponse.error) {
      return NextResponse.json(
        { 
          valid: false, 
          message: `MCP Error: ${mcpResponse.error.message || 'Unknown MCP error'}`,
          details: mcpResponse.error
        },
        { status: 200 }
      );
    }

    // If we get here, the connection is valid
    return NextResponse.json({ 
      valid: true, 
      message: 'Successfully connected to WordPress MCP',
      mcpResponse: mcpResponse.result 
    });

  } catch (error) {
    console.error('WordPress connection validation error:', error);
    
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Check for specific error types
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
      errorMessage = 'Unable to reach WordPress site. Check if the URL is correct and the site is accessible.';
    } else if (errorMessage.includes('ETIMEDOUT')) {
      errorMessage = 'Connection timeout. The WordPress site may be slow to respond.';
    } else if (errorMessage.includes('fetch')) {
      errorMessage = 'Network error while connecting to WordPress site.';
    }

    return NextResponse.json(
      { 
        valid: false, 
        message: errorMessage,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 200 }
    );
  }
}