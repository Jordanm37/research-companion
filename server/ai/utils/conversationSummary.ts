/**
 * Conversation Summarization Utilities
 *
 * Implements sliding window with summarization for long conversations.
 * Keeps recent messages verbatim while summarizing older context.
 */

import { estimateTokens } from './tokenUtils'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SlidingWindowResult {
  /** Summary of older messages (if any were summarized) */
  summary: string | null
  /** Recent messages kept verbatim */
  recentMessages: ConversationMessage[]
  /** Whether summarization was applied */
  wasSummarized: boolean
  /** Token counts for monitoring */
  tokenCounts: {
    original: number
    afterProcessing: number
    summarizedCount: number
  }
}

/**
 * Configuration for sliding window summarization.
 */
export interface SlidingWindowConfig {
  /** Number of recent message pairs to always keep verbatim */
  keepRecentPairs: number
  /** Token threshold before summarization kicks in */
  summarizeThreshold: number
  /** Maximum tokens for the summary */
  maxSummaryTokens: number
}

const DEFAULT_CONFIG: SlidingWindowConfig = {
  keepRecentPairs: 4, // Keep last 4 exchanges (8 messages)
  summarizeThreshold: 30000, // Only summarize if > 30K tokens
  maxSummaryTokens: 2000, // Summary should be concise
}

/**
 * Apply sliding window with summarization to conversation history.
 *
 * Strategy:
 * 1. If total tokens < threshold, return all messages unchanged
 * 2. Otherwise, keep N recent message pairs verbatim
 * 3. Summarize older messages into a context block
 */
export function applySlidingWindow(
  messages: ConversationMessage[],
  config: Partial<SlidingWindowConfig> = {}
): SlidingWindowResult {
  const { keepRecentPairs, summarizeThreshold, maxSummaryTokens } = {
    ...DEFAULT_CONFIG,
    ...config,
  }

  // Calculate total tokens
  const totalTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content) + 4,
    0
  )

  // If under threshold, return unchanged
  if (totalTokens <= summarizeThreshold) {
    return {
      summary: null,
      recentMessages: messages,
      wasSummarized: false,
      tokenCounts: {
        original: totalTokens,
        afterProcessing: totalTokens,
        summarizedCount: 0,
      },
    }
  }

  // Split into old and recent
  const keepCount = keepRecentPairs * 2 // 2 messages per pair (user + assistant)
  const splitIndex = Math.max(0, messages.length - keepCount)

  const oldMessages = messages.slice(0, splitIndex)
  const recentMessages = messages.slice(splitIndex)

  // If nothing to summarize, return recent only
  if (oldMessages.length === 0) {
    return {
      summary: null,
      recentMessages,
      wasSummarized: false,
      tokenCounts: {
        original: totalTokens,
        afterProcessing: recentMessages.reduce(
          (sum, msg) => sum + estimateTokens(msg.content) + 4,
          0
        ),
        summarizedCount: 0,
      },
    }
  }

  // Generate summary of old messages
  const summary = generateConversationSummary(oldMessages, maxSummaryTokens)

  const recentTokens = recentMessages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content) + 4,
    0
  )
  const summaryTokens = estimateTokens(summary)

  return {
    summary,
    recentMessages,
    wasSummarized: true,
    tokenCounts: {
      original: totalTokens,
      afterProcessing: recentTokens + summaryTokens,
      summarizedCount: oldMessages.length,
    },
  }
}

/**
 * Generate a summary of conversation messages.
 *
 * This is a heuristic-based summary (no LLM call).
 * For production, you could replace this with an LLM summarization call.
 */
function generateConversationSummary(
  messages: ConversationMessage[],
  maxTokens: number
): string {
  const summaryParts: string[] = ['[Previous conversation summary]']

  // Extract key topics discussed
  const topics = extractTopics(messages)
  if (topics.length > 0) {
    summaryParts.push(`Topics discussed: ${topics.join(', ')}`)
  }

  // Extract papers/citations mentioned
  const papers = extractMentionedPapers(messages)
  if (papers.length > 0) {
    summaryParts.push(`Papers mentioned: ${papers.slice(0, 5).join('; ')}`)
  }

  // Extract key questions asked
  const questions = extractQuestions(messages)
  if (questions.length > 0) {
    summaryParts.push(`Questions explored: ${questions.slice(0, 3).join('; ')}`)
  }

  // Add brief exchange summaries for important turns
  const exchangeSummaries = summarizeKeyExchanges(messages)
  if (exchangeSummaries.length > 0) {
    summaryParts.push('Key exchanges:')
    for (const ex of exchangeSummaries.slice(0, 3)) {
      summaryParts.push(`- ${ex}`)
    }
  }

  let summary = summaryParts.join('\n')

  // Truncate if too long
  if (estimateTokens(summary) > maxTokens) {
    const charLimit = maxTokens * 3.5
    summary = summary.slice(0, charLimit) + '\n[...summary truncated]'
  }

  return summary
}

/**
 * Extract main topics from messages using keyword analysis.
 */
function extractTopics(messages: ConversationMessage[]): string[] {
  const topicKeywords = new Map<string, number>()

  // Academic/research topic patterns
  const topicPatterns = [
    /(?:about|regarding|on|study|research|paper|analysis of)\s+([a-z\s]{3,30})/gi,
    /(?:machine learning|deep learning|neural network|transformer|attention)/gi,
    /(?:NLP|computer vision|reinforcement learning|generative|LLM)/gi,
  ]

  for (const msg of messages) {
    for (const pattern of topicPatterns) {
      // Reset pattern for each message
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(msg.content)) !== null) {
        const topic = (match[1] || match[0]).toLowerCase().trim()
        if (topic.length > 3 && topic.length < 40) {
          topicKeywords.set(topic, (topicKeywords.get(topic) || 0) + 1)
        }
      }
    }
  }

  // Return top topics by frequency
  return Array.from(topicKeywords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic)
}

/**
 * Extract paper titles/citations mentioned in messages.
 */
function extractMentionedPapers(messages: ConversationMessage[]): string[] {
  const papers: string[] = []

  const paperPatterns = [
    /[""]([^""]{10,100})[""].*?(?:\d{4})/g, // "Paper Title" (Year)
    /\*\*([^*]{10,100})\*\*/g, // **Paper Title**
    /(?:paper|study|work)\s+(?:by|from)\s+([A-Z][a-z]+(?:\s+et\s+al\.?)?)/gi,
  ]

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      for (const pattern of paperPatterns) {
        // Reset pattern for each message
        pattern.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = pattern.exec(msg.content)) !== null) {
          const paper = match[1].trim()
          if (!papers.includes(paper)) {
            papers.push(paper)
          }
        }
      }
    }
  }

  return papers
}

/**
 * Extract questions from user messages.
 */
function extractQuestions(messages: ConversationMessage[]): string[] {
  const questions: string[] = []

  for (const msg of messages) {
    if (msg.role === 'user') {
      // Look for question patterns
      const questionMatch = msg.content.match(/^[^.!]*\?/m)
      if (questionMatch) {
        const q = questionMatch[0].trim()
        if (q.length > 10 && q.length < 150) {
          questions.push(q)
        }
      }
    }
  }

  return questions
}

/**
 * Summarize key exchanges (user question + assistant response gist).
 */
function summarizeKeyExchanges(messages: ConversationMessage[]): string[] {
  const summaries: string[] = []

  for (let i = 0; i < messages.length - 1; i += 2) {
    const userMsg = messages[i]
    const assistantMsg = messages[i + 1]

    if (userMsg?.role === 'user' && assistantMsg?.role === 'assistant') {
      // Get first sentence of user message
      const userGist = userMsg.content.split(/[.!?]/)[0].slice(0, 80)

      // Get first sentence of assistant response
      const assistantGist = assistantMsg.content.split(/[.!?]/)[0].slice(0, 80)

      if (userGist && assistantGist) {
        summaries.push(`User asked about "${userGist}..." → Assistant discussed ${assistantGist}...`)
      }
    }
  }

  return summaries
}

/**
 * Format messages with optional summary prefix for the LLM.
 */
export function formatMessagesWithSummary(
  result: SlidingWindowResult
): ConversationMessage[] {
  if (!result.wasSummarized || !result.summary) {
    return result.recentMessages
  }

  // Prepend summary as a system-style context message
  const summaryMessage: ConversationMessage = {
    role: 'user',
    content: `${result.summary}\n\n---\n[Continuing from recent conversation:]`,
  }

  return [summaryMessage, ...result.recentMessages]
}
