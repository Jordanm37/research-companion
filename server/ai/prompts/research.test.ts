/**
 * Unit tests for research.ts prompt builders
 */

import { describe, it, expect } from 'vitest'
import { getResearchSystemPrompt, buildResearchQuery } from './research'
import type { Reference } from '@shared/types'

describe('getResearchSystemPrompt', () => {
  it('returns a non-empty system prompt', () => {
    const prompt = getResearchSystemPrompt()
    expect(prompt).toBeTruthy()
    expect(prompt.length).toBeGreaterThan(100)
  })

  it('mentions available tools', () => {
    const prompt = getResearchSystemPrompt()
    expect(prompt).toContain('search_papers')
    expect(prompt).toContain('get_paper_details')
  })

  it('provides formatting guidelines', () => {
    const prompt = getResearchSystemPrompt()
    expect(prompt).toContain('Semantic Scholar')
    expect(prompt).toContain('links')
  })
})

describe('buildResearchQuery', () => {
  const sampleText = 'This is a sample selected text from a research paper.'

  describe('find_similar action', () => {
    it('includes selected text in query', () => {
      const query = buildResearchQuery('find_similar', sampleText)
      expect(query).toContain(sampleText)
    })

    it('asks about finding similar papers', () => {
      const query = buildResearchQuery('find_similar', sampleText)
      expect(query).toContain('similar papers')
      expect(query).toContain('search queries')
    })
  })

  describe('explore_topic action', () => {
    it('includes selected text in query', () => {
      const query = buildResearchQuery('explore_topic', sampleText)
      expect(query).toContain(sampleText)
    })

    it('asks about exploring the topic', () => {
      const query = buildResearchQuery('explore_topic', sampleText)
      expect(query).toContain('explore this topic')
      expect(query).toContain('key concepts')
    })
  })

  describe('ask_question action', () => {
    it('includes selected text in query', () => {
      const query = buildResearchQuery('ask_question', sampleText)
      expect(query).toContain(sampleText)
    })

    it('asks for explanation', () => {
      const query = buildResearchQuery('ask_question', sampleText)
      expect(query).toContain('explain')
      expect(query).toContain('technical terms')
    })
  })

  describe('custom_query action', () => {
    it('includes selected text and custom query', () => {
      const customQuery = 'What are the limitations of this approach?'
      const query = buildResearchQuery('custom_query', sampleText, customQuery)
      expect(query).toContain(sampleText)
      expect(query).toContain(customQuery)
    })

    it('handles missing custom query gracefully', () => {
      const query = buildResearchQuery('custom_query', sampleText)
      expect(query).toContain('analyze this text')
    })
  })

  describe('paper_summary action', () => {
    const matchedReference: Reference = {
      index: 1,
      rawText: 'Smith, J., & Doe, A. (2023). Machine Learning in Research. Journal of AI.',
      authors: 'Smith, J., & Doe, A.',
      year: '2023',
      title: 'Machine Learning in Research',
    }

    it('includes matched reference details when provided', () => {
      const query = buildResearchQuery('paper_summary', '[1]', undefined, matchedReference)
      expect(query).toContain(matchedReference.rawText)
      expect(query).toContain('Authors: Smith, J., & Doe, A.')
      expect(query).toContain('Year: 2023')
      expect(query).toContain('Title: Machine Learning in Research')
    })

    it('asks for specific paper summary elements', () => {
      const query = buildResearchQuery('paper_summary', '[1]', undefined, matchedReference)
      expect(query).toContain('main thesis')
      expect(query).toContain('methodology')
      expect(query).toContain('Key findings')
      expect(query).toContain('limitations')
    })

    it('handles missing reference gracefully', () => {
      const query = buildResearchQuery('paper_summary', 'Smith et al. (2023)', undefined, null)
      expect(query).toContain("couldn't find this citation")
      expect(query).toContain('Smith et al. (2023)')
    })

    it('handles partial reference data', () => {
      const partialRef: Reference = {
        index: 2,
        rawText: 'Partial reference text',
        // Missing authors, year, title
      }
      const query = buildResearchQuery('paper_summary', '[2]', undefined, partialRef)
      expect(query).toContain(partialRef.rawText)
      // Should not include empty Author/Year/Title lines
      expect(query).not.toContain('Authors:')
    })
  })

  describe('unknown action type', () => {
    it('returns a default query format', () => {
      // @ts-expect-error Testing unknown action type
      const query = buildResearchQuery('unknown_action', sampleText)
      expect(query).toContain(sampleText)
      expect(query).toContain('help me understand')
    })
  })
})
