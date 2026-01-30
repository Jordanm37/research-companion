/**
 * Anthropic provider implementation.
 *
 * Handles translation between our generic AI types and the Anthropic API.
 * Used for research chat with claude-sonnet-4-5, supporting tool use.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  AnthropicConfig,
  ToolResult,
} from '../types'

/**
 * Default model for Anthropic completions.
 */
const DEFAULT_MODEL = 'claude-sonnet-4-5'

/**
 * Anthropic provider implementing the AIProvider interface.
 */
export class AnthropicProvider implements AIProvider {
  private client: Anthropic
  private model: string

  constructor(config: AnthropicConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    })
    this.model = config.model || DEFAULT_MODEL
  }

  /**
   * Get the underlying Anthropic client for advanced use cases.
   */
  getClient(): Anthropic {
    return this.client
  }

  /**
   * Perform a non-streaming completion request.
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Build messages array (Anthropic uses separate system parameter)
    const messages: Anthropic.MessageParam[] = []

    for (const msg of request.messages) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content })
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content })
      }
      // System messages are handled via the system parameter
    }

    // Extract system prompt from messages or use provided system
    let systemPrompt = request.system
    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${msg.content}` : msg.content
      }
    }

    // Build tools if provided
    const tools: Anthropic.Tool[] | undefined = request.tools?.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
    }))

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens || 4096,
      system: systemPrompt,
      messages,
      tools,
    })

    // Extract content and tool calls
    let content = ''
    const toolCalls: CompletionResponse['toolCalls'] = []

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        })
      }
    }

    // Map stop reason
    let stopReason: CompletionResponse['stopReason'] = 'end_turn'
    if (response.stop_reason === 'tool_use') {
      stopReason = 'tool_use'
    } else if (response.stop_reason === 'max_tokens') {
      stopReason = 'max_tokens'
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason,
    }
  }

  /**
   * Perform a streaming completion request.
   */
  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    // Build messages array
    const messages: Anthropic.MessageParam[] = []

    for (const msg of request.messages) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content })
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content })
      }
    }

    // Extract system prompt
    let systemPrompt = request.system
    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${msg.content}` : msg.content
      }
    }

    // Build tools if provided
    const tools: Anthropic.Tool[] | undefined = request.tools?.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
    }))

    try {
      const stream = await this.client.messages.stream({
        model: this.model,
        max_tokens: request.maxTokens || 4096,
        system: systemPrompt,
        messages,
        tools,
      })

      // Track current tool use being built
      let currentToolId: string | null = null
      let currentToolName: string | null = null
      let currentToolInput = ''

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          const block = event.content_block
          if (block.type === 'tool_use') {
            currentToolId = block.id
            currentToolName = block.name
            currentToolInput = ''
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta
          if (delta.type === 'text_delta') {
            yield {
              type: 'text',
              content: delta.text,
            }
          } else if (delta.type === 'input_json_delta') {
            currentToolInput += delta.partial_json
          }
        } else if (event.type === 'content_block_stop') {
          // Emit completed tool call
          if (currentToolId && currentToolName) {
            try {
              const input = currentToolInput
                ? (JSON.parse(currentToolInput) as Record<string, unknown>)
                : {}
              yield {
                type: 'tool_use',
                toolCall: {
                  id: currentToolId,
                  name: currentToolName,
                  input,
                },
              }
            } catch {
              // Skip malformed tool inputs
            }
            currentToolId = null
            currentToolName = null
            currentToolInput = ''
          }
        } else if (event.type === 'message_stop') {
          yield { type: 'done' }
          return
        }
      }

      yield { type: 'done' }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown Anthropic error',
      }
    }
  }

  /**
   * Perform an agentic completion with tool use loop.
   *
   * This method handles the full agentic pattern:
   * 1. Send request to AI
   * 2. If AI requests tool use, execute tools
   * 3. Send tool results back to AI
   * 4. Repeat until AI gives final response or max iterations
   *
   * @param request - The initial completion request
   * @param executeTools - Function to execute tool calls and return results
   * @param onText - Callback for text chunks (for streaming to client)
   * @param onToolUse - Callback when tool use is requested
   * @param maxIterations - Maximum tool use loops (default: 5)
   * @returns The accumulated text response
   */
  async completeWithTools(
    request: CompletionRequest,
    executeTools: (calls: Array<{ id: string; name: string; input: Record<string, unknown> }>) => Promise<ToolResult[]>,
    onText?: (text: string) => void,
    onToolUse?: (name: string, input: Record<string, unknown>) => void,
    maxIterations: number = 5
  ): Promise<string> {
    let fullResponse = ''
    let iterations = 0

    // Build initial messages
    const messages: Anthropic.MessageParam[] = []

    for (const msg of request.messages) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content })
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content })
      }
    }

    // Extract system prompt
    let systemPrompt = request.system
    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${msg.content}` : msg.content
      }
    }

    // Build tools
    const tools: Anthropic.Tool[] | undefined = request.tools?.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
    }))

    while (iterations < maxIterations) {
      iterations++

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens || 4096,
        system: systemPrompt,
        messages,
        tools,
      })

      // Process response content
      let hasToolUse = false
      const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = []

      for (const block of response.content) {
        if (block.type === 'text') {
          fullResponse += block.text
          onText?.(block.text)
        } else if (block.type === 'tool_use') {
          hasToolUse = true
          const call = {
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          }
          toolCalls.push(call)
          onToolUse?.(block.name, call.input)
        }
      }

      // If there were tool uses, execute them and continue
      if (hasToolUse && toolCalls.length > 0) {
        const toolResults = await executeTools(toolCalls)

        // Add assistant response and tool results to messages
        messages.push({
          role: 'assistant',
          content: response.content,
        })
        messages.push({
          role: 'user',
          content: toolResults.map(result => ({
            type: 'tool_result' as const,
            tool_use_id: result.toolUseId,
            content: result.content,
          })),
        })
      }

      // If stop_reason is "end_turn" or no tool use, we're done
      if (response.stop_reason === 'end_turn' || !hasToolUse) {
        break
      }
    }

    return fullResponse
  }
}

/**
 * Create an Anthropic provider from environment variables.
 */
export function createAnthropicProvider(): AnthropicProvider {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('AI_INTEGRATIONS_ANTHROPIC_API_KEY environment variable is not set')
  }

  return new AnthropicProvider({
    apiKey,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  })
}
