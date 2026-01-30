/**
 * Note generation prompts for the AI assistant.
 *
 * These prompts are used with OpenAI's gpt-4o-mini model
 * to generate various types of notes from paper excerpts.
 */

import type { CompletionMessage } from '../types'
import type { AIActionType } from '@shared/types'

/**
 * System prompt for note generation.
 * Defines the AI's role and expected output style.
 */
export function getNoteSystemPrompt(): string {
  return `You are an academic research assistant. Provide clear, well-structured responses that help researchers analyze and understand their papers. Keep responses concise but insightful.`
}

/**
 * Build a user prompt for the given action type and context.
 *
 * @param actionType - The type of note to generate (summarize, critique, etc.)
 * @param context - The assembled context from annotations and notes
 * @returns The formatted user prompt
 */
export function buildNoteUserPrompt(actionType: AIActionType, context: string): string {
  const prompts: Record<AIActionType, string> = {
    summarize: `Please provide a concise academic summary of the following excerpts and notes from a research paper:\n\n${context}\n\nSummary:`,
    critique: `Please analyze the following excerpts and notes from a research paper, identifying strengths, weaknesses, and potential issues:\n\n${context}\n\nCritique:`,
    question: `Based on the following excerpts and notes from a research paper, generate insightful research questions that could guide further investigation:\n\n${context}\n\nResearch Questions:`,
    connect: `Based on the following excerpts and notes, identify potential connections to other concepts, theories, or research areas:\n\n${context}\n\nConnections:`,
    expand: `Please elaborate on the key points in the following excerpts and notes, providing additional context and explanation:\n\n${context}\n\nExpanded Analysis:`,
  }

  return prompts[actionType] || prompts.summarize
}

/**
 * Build complete messages array for note generation.
 *
 * @param actionType - The type of note to generate
 * @param context - The assembled context from annotations and notes
 * @returns Array of messages ready for completion API
 */
export function buildNotePrompt(actionType: AIActionType, context: string): CompletionMessage[] {
  return [
    {
      role: 'system',
      content: getNoteSystemPrompt(),
    },
    {
      role: 'user',
      content: buildNoteUserPrompt(actionType, context),
    },
  ]
}

/**
 * Build context string from annotations and notes.
 *
 * @param annotations - Array of annotation objects (from storage)
 * @param notes - Array of note objects (from storage)
 * @returns Formatted context string
 */
export function buildNoteContext(
  annotations: Array<{ quotedText?: string | null; comment?: string | null } | null>,
  notes: Array<{ content?: string | null; noteType?: string | null } | null>
): string {
  const contextParts: string[] = []

  annotations.filter(Boolean).forEach((ann, i) => {
    if (ann?.quotedText) {
      contextParts.push(`[Excerpt ${i + 1}]: "${ann.quotedText}"`)
      if (ann.comment) {
        contextParts.push(`  Comment: ${ann.comment}`)
      }
    }
  })

  notes.filter(Boolean).forEach((note, i) => {
    if (note?.content) {
      contextParts.push(`[Note ${i + 1} - ${note.noteType}]: ${note.content}`)
    }
  })

  return contextParts.join('\n\n')
}
