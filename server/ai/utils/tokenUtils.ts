/**
 * Token estimation and context management utilities.
 *
 * Provides heuristic-based token counting for context management
 * without requiring external tokenizer libraries.
 */

/**
 * Rough token estimation using character-based heuristic.
 * Claude models average ~4 characters per token for English text.
 * This is a conservative estimate (slightly overestimates).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  // Average ~4 chars per token, with some overhead for special characters
  return Math.ceil(text.length / 3.5)
}

/**
 * Estimate tokens for a message array.
 */
export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string }>
): number {
  let total = 0
  for (const msg of messages) {
    // Add overhead for role tags and message structure
    total += 4 // role/message overhead
    total += estimateTokens(msg.content)
  }
  return total
}

/**
 * Default context limits for different scenarios.
 *
 * These are intentionally RELAXED - Claude has 200K context.
 * Pruning should only happen for truly excessive content.
 */
export const CONTEXT_LIMITS = {
  /** Maximum context for research chat (leave room for response) */
  MAX_CONTEXT_TOKENS: 180000, // Claude has 200K, leave buffer
  /** Maximum tokens for a single tool result - very generous */
  MAX_TOOL_RESULT_TOKENS: 32000, // ~112K chars - rarely hit
  /** Ideal tool result size (not enforced, just informational) */
  IDEAL_TOOL_RESULT_TOKENS: 16000,
  /** Maximum tokens for chat history context - generous for long conversations */
  MAX_HISTORY_TOKENS: 50000, // ~175K chars - many conversation turns
  /** Target response buffer */
  RESPONSE_BUFFER_TOKENS: 4096,
}

/**
 * Truncate text to fit within token limit.
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number,
  suffix: string = '\n\n[...truncated]'
): string {
  const currentTokens = estimateTokens(text)
  if (currentTokens <= maxTokens) {
    return text
  }

  // Estimate character limit
  const charLimit = Math.floor(maxTokens * 3.5) - suffix.length
  return text.slice(0, charLimit) + suffix
}

/**
 * Prune messages to fit within token budget.
 * Keeps most recent messages while staying under limit.
 */
export function pruneMessagesToFit(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Array<{ role: string; content: string }> {
  const result: Array<{ role: string; content: string }> = []
  let tokenCount = 0

  // Process from newest to oldest
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const msgTokens = estimateTokens(msg.content) + 4 // overhead

    if (tokenCount + msgTokens > maxTokens) {
      break
    }

    result.unshift(msg)
    tokenCount += msgTokens
  }

  return result
}

/**
 * Prune tool result to reasonable size while keeping essential info.
 * Prioritizes keeping structured data (titles, authors, links).
 */
export function pruneToolResult(
  result: string,
  maxTokens: number = CONTEXT_LIMITS.MAX_TOOL_RESULT_TOKENS
): string {
  const currentTokens = estimateTokens(result)

  if (currentTokens <= maxTokens) {
    return result
  }

  // Try to preserve structure by keeping lines with key info
  const lines = result.split('\n')
  const priorityLines: string[] = []
  const otherLines: string[] = []

  for (const line of lines) {
    const lowerLine = line.toLowerCase()
    // Prioritize lines with key information
    if (
      lowerLine.includes('title:') ||
      lowerLine.includes('author') ||
      lowerLine.includes('year:') ||
      lowerLine.includes('url:') ||
      lowerLine.includes('link:') ||
      lowerLine.includes('citation') ||
      lowerLine.includes('abstract:') ||
      line.startsWith('##') ||
      line.startsWith('**')
    ) {
      priorityLines.push(line)
    } else {
      otherLines.push(line)
    }
  }

  // Build result prioritizing key info
  let prunedResult = priorityLines.join('\n')
  let tokens = estimateTokens(prunedResult)

  // Add other lines if we have room
  for (const line of otherLines) {
    const lineTokens = estimateTokens(line)
    if (tokens + lineTokens > maxTokens - 100) {
      break
    }
    prunedResult += '\n' + line
    tokens += lineTokens
  }

  if (estimateTokens(prunedResult) < currentTokens) {
    prunedResult += '\n\n[...results truncated for brevity]'
  }

  return prunedResult
}
