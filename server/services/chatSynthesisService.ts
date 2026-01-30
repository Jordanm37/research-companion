/**
 * Chat Synthesis Service - Generates summaries of research chat conversations
 *
 * This service takes a conversation thread and produces a synthesized summary
 * of the key insights, findings, and information discovered during the chat.
 */

import { aiService } from "../ai/aiService"
import type { ResearchChatMessage } from "@shared/types"
import type { CompletionMessage } from "../ai/types"

export interface ChatSynthesis {
  summary: string
  keyInsights: string[]
  papersDiscovered: string[]
  questionsExplored: string[]
}

const SYNTHESIS_PROMPT = `You are a research assistant helping to synthesize a conversation about an academic paper.

Given the following conversation thread between a user and an AI assistant about a research paper, create a concise synthesis that captures:

1. **Summary**: A 2-3 sentence overview of what was discussed
2. **Key Insights**: The most important findings or clarifications from the conversation (bullet points)
3. **Papers Discovered**: Any related papers or citations that were found or discussed (if any)
4. **Questions Explored**: The main questions or topics the user investigated

Format your response as JSON:
{
  "summary": "...",
  "keyInsights": ["...", "..."],
  "papersDiscovered": ["...", "..."],
  "questionsExplored": ["...", "..."]
}

Be concise and focus on substantive content. If a category has no relevant items, use an empty array.`

export const chatSynthesisService = {
  /**
   * Generate a synthesis of a research chat conversation
   */
  async synthesize(messages: ResearchChatMessage[]): Promise<ChatSynthesis> {
    if (messages.length === 0) {
      return {
        summary: "No conversation to synthesize.",
        keyInsights: [],
        papersDiscovered: [],
        questionsExplored: [],
      }
    }

    // Format messages for the prompt
    const conversationText = messages
      .map((msg) => {
        const role = msg.role === "user" ? "User" : "Assistant"
        const context = msg.selectedText ? `\n[Context: "${msg.selectedText.slice(0, 200)}${msg.selectedText.length > 200 ? "..." : ""}"]` : ""
        return `${role}:${context}\n${msg.content}`
      })
      .join("\n\n---\n\n")

    try {
      // Use the note provider (OpenAI) for synthesis
      const provider = aiService.getNoteProvider()
      const messages: CompletionMessage[] = [
        { role: "system", content: SYNTHESIS_PROMPT },
        { role: "user", content: conversationText },
      ]

      const response = await provider.complete({
        messages,
        maxTokens: 1000,
      })

      // Parse the JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          summary: parsed.summary || "Could not generate summary.",
          keyInsights: parsed.keyInsights || [],
          papersDiscovered: parsed.papersDiscovered || [],
          questionsExplored: parsed.questionsExplored || [],
        }
      }

      // Fallback if JSON parsing fails
      return {
        summary: response.content,
        keyInsights: [],
        papersDiscovered: [],
        questionsExplored: [],
      }
    } catch (error) {
      console.error("Chat synthesis error:", error)
      return {
        summary: "Could not generate synthesis due to an error.",
        keyInsights: [],
        papersDiscovered: [],
        questionsExplored: [],
      }
    }
  },

  /**
   * Generate a simple markdown summary of the conversation
   * (non-AI version for when AI is unavailable)
   */
  generateSimpleSummary(messages: ResearchChatMessage[]): string {
    if (messages.length === 0) {
      return "No research chat history."
    }

    const userMessages = messages.filter((m) => m.role === "user")
    const topics = userMessages
      .filter((m) => m.actionType)
      .map((m) => {
        const actionLabels: Record<string, string> = {
          find_similar: "Finding similar papers",
          explore_topic: "Exploring topic",
          ask_question: "Question about text",
          custom_query: "Custom query",
          paper_summary: "Paper summary request",
        }
        return actionLabels[m.actionType!] || m.actionType
      })

    const uniqueTopics = Array.from(new Set(topics))

    return `**Research Chat Summary**\n\n` +
      `- ${messages.length} messages exchanged\n` +
      `- Topics explored: ${uniqueTopics.join(", ") || "General discussion"}\n`
  },
}
