import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const SEMANTIC_SCHOLAR_MCP_URL = "https://server.smithery.ai/@hamid-vakilzadeh/mcpsemanticscholar";

let mcpClient: Client | null = null;
let isConnecting = false;
let connectionFailed = false;
let availableTools: string[] = [];

export async function getSemanticScholarClient(): Promise<Client | null> {
  if (connectionFailed) {
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
    
    return client;
  } catch (error) {
    console.error("Failed to connect to Semantic Scholar MCP:", error);
    connectionFailed = true;
    return null;
  } finally {
    isConnecting = false;
  }
}

export function isMcpAvailable(): boolean {
  return mcpClient !== null && !connectionFailed;
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
    return `Semantic Scholar search is temporarily unavailable. Please try again later or search manually at https://www.semanticscholar.org/`;
  }

  try {
    const result = await client.callTool({
      name: toolName,
      arguments: args
    });
    
    if (result.content && Array.isArray(result.content)) {
      return result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map(c => c.text)
        .join("\n");
    }
    
    return JSON.stringify(result);
  } catch (error) {
    console.error(`Failed to call tool ${toolName}:`, error);
    return `Error searching papers: ${error instanceof Error ? error.message : "Unknown error"}. Try searching manually at https://www.semanticscholar.org/`;
  }
}

export async function searchPapers(query: string, limit: number = 5): Promise<string> {
  return callSemanticScholarTool("search_papers", { query, limit });
}

export async function getPaperDetails(paperId: string): Promise<string> {
  return callSemanticScholarTool("get_paper_details", { paper_id: paperId });
}
