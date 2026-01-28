import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const SEMANTIC_SCHOLAR_MCP_URL = "https://server.smithery.ai/@hamid-vakilzadeh/mcpsemanticscholar";

let mcpClient: Client | null = null;
let isConnecting = false;

export async function getSemanticScholarClient(): Promise<Client> {
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
    console.log("Connected to Semantic Scholar MCP server");
    
    return client;
  } catch (error) {
    console.error("Failed to connect to Semantic Scholar MCP:", error);
    throw error;
  } finally {
    isConnecting = false;
  }
}

export async function listSemanticScholarTools(): Promise<string[]> {
  try {
    const client = await getSemanticScholarClient();
    const result = await client.listTools();
    return result.tools.map(t => t.name);
  } catch (error) {
    console.error("Failed to list tools:", error);
    return [];
  }
}

export async function callSemanticScholarTool(
  toolName: string, 
  args: Record<string, unknown>
): Promise<string> {
  try {
    const client = await getSemanticScholarClient();
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
    throw error;
  }
}

export async function searchPapers(query: string, limit: number = 5): Promise<string> {
  return callSemanticScholarTool("search_papers", { query, limit });
}

export async function getPaperDetails(paperId: string): Promise<string> {
  return callSemanticScholarTool("get_paper_details", { paper_id: paperId });
}

export async function getAuthorPapers(authorId: string): Promise<string> {
  return callSemanticScholarTool("get_author_papers", { author_id: authorId });
}
