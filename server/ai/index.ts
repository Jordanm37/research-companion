/**
 * AI Module - Barrel exports.
 *
 * This is the main entry point for AI functionality.
 * Import from here rather than internal modules.
 */

// ================================
// Types
// ================================

export type {
  CompletionMessage,
  ToolDefinition,
  ToolCall,
  ToolResult,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  AIProvider,
  OpenAIConfig,
  AnthropicConfig,
  ResearchChatServiceRequest,
  StreamCallback,
  ToolUseCallback,
} from './types'

// ================================
// Providers
// ================================

export { OpenAIProvider, createOpenAIProvider } from './providers/openai'
export { AnthropicProvider, createAnthropicProvider } from './providers/anthropic'

// ================================
// Prompts
// ================================

export {
  getNoteSystemPrompt,
  buildNoteUserPrompt,
  buildNotePrompt,
  buildNoteContext,
} from './prompts/noteGeneration'

export { getResearchSystemPrompt, buildResearchQuery } from './prompts/research'

// ================================
// Tools
// ================================

export {
  semanticScholarTools,
  executeSemanticScholarTool,
  isSemanticScholarTool,
} from './tools/semanticScholar'

// ================================
// Service
// ================================

export {
  aiService,
  type GenerateNoteInput,
  type GenerateNoteOutput,
  type ResearchChatInput,
  type ResearchChatCallbacks,
} from './aiService'
