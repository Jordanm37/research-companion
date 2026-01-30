/**
 * Semantic Scholar tool definitions and execution.
 *
 * Provides tool definitions for the AI and handles execution
 * via the Semantic Scholar MCP server.
 */

import type { ToolDefinition } from '../types'
import { searchPapers, getPaperDetails } from '../../semanticScholarMcp'

/**
 * Tool definitions for Semantic Scholar integration.
 * These are provided to the AI so it can search for academic papers.
 */
export const semanticScholarTools: ToolDefinition[] = [
  {
    name: 'search_papers',
    description:
      'Search Semantic Scholar for academic papers. Returns paper titles, authors, abstracts, citation counts, and links.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query - can include paper titles, author names, or topics',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_paper_details',
    description: 'Get detailed information about a specific paper by its Semantic Scholar ID.',
    inputSchema: {
      type: 'object',
      properties: {
        paper_id: {
          type: 'string',
          description: 'Semantic Scholar paper ID',
        },
      },
      required: ['paper_id'],
    },
  },
]

/**
 * Execute a Semantic Scholar tool by name.
 *
 * @param name - The tool name to execute
 * @param input - The input parameters for the tool
 * @returns The tool result as a string
 */
export async function executeSemanticScholarTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case 'search_papers':
      return searchPapers(input.query as string, (input.limit as number) || 5)

    case 'get_paper_details':
      return getPaperDetails(input.paper_id as string)

    default:
      return `Unknown tool: ${name}`
  }
}

/**
 * Check if a tool name is a known Semantic Scholar tool.
 */
export function isSemanticScholarTool(name: string): boolean {
  return semanticScholarTools.some(tool => tool.name === name)
}
