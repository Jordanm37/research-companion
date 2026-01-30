/**
 * Semantic Scholar MCP Client with Circuit Breaker
 *
 * Provides connection to the Semantic Scholar MCP server with:
 * - Circuit breaker pattern for resilience
 * - Automatic reconnection after failures
 * - Graceful degradation when service unavailable
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const SEMANTIC_SCHOLAR_MCP_URL = "https://server.smithery.ai/@hamid-vakilzadeh/mcpsemanticscholar";

// Circuit breaker configuration
const CIRCUIT_BREAKER = {
  /** Number of failures before opening circuit */
  FAILURE_THRESHOLD: 3,
  /** Time in ms before attempting to close circuit (5 minutes) */
  RESET_TIMEOUT: 5 * 60 * 1000,
  /** Time in ms between retry attempts when half-open */
  RETRY_DELAY: 30 * 1000,
};

let mcpClient: Client | null = null;
let isConnecting = false;
let availableTools: string[] = [];

// Circuit breaker state
let failureCount = 0;
let circuitState: 'closed' | 'open' | 'half-open' = 'closed';
let lastFailureTime: number | null = null;

/**
 * Check if circuit breaker should allow request.
 */
function shouldAllowRequest(): boolean {
  if (circuitState === 'closed') {
    return true;
  }

  if (circuitState === 'open') {
    // Check if enough time has passed to try again
    if (lastFailureTime && Date.now() - lastFailureTime > CIRCUIT_BREAKER.RESET_TIMEOUT) {
      circuitState = 'half-open';
      console.log('MCP circuit breaker: transitioning to half-open state');
      return true;
    }
    return false;
  }

  // half-open: allow one request to test
  return true;
}

/**
 * Record successful request - close circuit if it was half-open.
 */
function recordSuccess(): void {
  if (circuitState === 'half-open') {
    circuitState = 'closed';
    failureCount = 0;
    lastFailureTime = null;
    console.log('MCP circuit breaker: circuit closed after successful request');
  }
}

/**
 * Record failed request - potentially open circuit.
 */
function recordFailure(): void {
  failureCount++;
  lastFailureTime = Date.now();

  if (circuitState === 'half-open') {
    // Failed during test - reopen circuit
    circuitState = 'open';
    console.log('MCP circuit breaker: circuit re-opened after half-open failure');
  } else if (failureCount >= CIRCUIT_BREAKER.FAILURE_THRESHOLD) {
    circuitState = 'open';
    console.log(`MCP circuit breaker: circuit opened after ${failureCount} failures`);
  }
}

/**
 * Reset the MCP client connection (for manual reconnection).
 */
export function resetMcpConnection(): void {
  mcpClient = null;
  // Don't reset circuit breaker state - let it manage itself
}

/**
 * Get the current circuit breaker state (for monitoring).
 */
export function getCircuitState(): { state: string; failureCount: number; lastFailure: number | null } {
  return {
    state: circuitState,
    failureCount,
    lastFailure: lastFailureTime,
  };
}

export async function getSemanticScholarClient(): Promise<Client | null> {
  // Check circuit breaker first
  if (!shouldAllowRequest()) {
    console.log('MCP circuit breaker: request blocked (circuit open)');
    return null;
  }

  if (mcpClient) {
    return mcpClient;
  }

  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getSemanticScholarClient();
  }

  isConnecting = true;

  try {
    const transport = new StreamableHTTPClientTransport(
      new URL(SEMANTIC_SCHOLAR_MCP_URL)
    );

    const client = new Client({
      name: "research-reader",
      version: "1.0.0"
    });

    await client.connect(transport);
    mcpClient = client;

    const toolsResult = await client.listTools();
    availableTools = toolsResult.tools.map(t => t.name);
    console.log("Connected to Semantic Scholar MCP server");
    console.log("Available tools:", availableTools);

    recordSuccess();
    return client;
  } catch (error) {
    console.error("Failed to connect to Semantic Scholar MCP:", error);
    recordFailure();
    return null;
  } finally {
    isConnecting = false;
  }
}

export function isMcpAvailable(): boolean {
  return mcpClient !== null && circuitState !== 'open';
}

export function getMcpAvailableTools(): string[] {
  return availableTools;
}

export async function callSemanticScholarTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  const client = await getSemanticScholarClient();

  if (!client) {
    const retryTime = lastFailureTime
      ? Math.ceil((CIRCUIT_BREAKER.RESET_TIMEOUT - (Date.now() - lastFailureTime)) / 60000)
      : 5;
    return `Semantic Scholar search is temporarily unavailable (will retry in ~${retryTime} minutes). Please try again later or search manually at https://www.semanticscholar.org/`;
  }

  try {
    const result = await client.callTool({
      name: toolName,
      arguments: args
    });

    recordSuccess();

    if (result.content && Array.isArray(result.content)) {
      return result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map(c => c.text)
        .join("\n");
    }

    return JSON.stringify(result);
  } catch (error) {
    console.error(`Failed to call tool ${toolName}:`, error);
    recordFailure();

    // Reset client so next request tries fresh connection
    mcpClient = null;

    return `Error searching papers: ${error instanceof Error ? error.message : "Unknown error"}. Try searching manually at https://www.semanticscholar.org/`;
  }
}

export async function searchPapers(query: string, limit: number = 5): Promise<string> {
  return callSemanticScholarTool("search_papers", { query, limit });
}

export async function getPaperDetails(paperId: string): Promise<string> {
  return callSemanticScholarTool("get_paper_details", { paper_id: paperId });
}
