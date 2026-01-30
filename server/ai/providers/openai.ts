/**
 * OpenAI provider implementation.
 *
 * Handles translation between our generic AI types and the OpenAI API.
 * Used primarily for note generation with gpt-4o-mini.
 */

import OpenAI from 'openai'
import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  OpenAIConfig,
} from '../types'

/**
 * Default model for OpenAI completions.
 */
const DEFAULT_MODEL = 'gpt-4o-mini'

/**
 * OpenAI provider implementing the AIProvider interface.
 */
export class OpenAIProvider implements AIProvider {
  private client: OpenAI
  private model: string

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    })
    this.model = config.model || DEFAULT_MODEL
  }

  /**
   * Perform a non-streaming completion request.
   *
   * Converts our generic format to OpenAI's format and back.
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Build messages array, inserting system message at the start if provided
    const messages: OpenAI.ChatCompletionMessageParam[] = []

    if (request.system) {
      messages.push({
        role: 'system',
        content: request.system,
      })
    }

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        messages.push({ role: 'system', content: msg.content })
      } else if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content })
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content })
      }
    }

    // Build tools if provided
    const tools: OpenAI.ChatCompletionTool[] | undefined = request.tools?.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }))

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      max_completion_tokens: request.maxTokens || 1024,
      tools: tools?.length ? tools : undefined,
    })

    const choice = response.choices[0]
    const message = choice?.message

    // Extract text content
    const content = message?.content || ''

    // Extract tool calls if present
    const toolCalls = message?.tool_calls?.map(tc => {
      // Handle both standard function calls and custom tool calls
      const funcCall = 'function' in tc ? tc.function : null
      return {
        id: tc.id,
        name: funcCall?.name || '',
        input: JSON.parse(funcCall?.arguments || '{}') as Record<string, unknown>,
      }
    })

    // Map finish reason to our stop reason
    let stopReason: CompletionResponse['stopReason'] = 'end_turn'
    if (choice?.finish_reason === 'tool_calls') {
      stopReason = 'tool_use'
    } else if (choice?.finish_reason === 'length') {
      stopReason = 'max_tokens'
    }

    return {
      content,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      stopReason,
    }
  }

  /**
   * Perform a streaming completion request.
   *
   * Yields StreamChunk objects as content arrives.
   */
  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    // Build messages array
    const messages: OpenAI.ChatCompletionMessageParam[] = []

    if (request.system) {
      messages.push({
        role: 'system',
        content: request.system,
      })
    }

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        messages.push({ role: 'system', content: msg.content })
      } else if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content })
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content })
      }
    }

    // Build tools if provided
    const tools: OpenAI.ChatCompletionTool[] | undefined = request.tools?.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }))

    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        max_completion_tokens: request.maxTokens || 1024,
        tools: tools?.length ? tools : undefined,
        stream: true,
      })

      // Track tool calls being built up from deltas
      const toolCallsInProgress: Map<number, { id: string; name: string; arguments: string }> =
        new Map()

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta

        // Handle text content
        if (delta?.content) {
          yield {
            type: 'text',
            content: delta.content,
          }
        }

        // Handle tool calls (streamed as deltas)
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index
            let existing = toolCallsInProgress.get(index)

            if (!existing) {
              existing = { id: tc.id || '', name: tc.function?.name || '', arguments: '' }
              toolCallsInProgress.set(index, existing)
            }

            if (tc.id) existing.id = tc.id
            if (tc.function?.name) existing.name = tc.function.name
            if (tc.function?.arguments) existing.arguments += tc.function.arguments
          }
        }

        // Check for finish
        if (chunk.choices[0]?.finish_reason) {
          // Emit any completed tool calls
          const toolCallEntries = Array.from(toolCallsInProgress.values())
          for (const tc of toolCallEntries) {
            try {
              const input = JSON.parse(tc.arguments || '{}') as Record<string, unknown>
              yield {
                type: 'tool_use',
                toolCall: {
                  id: tc.id,
                  name: tc.name,
                  input,
                },
              }
            } catch {
              // Skip malformed tool calls
            }
          }

          yield { type: 'done' }
          return
        }
      }

      yield { type: 'done' }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown OpenAI error',
      }
    }
  }
}

/**
 * Create an OpenAI provider from environment variables.
 */
export function createOpenAIProvider(): OpenAIProvider {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('AI_INTEGRATIONS_OPENAI_API_KEY environment variable is not set')
  }

  return new OpenAIProvider({
    apiKey,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  })
}
