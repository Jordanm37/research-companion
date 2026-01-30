/**
 * Tests for intelligent pruning utilities
 */

import { describe, it, expect } from 'vitest'
import {
  extractPapersFromSearchResult,
  formatExtractedPapers,
  processToolResult,
} from './structuredExtraction'
import {
  applySlidingWindow,
  formatMessagesWithSummary,
} from './conversationSummary'

describe('Structured Extraction', () => {
  describe('extractPapersFromSearchResult', () => {
    it('extracts papers from markdown format', () => {
      const rawResult = `
## Paper 1: Attention Is All You Need
**Authors:** Vaswani et al.
**Year:** 2017
**Citations:** 50000
**Link:** https://semanticscholar.org/paper/123

## Paper 2: BERT: Pre-training of Deep Bidirectional Transformers
**Authors:** Devlin et al.
**Year:** 2018
**Citations:** 40000
`
      const result = extractPapersFromSearchResult(rawResult)

      expect(result.papers).toHaveLength(2)
      expect(result.papers[0].title).toContain('Attention')
      expect(result.papers[0].year).toBe('2017')
      expect(result.papers[1].title).toContain('BERT')
    })

    it('extracts papers from numbered list format', () => {
      const rawResult = `
1. **Transformer Architecture Study**
   Authors: Smith, Jones
   Year: 2023
   Citations: 100

2. **Neural Network Analysis**
   Authors: Brown et al.
   Year: 2022
`
      const result = extractPapersFromSearchResult(rawResult)

      expect(result.papers.length).toBeGreaterThanOrEqual(1)
    })

    it('handles JSON format', () => {
      const rawResult = JSON.stringify([
        { title: 'Paper 1', authors: [{ name: 'Smith' }], year: 2023 },
        { title: 'Paper 2', authors: [{ name: 'Jones' }], year: 2022 },
      ])

      const result = extractPapersFromSearchResult(rawResult)

      expect(result.papers).toHaveLength(2)
      expect(result.papers[0].title).toBe('Paper 1')
      expect(result.papers[0].authors).toContain('Smith')
    })

    it('returns empty array for invalid input', () => {
      const result = extractPapersFromSearchResult('No papers found')
      expect(result.papers).toHaveLength(0)
    })
  })

  describe('formatExtractedPapers', () => {
    it('formats papers into readable output', () => {
      const papers = {
        papers: [
          {
            title: 'Test Paper',
            authors: 'Smith, Jones',
            year: '2023',
            citationCount: 100,
            url: 'https://example.com',
          },
        ],
      }

      const formatted = formatExtractedPapers(papers)

      expect(formatted).toContain('Test Paper')
      expect(formatted).toContain('Smith, Jones')
      expect(formatted).toContain('2023')
      expect(formatted).toContain('100')
    })

    it('respects maxPapers limit', () => {
      const papers = {
        papers: Array.from({ length: 20 }, (_, i) => ({
          title: `Paper ${i + 1}`,
          authors: 'Author',
        })),
      }

      const formatted = formatExtractedPapers(papers, { maxPapers: 5 })

      expect(formatted).toContain('Paper 1')
      expect(formatted).toContain('Paper 5')
      expect(formatted).not.toContain('Paper 10')
      expect(formatted).toContain('15 more results')
    })

    it('handles empty results', () => {
      const formatted = formatExtractedPapers({ papers: [] })
      expect(formatted).toContain('No papers found')
    })
  })

  describe('processToolResult', () => {
    it('processes search_papers results', () => {
      const rawResult = `
## Paper 1: Machine Learning Basics
**Authors:** Test Author
**Year:** 2023
**Citations:** 50
`
      const processed = processToolResult('search_papers', rawResult)

      expect(processed).toContain('Machine Learning Basics')
      expect(processed).toContain('Test Author')
    })

    it('returns original for non-search tools', () => {
      const rawResult = 'Paper details: some info'
      const processed = processToolResult('get_paper_details', rawResult)

      expect(processed).toBe(rawResult)
    })

    it('returns original for error messages', () => {
      const rawResult = 'Error: Connection failed'
      const processed = processToolResult('search_papers', rawResult)

      expect(processed).toBe(rawResult)
    })
  })
})

describe('Conversation Summarization', () => {
  describe('applySlidingWindow', () => {
    it('returns all messages when under threshold', () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ]

      const result = applySlidingWindow(messages, { summarizeThreshold: 10000 })

      expect(result.wasSummarized).toBe(false)
      expect(result.recentMessages).toEqual(messages)
    })

    it('keeps recent messages when summarizing', () => {
      // Create many messages to trigger summarization
      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: 'A'.repeat(2000), // Each message ~570 tokens
      }))

      const result = applySlidingWindow(messages, {
        keepRecentPairs: 2,
        summarizeThreshold: 5000, // Low threshold to trigger summarization
      })

      expect(result.wasSummarized).toBe(true)
      expect(result.recentMessages.length).toBeLessThanOrEqual(4) // 2 pairs
      expect(result.summary).toBeTruthy()
    })

    it('generates summary with topics and papers', () => {
      const messages = [
        { role: 'user' as const, content: 'Tell me about machine learning and transformers' },
        { role: 'assistant' as const, content: 'Here is **Attention Is All You Need** paper from 2017...' },
        { role: 'user' as const, content: 'What about deep learning?' },
        { role: 'assistant' as const, content: 'Deep learning uses neural networks...' },
      ]

      // Force summarization with very low threshold
      const result = applySlidingWindow(messages, {
        keepRecentPairs: 0,
        summarizeThreshold: 1,
      })

      expect(result.summary).toContain('Previous conversation summary')
    })
  })

  describe('formatMessagesWithSummary', () => {
    it('returns messages unchanged when no summary', () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi!' },
      ]

      const result = formatMessagesWithSummary({
        summary: null,
        recentMessages: messages,
        wasSummarized: false,
        tokenCounts: { original: 10, afterProcessing: 10, summarizedCount: 0 },
      })

      expect(result).toEqual(messages)
    })

    it('prepends summary when summarized', () => {
      const messages = [
        { role: 'user' as const, content: 'Latest question' },
        { role: 'assistant' as const, content: 'Latest answer' },
      ]

      const result = formatMessagesWithSummary({
        summary: '[Summary of earlier conversation]',
        recentMessages: messages,
        wasSummarized: true,
        tokenCounts: { original: 1000, afterProcessing: 200, summarizedCount: 10 },
      })

      expect(result.length).toBe(3) // summary + 2 messages
      expect(result[0].content).toContain('Summary')
      expect(result[0].content).toContain('Continuing from recent conversation')
    })
  })
})
