/**
 * Research Chat Routes - Research chat with SSE streaming.
 *
 * Handles:
 * - GET /api/papers/:paperId/research-chat - Get chat history
 * - POST /api/papers/:paperId/research-chat - Send message (SSE streaming)
 * - DELETE /api/papers/:paperId/research-chat - Clear chat
 */

import { Router } from "express"
import { chatRepository, paperRepository } from "../repositories"
import { aiService, buildResearchQuery } from "../ai"
import { researchChatRequestSchema } from "@shared/validation"
import { matchCitationToReference } from "../referenceExtractor"
import {
  CONTEXT_LIMITS,
  estimateMessagesTokens,
} from "../ai/utils/tokenUtils"
import {
  applySlidingWindow,
  formatMessagesWithSummary,
} from "../ai/utils/conversationSummary"
import type { Reference, ResearchActionType } from "@shared/types"

const router = Router()

// ================================
// Type Definitions
// ================================

interface PaperParams {
  paperId: string
}

// ================================
// Routes
// ================================

/**
 * GET /papers/:paperId/research-chat
 * Get the chat history for a paper.
 */
router.get<PaperParams>("/papers/:paperId/research-chat", async (req, res) => {
  try {
    const messages = await chatRepository.findByPaperId(req.params.paperId)
    res.json(messages)
  } catch (error) {
    console.error("Error getting research chat:", error)
    res.status(500).json({ error: "Failed to get chat history" })
  }
})

/**
 * DELETE /papers/:paperId/research-chat
 * Clear the chat history for a paper.
 */
router.delete<PaperParams>("/papers/:paperId/research-chat", async (req, res) => {
  try {
    await chatRepository.clearByPaperId(req.params.paperId)
    res.json({ success: true })
  } catch (error) {
    console.error("Error clearing research chat:", error)
    res.status(500).json({ error: "Failed to clear chat history" })
  }
})

/**
 * POST /papers/:paperId/research-chat
 * Send a message and get an AI response with SSE streaming.
 *
 * Uses Anthropic's claude-sonnet-4-5 model with the agentic tool use pattern.
 * Supports Semantic Scholar search for finding academic papers.
 */
router.post<PaperParams>("/papers/:paperId/research-chat", async (req, res) => {
  try {
    const paperId = req.params.paperId
    const paper = await paperRepository.findById(paperId)
    if (!paper) {
      return res.status(404).json({ error: "Paper not found" })
    }

    const parseResult = researchChatRequestSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request", details: parseResult.error.issues })
    }

    const { query, selectedText, actionType } = parseResult.data

    // For paper_summary action, try to match citation to reference
    let matchedReference: Reference | null = null
    if (actionType === "paper_summary" && paper.references && selectedText) {
      matchedReference = matchCitationToReference(selectedText, paper.references)
      if (matchedReference) {
        console.log(
          `Matched citation "${selectedText}" to reference: ${matchedReference.rawText.slice(0, 100)}...`
        )
      }
    }

    // Build the user message with matched reference if available
    const userMessage = buildResearchQuery(
      actionType as ResearchActionType,
      selectedText || "",
      query,
      matchedReference
    )

    // Save user message to chat history
    await chatRepository.create({
      paperId,
      role: "user",
      content: userMessage,
      selectedText: selectedText || undefined,
      actionType: actionType as ResearchActionType,
    })

    // Get chat history with intelligent sliding window summarization
    const history = await chatRepository.findByPaperId(paperId)
    const rawMessages = history.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }))

    // Apply sliding window: keeps recent messages verbatim, summarizes older ones if needed
    const windowResult = applySlidingWindow(rawMessages, {
      keepRecentPairs: 5, // Keep last 5 exchanges (10 messages) verbatim
      summarizeThreshold: CONTEXT_LIMITS.MAX_HISTORY_TOKENS,
    })

    // Format with summary prefix if summarization was applied
    const contextMessages = formatMessagesWithSummary(windowResult)

    // Log context processing for monitoring
    if (windowResult.wasSummarized) {
      console.log(
        `Research chat: summarized ${windowResult.tokenCounts.summarizedCount} older messages. ` +
        `Tokens: ${windowResult.tokenCounts.original} -> ${windowResult.tokenCounts.afterProcessing}`
      )
    } else {
      const contextTokens = estimateMessagesTokens(contextMessages)
      console.log(
        `Research chat context: ${contextMessages.length} messages, ~${contextTokens} tokens`
      )
    }

    // Set up SSE (Server-Sent Events) response
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")

    // Send matched reference info first if available
    if (actionType === "paper_summary") {
      res.write(
        `data: ${JSON.stringify({
          matchedReference: matchedReference
            ? {
                rawText: matchedReference.rawText,
                authors: matchedReference.authors,
                year: matchedReference.year,
                title: matchedReference.title,
                index: matchedReference.index,
              }
            : null,
        })}\n\n`
      )
    }

    // Track full response for storage
    let fullResponse = ""

    try {
      // Use aiService for streaming research chat
      fullResponse = await aiService.streamResearchChat(
        {
          query,
          selectedText: selectedText || "",
          actionType: actionType as ResearchActionType,
          customQuery: query,
          matchedReference,
          contextMessages,
        },
        {
          onText: (text: string) => {
            res.write(`data: ${JSON.stringify({ content: text })}\n\n`)
          },
          onToolUse: (name: string, input: Record<string, unknown>) => {
            res.write(`data: ${JSON.stringify({ toolUse: { name, input } })}\n\n`)
          },
          onDone: () => {
            // Will be handled after the call completes
          },
          onError: (error: string) => {
            res.write(`data: ${JSON.stringify({ error })}\n\n`)
          },
        }
      )

      // Save assistant message to chat history
      await chatRepository.create({
        paperId,
        role: "assistant",
        content: fullResponse,
      })

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
      res.end()
    } catch (error) {
      console.error("Research chat streaming error:", error)
      res.write(`data: ${JSON.stringify({ error: "Failed to process request" })}\n\n`)
      res.end()
    }
  } catch (error) {
    console.error("Research chat error:", error)
    // Check if headers already sent (SSE streaming started)
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: "Failed to process request" })}\n\n`)
      res.end()
    } else {
      res.status(500).json({ error: "Failed to process research query" })
    }
  }
})

export default router
