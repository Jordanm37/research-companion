/**
 * Research chat prompts for the AI assistant.
 *
 * These prompts are used with Anthropic's claude-sonnet-4-5 model
 * for research assistance with tool use capabilities.
 */

import type { ResearchActionType, Reference } from '@shared/types'

/**
 * System prompt for research chat.
 *
 * Defines the AI's role, available tools, and formatting guidelines.
 */
export function getResearchSystemPrompt(): string {
  return `You are a helpful research assistant with access to real-time tools for academic research.

YOUR TOOLS:
1. **search_papers** - Search Semantic Scholar for academic papers by title, author, or topic. Returns paper titles, authors, abstracts, citation counts, and Semantic Scholar links.
2. **get_paper_details** - Get detailed information about a specific paper by its Semantic Scholar ID.

Your role is to:
- Find and link to real academic papers using your search tools
- Help researchers explore topics and find related work
- Explain concepts and methodologies
- ALWAYS use search_papers when asked about papers or citations - provide real links

Important guidelines:
- When asked about a paper or citation, SEARCH for it to get real information and links
- Always include Semantic Scholar links when you find papers
- Be honest about what you find vs what you couldn't find
- Synthesize search results into helpful responses

Format your responses clearly with:
- Links to papers (always include the Semantic Scholar link when available)
- Bullet points for lists
- Bold text for key terms (**term**)`
}

/**
 * Build a research query based on action type and context.
 *
 * @param actionType - The type of research action
 * @param selectedText - The text selected by the user
 * @param customQuery - Optional custom query from the user
 * @param matchedReference - Optional matched reference from paper's bibliography
 * @returns Formatted query string for the AI
 */
export function buildResearchQuery(
  actionType: ResearchActionType,
  selectedText: string,
  customQuery?: string,
  matchedReference?: Reference | null
): string {
  switch (actionType) {
    case 'find_similar':
      return `I'm reading a research paper and selected this text: "${selectedText}"

Please help me find similar papers or research. What specific search queries should I use? What databases would be most relevant? What related topics or keywords should I explore?`

    case 'explore_topic':
      return `I'm reading a research paper and selected this text: "${selectedText}"

Please help me explore this topic more deeply. What are the key concepts mentioned? What are the main research directions in this area? What search terms would help me find foundational and recent work on this topic?`

    case 'ask_question':
      return `I'm reading a research paper and selected this text: "${selectedText}"

Please explain this passage to me. What are the key concepts? How does this fit into the broader research context? Are there any technical terms I should understand?`

    case 'custom_query':
      return `I'm reading a research paper and selected this text: "${selectedText}"

My question is: ${customQuery || 'Please analyze this text.'}`

    case 'paper_summary':
      if (matchedReference) {
        return `I'm reading a research paper and highlighted this citation: "${selectedText}"

I found the full reference in the paper's bibliography:
"${matchedReference.rawText}"
${matchedReference.authors ? `Authors: ${matchedReference.authors}` : ''}
${matchedReference.year ? `Year: ${matchedReference.year}` : ''}
${matchedReference.title ? `Title: ${matchedReference.title}` : ''}

Please provide a summary of this cited paper. Include:
- The main thesis or key contribution of the paper
- The methodology or approach used
- Key findings or claims that are commonly cited
- How this paper typically relates to other research in the field
- Any important caveats about the paper's scope or limitations

If you're not certain about specific details, please indicate that and provide what general knowledge you have about this work.`
      } else {
        return `I'm reading a research paper and highlighted this citation or paper reference: "${selectedText}"

(Note: I couldn't find this citation in the paper's reference list, so I'm working with just the selected text.)

Please provide a summary of this cited paper. Include:
- The main thesis or key contribution of the paper
- The methodology or approach used
- Key findings or claims that are commonly cited
- How this paper typically relates to other research in the field
- Any important caveats about the paper's scope or limitations

If you're not certain about specific details, please indicate that and provide what general knowledge you have about this work.`
      }

    default:
      return `Selected text: "${selectedText}"\n\n${customQuery || 'Please help me understand this.'}`
  }
}
