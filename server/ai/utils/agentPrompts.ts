/**
 * Agent prompts and guidance utilities.
 *
 * Provides follow-up prompts and reminders to guide the agent
 * after tool calls for more effective responses.
 */

/**
 * Generate a follow-up prompt to guide the agent after tool results.
 * This helps the agent synthesize information and provide better responses.
 */
export function getToolResultFollowUp(
  toolName: string,
  resultSummary: { hasResults: boolean; resultCount?: number; error?: string }
): string {
  if (resultSummary.error) {
    return `The ${toolName} search encountered an issue. Please acknowledge the limitation and provide what help you can based on your knowledge.`
  }

  if (!resultSummary.hasResults) {
    return `No results were found. Consider:
1. Suggesting alternative search terms
2. Providing general knowledge about the topic
3. Asking the user for clarification on what they're looking for`
  }

  switch (toolName) {
    case 'search_papers':
      return `You found ${resultSummary.resultCount || 'some'} papers. Now:
1. Summarize the most relevant findings for the user's question
2. Highlight key papers with their Semantic Scholar links
3. Note any patterns or themes across the results
4. If the user was looking for a specific paper, indicate whether it was found`

    case 'get_paper_details':
      return `You retrieved paper details. Now:
1. Summarize the paper's main contribution and methodology
2. Highlight the citation count and key authors
3. Explain how this relates to the user's original question
4. Mention any related papers if relevant`

    default:
      return `Synthesize these results into a helpful response for the user. Focus on the most relevant information.`
  }
}

/**
 * Check if tool result contains meaningful data.
 */
export function analyzeToolResult(result: string): {
  hasResults: boolean
  resultCount?: number
  error?: string
} {
  const lowerResult = result.toLowerCase()

  // Check for errors
  if (
    lowerResult.includes('error') ||
    lowerResult.includes('unavailable') ||
    lowerResult.includes('failed')
  ) {
    return { hasResults: false, error: result.slice(0, 200) }
  }

  // Check for no results
  if (
    lowerResult.includes('no results') ||
    lowerResult.includes('no papers found') ||
    lowerResult.includes('not found') ||
    result.trim().length < 50
  ) {
    return { hasResults: false }
  }

  // Count results (look for numbered items or paper titles)
  const paperMatches = result.match(/\d+\.\s+\*\*|Title:/gi)
  const resultCount = paperMatches?.length || undefined

  return { hasResults: true, resultCount }
}

/**
 * System prompt addition for better tool use behavior.
 */
export const TOOL_USE_GUIDANCE = `
IMPORTANT TOOL USE GUIDELINES:
- When you receive tool results, synthesize them into a clear, helpful response
- Always include Semantic Scholar links when you find papers
- If a search returns many results, prioritize the most relevant 3-5
- If no results are found, suggest alternative approaches or search terms
- Be honest about limitations - if you couldn't find exactly what was asked, say so
- After presenting results, ask if the user wants more details on any specific paper`
