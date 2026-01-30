/**
 * Core interfaces and types for the AI abstraction layer.
 *
 * This module defines provider-agnostic types that allow switching
 * between different AI backends (OpenAI, Anthropic, etc.) without
 * changing business logic.
 */

// ================================
// Message Types
// ================================

/**
 * A message in a completion conversation.
 * Uses standard role names that map to both OpenAI and Anthropic APIs.
 */
export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// ================================
// Tool Types
// ================================

/**
 * Definition of a tool that the AI can use.
 * Compatible with both OpenAI function calling and Anthropic tool use.
 */
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/**
 * A tool call requested by the AI.
 */
export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

/**
 * Result of executing a tool call.
 */
export interface ToolResult {
  toolUseId: string
  content: string
}

// ================================
// Request/Response Types
// ================================

/**
 * Request for an AI completion.
 */
export interface CompletionRequest {
  messages: CompletionMessage[]
  maxTokens?: number
  tools?: ToolDefinition[]
  system?: string
}

/**
 * Response from an AI completion (non-streaming).
 */
export interface CompletionResponse {
  content: string
  toolCalls?: ToolCall[]
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens'
}

/**
 * A chunk from a streaming response.
 */
export interface StreamChunk {
  type: 'text' | 'tool_use' | 'done' | 'error'
  content?: string
  toolCall?: ToolCall
  error?: string
}

// ================================
// Provider Interface
// ================================

/**
 * Interface that all AI providers must implement.
 *
 * Providers handle the translation between our generic types
 * and the specific API formats of each AI service.
 */
export interface AIProvider {
  /**
   * Perform a non-streaming completion request.
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>

  /**
   * Perform a streaming completion request.
   * Yields chunks as they arrive from the provider.
   */
  stream(request: CompletionRequest): AsyncGenerator<StreamChunk>
}

// ================================
// Provider Configuration
// ================================

/**
 * Configuration for OpenAI provider.
 */
export interface OpenAIConfig {
  apiKey: string
  baseURL?: string
  model?: string
}

/**
 * Configuration for Anthropic provider.
 */
export interface AnthropicConfig {
  apiKey: string
  baseURL?: string
  model?: string
}

// ================================
// High-Level Service Types
// ================================

/**
 * Request for the research chat feature.
 */
export interface ResearchChatServiceRequest {
  paperId: string
  query: string
  selectedText?: string
  actionType: string
  customQuery?: string
  matchedReference?: {
    rawText: string
    authors?: string
    year?: string
    title?: string
    index: number
  } | null
  contextMessages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

/**
 * Callback for streaming chunks to the client.
 */
export type StreamCallback = (chunk: StreamChunk) => void

/**
 * Callback for tool use notifications.
 */
export type ToolUseCallback = (toolName: string, input: Record<string, unknown>) => void
