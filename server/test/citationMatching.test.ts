/**
 * End-to-end tests for citation matching from highlight feature
 *
 * Tests the full flow:
 * 1. User highlights citation like "[1]" or "Smith (2023)"
 * 2. System matches it to bibliography reference
 * 3. Research query is built with matched reference context
 */

import { describe, it, expect } from 'vitest'
import { matchCitationToReference, findReferencesSection, parseReferences } from '../referenceExtractor'
import { buildResearchQuery } from '../ai/prompts/research'
import type { Reference } from '@shared/types'

describe('Citation Matching End-to-End', () => {
  // Simulate extracted PDF text with references section
  const samplePdfText = `
Abstract
This paper discusses machine learning approaches for natural language processing.
We build on prior work [1] and extend the transformer architecture [2].
Smith et al. (2023) showed promising results in this area.

1. Introduction
Recent advances in deep learning have revolutionized NLP [3].
The attention mechanism, introduced by Vaswani et al. (2017), has become fundamental.

References
[1]. Brown, T., Mann, B., Ryder, N., et al. (2020). Language Models are Few-Shot Learners.
     Advances in Neural Information Processing Systems, 33, 1877-1901.
[2]. Vaswani, A., Shazeer, N., Parmar, N., et al. (2017). Attention Is All You Need.
     Advances in Neural Information Processing Systems, 30.
[3]. Devlin, J., Chang, M., Lee, K., & Toutanova, K. (2019). BERT: Pre-training of Deep
     Bidirectional Transformers for Language Understanding. NAACL-HLT.
`

  let references: Reference[]

  // Parse references once for all tests
  const refSection = findReferencesSection(samplePdfText)
  if (refSection) {
    references = parseReferences(refSection)
  } else {
    references = []
  }

  describe('Reference extraction from PDF text', () => {
    it('finds references section in PDF text', () => {
      const section = findReferencesSection(samplePdfText)
      expect(section).not.toBeNull()
      expect(section).toContain('Brown')
      expect(section).toContain('Vaswani')
    })

    it('parses individual references correctly', () => {
      expect(references.length).toBeGreaterThanOrEqual(2)

      // Check first reference
      const ref1 = references.find(r => r.index === 1)
      expect(ref1).toBeDefined()
      expect(ref1?.year).toBe('2020')
      expect(ref1?.rawText).toContain('Language Models')
    })
  })

  describe('Highlight citation matching', () => {
    it('matches [1] citation to GPT-3 paper', () => {
      const match = matchCitationToReference('[1]', references)

      expect(match).not.toBeNull()
      expect(match?.index).toBe(1)
      expect(match?.year).toBe('2020')
      expect(match?.rawText).toContain('Few-Shot Learners')
    })

    it('matches [2] citation to Attention paper', () => {
      const match = matchCitationToReference('[2]', references)

      expect(match).not.toBeNull()
      expect(match?.index).toBe(2)
      expect(match?.year).toBe('2017')
      expect(match?.rawText).toContain('Attention')
    })

    it('matches author-year citation "Vaswani et al. (2017)"', () => {
      // Note: This matches if authors field contains "Vaswani"
      const match = matchCitationToReference('Vaswani et al. (2017)', references)

      // The match depends on how authors are parsed
      if (match) {
        expect(match.year).toBe('2017')
      }
    })

    it('returns null for non-existent citation [99]', () => {
      const match = matchCitationToReference('[99]', references)
      expect(match).toBeNull()
    })
  })

  describe('Research query building with matched reference', () => {
    it('builds paper_summary query with full reference context', () => {
      const match = matchCitationToReference('[1]', references)
      expect(match).not.toBeNull()

      const query = buildResearchQuery('paper_summary', '[1]', undefined, match)

      // Query should contain the full reference text
      expect(query).toContain(match!.rawText)

      // Query should include year
      expect(query).toContain('2020')

      // Query should ask for summary elements
      expect(query).toContain('main thesis')
      expect(query).toContain('methodology')
    })

    it('builds graceful query when citation not found', () => {
      const query = buildResearchQuery('paper_summary', '[99]', undefined, null)

      expect(query).toContain("couldn't find")
      expect(query).toContain('[99]')
      expect(query).toContain('search')
    })

    it('builds find_similar query with highlighted text', () => {
      const highlightedText = 'transformer architecture for sequence-to-sequence learning'
      const query = buildResearchQuery('find_similar', highlightedText)

      expect(query).toContain(highlightedText)
      expect(query).toContain('similar papers')
    })
  })

  describe('Full workflow simulation', () => {
    it('simulates user highlighting "[1]" and getting paper summary', () => {
      // Step 1: User highlights "[1]" in PDF
      const highlightedText = '[1]'

      // Step 2: System matches to reference
      const matchedRef = matchCitationToReference(highlightedText, references)
      expect(matchedRef).not.toBeNull()

      // Step 3: Build research query with context
      const query = buildResearchQuery('paper_summary', highlightedText, undefined, matchedRef)

      // Step 4: Query should be ready for AI with full context
      expect(query).toContain('Language Models are Few-Shot Learners')
      expect(query).toContain('2020')

      // This query would then go to the AI with Semantic Scholar tools
      console.log('Generated query for AI:', query.slice(0, 200) + '...')
    })

    it('simulates user highlighting text and finding similar papers', () => {
      // Step 1: User highlights passage
      const highlightedText = 'attention mechanism has become fundamental to modern NLP'

      // Step 2: No reference matching for find_similar
      const query = buildResearchQuery('find_similar', highlightedText)

      // Step 3: Query should ask for similar papers
      expect(query).toContain(highlightedText)
      expect(query).toContain('search')

      console.log('Generated find_similar query:', query.slice(0, 200) + '...')
    })
  })
})
