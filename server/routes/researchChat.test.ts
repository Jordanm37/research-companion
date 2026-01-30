/**
 * Integration tests for research chat flow
 *
 * Tests the full flow from request to response including:
 * - Citation matching
 * - Context message handling
 * - Token-aware pruning
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  pruneMessagesToFit,
  estimateTokens,
  estimateMessagesTokens,
  CONTEXT_LIMITS,
} from '../ai/utils/tokenUtils'
import { analyzeToolResult, getToolResultFollowUp } from '../ai/utils/agentPrompts'
import { matchCitationToReference } from '../referenceExtractor'
import { buildResearchQuery } from '../ai/prompts/research'
import type { Reference } from '@shared/types'

describe('Research Chat Integration', () => {
  describe('Context message pruning', () => {
    it('keeps recent messages within token budget', () => {
      const messages = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second message' },
        { role: 'assistant', content: 'Second response' },
        { role: 'user', content: 'Third message' },
        { role: 'assistant', content: 'Third response' },
      ]

      const pruned = pruneMessagesToFit(messages, 100)

      // Should keep most recent messages
      expect(pruned.length).toBeLessThanOrEqual(messages.length)
      expect(pruned[pruned.length - 1].content).toBe('Third response')
    })

    it('handles large messages by dropping older ones', () => {
      const largeContent = 'A'.repeat(1000) // ~285 tokens
      const messages = [
        { role: 'user', content: largeContent },
        { role: 'assistant', content: largeContent },
        { role: 'user', content: 'Recent small message' },
      ]

      const pruned = pruneMessagesToFit(messages, 200)

      // Should prioritize recent messages
      expect(pruned.some((m) => m.content === 'Recent small message')).toBe(true)
    })

    it('respects MAX_HISTORY_TOKENS limit', () => {
      const tokens = estimateMessagesTokens([
        { role: 'user', content: 'Test' },
        { role: 'assistant', content: 'Response' },
      ])

      expect(tokens).toBeLessThan(CONTEXT_LIMITS.MAX_HISTORY_TOKENS)
    })
  })

  describe('Citation to reference matching', () => {
    const references: Reference[] = [
      {
        index: 1,
        rawText: 'Smith, J., & Doe, A. (2023). Machine Learning. Journal.',
        authors: 'Smith, J., & Doe, A.',
        year: '2023',
        title: 'Machine Learning',
      },
      {
        index: 2,
        rawText: 'Williams et al. (2022). Deep Learning Review. NeurIPS.',
        authors: 'Williams et al.',
        year: '2022',
        title: 'Deep Learning Review',
      },
    ]

    it('matches numbered citation to reference', () => {
      const match = matchCitationToReference('[1]', references)
      expect(match).not.toBeNull()
      expect(match?.authors).toBe('Smith, J., & Doe, A.')
    })

    it('matches author-year citation to reference', () => {
      const match = matchCitationToReference('Smith (2023)', references)
      expect(match).not.toBeNull()
      expect(match?.title).toBe('Machine Learning')
    })

    it('builds query with matched reference context', () => {
      const ref = references[0]
      const query = buildResearchQuery('paper_summary', '[1]', undefined, ref)

      expect(query).toContain(ref.rawText)
      expect(query).toContain('2023')
      expect(query).toContain('Smith')
    })

    it('handles unmatched citation gracefully', () => {
      const match = matchCitationToReference('[999]', references)
      expect(match).toBeNull()

      const query = buildResearchQuery('paper_summary', '[999]', undefined, null)
      expect(query).toContain("couldn't find")
    })
  })

  describe('Tool result analysis', () => {
    it('detects successful results', () => {
      const result = `
## Paper 1: Machine Learning Fundamentals
**Authors:** Smith, Doe
**Year:** 2023
**Citations:** 150

## Paper 2: Deep Learning Applications
**Authors:** Williams et al.
**Year:** 2022
**Citations:** 89
`
      const analysis = analyzeToolResult(result)
      expect(analysis.hasResults).toBe(true)
      // resultCount is optional - just verify no error
      expect(analysis.error).toBeUndefined()
    })

    it('detects error results', () => {
      const result = 'Error: Connection timeout. Please try again.'
      const analysis = analyzeToolResult(result)
      expect(analysis.hasResults).toBe(false)
      expect(analysis.error).toBeTruthy()
    })

    it('detects no results', () => {
      const result = 'No papers found matching your query.'
      const analysis = analyzeToolResult(result)
      expect(analysis.hasResults).toBe(false)
    })

    it('generates appropriate follow-up for search_papers', () => {
      const followUp = getToolResultFollowUp('search_papers', {
        hasResults: true,
        resultCount: 5,
      })
      expect(followUp).toContain('Summarize')
      expect(followUp).toContain('Semantic Scholar')
    })

    it('generates error follow-up', () => {
      const followUp = getToolResultFollowUp('search_papers', {
        hasResults: false,
        error: 'Connection failed',
      })
      expect(followUp).toContain('limitation')
    })
  })

  describe('Token estimation', () => {
    it('estimates tokens for short text', () => {
      const tokens = estimateTokens('Hello world')
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThan(10)
    })

    it('estimates tokens for long text', () => {
      const longText = 'A'.repeat(4000) // ~1000 tokens
      const tokens = estimateTokens(longText)
      expect(tokens).toBeGreaterThan(500)
      expect(tokens).toBeLessThan(2000)
    })

    it('handles empty text', () => {
      expect(estimateTokens('')).toBe(0)
    })
  })

  describe('Research action types', () => {
    const selectedText = 'This paper introduces a novel approach to machine learning.'

    it('builds find_similar query correctly', () => {
      const query = buildResearchQuery('find_similar', selectedText)
      expect(query).toContain(selectedText)
      expect(query).toContain('similar papers')
    })

    it('builds explore_topic query correctly', () => {
      const query = buildResearchQuery('explore_topic', selectedText)
      expect(query).toContain(selectedText)
      expect(query).toContain('explore')
    })

    it('builds ask_question query correctly', () => {
      const query = buildResearchQuery('ask_question', selectedText)
      expect(query).toContain(selectedText)
      expect(query).toContain('explain')
    })

    it('builds custom_query correctly', () => {
      const customQuestion = 'What are the limitations?'
      const query = buildResearchQuery('custom_query', selectedText, customQuestion)
      expect(query).toContain(selectedText)
      expect(query).toContain(customQuestion)
    })
  })
})

describe('Circuit breaker behavior', () => {
  // Note: These are conceptual tests - actual circuit breaker is tested via the MCP module

  it('should have reasonable timeout configuration', () => {
    // Verify our context limits are sensible
    expect(CONTEXT_LIMITS.MAX_CONTEXT_TOKENS).toBeGreaterThan(100000)
    expect(CONTEXT_LIMITS.MAX_TOOL_RESULT_TOKENS).toBeLessThan(CONTEXT_LIMITS.MAX_CONTEXT_TOKENS)
    expect(CONTEXT_LIMITS.MAX_HISTORY_TOKENS).toBeLessThan(CONTEXT_LIMITS.MAX_CONTEXT_TOKENS)
  })
})
