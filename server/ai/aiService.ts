/**
 * AI Service - Unified interface for AI operations.
 *
 * Provides high-level methods for AI features while abstracting
 * away provider-specific details. This is the main entry point
 * for AI operations in the application.
 */

import type { AIProvider, CompletionRequest, StreamChunk, ToolResult } from './types'
import type { AIActionType, ResearchActionType, Reference } from '@shared/types'
import { createOpenAIProvider, OpenAIProvider } from './providers/openai'
import { createAnthropicProvider, AnthropicProvider } from './providers/anthropic'
import { buildNotePrompt, buildNoteContext } from './prompts/noteGeneration'
import { getResearchSystemPrompt, buildResearchQuery } from './prompts/research'
import { semanticScholarTools, executeSemanticScholarTool } from './tools/semanticScholar'
import { pruneToolResult, estimateTokens } from './utils/tokenUtils'
import { analyzeToolResult, getToolResultFollowUp } from './utils/agentPrompts'
import { processToolResult } from './utils/structuredExtraction'

// ================================
// Provider Singletons
// ================================

let openaiProvider: OpenAIProvider | null = null
let anthropicProvider: AnthropicProvider | null = null

/**
 * Get or create the OpenAI provider instance.
 */
function getOpenAIProvider(): OpenAIProvider {
  if (!openaiProvider) {
    openaiProvider = createOpenAIProvider()
  }
  return openaiProvider
}

/**
 * Get or create the Anthropic provider instance.
 */
function getAnthropicProvider(): AnthropicProvider {
  if (!anthropicProvider) {
    anthropicProvider = createAnthropicProvider()
  }
  return anthropicProvider
}

// ================================
// Service Interface
// ================================

/**
 * Input for note generation.
 */
export interface GenerateNoteInput {
  actionType: AIActionType
  annotations: Array<{ quotedText?: string | null; comment?: string | null } | null>
  notes: Array<{ content?: string | null; noteType?: string | null } | null>
}

/**
 * Output from note generation.
 */
export interface GenerateNoteOutput {
  text: string
  provenance: string
}

/**
 * Input for research chat.
 */
export interface ResearchChatInput {
  query: string
  selectedText: string
  actionType: ResearchActionType
  customQuery?: string
  matchedReference?: Reference | null
  contextMessages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

/**
 * Callback for streaming research chat.
 */
export interface ResearchChatCallbacks {
  onText?: (text: string) => void
  onToolUse?: (name: string, input: Record<string, unknown>) => void
  onMatchedReference?: (ref: Reference | null) => void
  onDone?: () => void
  onError?: (error: string) => void
}

// ================================
// AI Service
// ================================

/**
 * The unified AI service.
 *
 * Provides methods for different AI features, handling provider
 * selection and configuration internally.
 */
export const aiService = {
  /**
   * Get the provider for note generation (OpenAI).
   */
  getNoteProvider(): AIProvider {
    return getOpenAIProvider()
  },

  /**
   * Get the provider for research chat (Anthropic).
   */
  getResearchProvider(): AIProvider {
    return getAnthropicProvider()
  },

  /**
   * Generate a note from annotations and existing notes.
   *
   * Uses OpenAI's gpt-4o-mini model.
   *
   * @param input - The note generation input
   * @returns The generated note and provenance
   */
  async generateNote(input: GenerateNoteInput): Promise<GenerateNoteOutput> {
    const { actionType, annotations, notes } = input

    // Build context from annotations and notes
    const context = buildNoteContext(annotations, notes)

    // Build prompt messages
    const messages = buildNotePrompt(actionType, context)

    // Get response from OpenAI
    const provider = getOpenAIProvider()
    const response = await provider.complete({
      messages,
      maxTokens: 1024,
    })

    return {
      text: response.content,
      provenance: `openai-${actionType}`,
    }
  },

  /**
   * Stream a research chat response with tool use.
   *
   * Uses Anthropic's claude-sonnet-4-5 model with the agentic loop pattern.
   *
   * @param input - The research chat input
   * @param callbacks - Callbacks for streaming output
   * @returns The complete response text
   */
  async streamResearchChat(
    input: ResearchChatInput,
    callbacks: ResearchChatCallbacks
  ): Promise<string> {
    const { query, selectedText, actionType, customQuery, matchedReference, contextMessages } =
      input

    // Notify about matched reference if provided
    if (actionType === 'paper_summary') {
      callbacks.onMatchedReference?.(matchedReference || null)
    }

    // Build the user message
    const userMessage = buildResearchQuery(actionType, selectedText, customQuery, matchedReference)

    // Build messages array
    const messages = [
      ...contextMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage },
    ]

    // Get provider
    const provider = getAnthropicProvider()

    // Execute with tool use loop
    try {
      const response = await provider.completeWithTools(
        {
          messages,
          system: getResearchSystemPrompt(),
          tools: semanticScholarTools,
          maxTokens: 4096,
        },
        // Tool execution function with intelligent extraction and follow-up guidance
        async calls => {
          const results: ToolResult[] = []
          for (const call of calls) {
            try {
              const rawResult = await executeSemanticScholarTool(call.name, call.input)
              const originalTokens = estimateTokens(rawResult)

              // Step 1: Try structured extraction (most intelligent)
              let processedResult = processToolResult(call.name, rawResult)

              // Step 2: If still too large, apply token pruning as fallback
              const afterExtractionTokens = estimateTokens(processedResult)
              if (afterExtractionTokens > 32000) {
                processedResult = pruneToolResult(processedResult)
              }

              const finalTokens = estimateTokens(processedResult)
              if (finalTokens < originalTokens * 0.9) {
                console.log(
                  `Tool result optimized for ${call.name}: ${originalTokens} -> ${finalTokens} tokens`
                )
              }

              // Analyze result and add follow-up guidance
              const analysis = analyzeToolResult(processedResult)
              const followUp = getToolResultFollowUp(call.name, analysis)

              // Append follow-up guidance to help agent synthesize results
              const resultWithGuidance = `${processedResult}\n\n---\n[System guidance]: ${followUp}`

              results.push({
                toolUseId: call.id,
                content: resultWithGuidance,
              })
            } catch (error) {
              results.push({
                toolUseId: call.id,
                content: `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}. Please acknowledge this limitation and provide what help you can.`,
              })
            }
          }
          return results
        },
        // Text callback
        callbacks.onText,
        // Tool use callback
        callbacks.onToolUse
      )

      callbacks.onDone?.()
      return response
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      callbacks.onError?.(errorMessage)
      throw error
    }
  },

  /**
   * Get tool definitions for research chat.
   *
   * Can be used if you need direct access to tool definitions.
   */
  getResearchTools() {
    return semanticScholarTools
  },
}

// ================================
// Utility Exports
// ================================

export { buildResearchQuery, getResearchSystemPrompt }
export { buildNotePrompt, buildNoteContext }
export { semanticScholarTools, executeSemanticScholarTool }
