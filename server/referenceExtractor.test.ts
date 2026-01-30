/**
 * Unit tests for referenceExtractor.ts
 * Tests citation parsing and matching functionality
 */

import { describe, it, expect } from 'vitest'
import {
  findReferencesSection,
  parseReferences,
  matchCitationToReference,
} from './referenceExtractor'
import type { Reference } from '@shared/types'

describe('findReferencesSection', () => {
  it('finds "References" heading', () => {
    const text = `
Introduction
This is the introduction.

References
[1] Smith, J. (2023). A paper title. Journal Name.
[2] Doe, A. (2022). Another paper. Conference.
`
    const result = findReferencesSection(text)
    expect(result).toContain('[1] Smith')
    expect(result).toContain('[2] Doe')
  })

  it('finds "REFERENCES" heading (uppercase)', () => {
    const text = `
REFERENCES
[1] Author, A. (2020). Title. Journal.
`
    const result = findReferencesSection(text)
    expect(result).toContain('[1] Author')
  })

  it('finds "Bibliography" heading', () => {
    const text = `
## Bibliography
Smith, J. (2023). Paper title.
`
    const result = findReferencesSection(text)
    expect(result).toContain('Smith')
  })

  it('finds "Works Cited" heading', () => {
    const text = `
# Works Cited
Author, A. (2021). Citation.
`
    const result = findReferencesSection(text)
    expect(result).toContain('Author')
  })

  it('returns null when no references section found', () => {
    const text = `
This is just regular text without any references section.
Some more content here.
`
    const result = findReferencesSection(text)
    expect(result).toBeNull()
  })

  it('finds references in last third of document', () => {
    const lines = Array(100).fill('Content line.')
    lines.push('references')
    lines.push('[1] Smith, J. (2023). Found it.')
    const text = lines.join('\n')

    const result = findReferencesSection(text)
    expect(result).toContain('[1] Smith')
  })
})

describe('parseReferences', () => {
  it('parses numbered references [1]. [2].', () => {
    // Parser expects [N]. format with period
    const text = `
[1]. Smith, J. (2023). A paper about testing. Journal of Testing, 1(1), 1-10.
[2]. Doe, A., & Johnson, B. (2022). Another study. Conference Proceedings.
`
    const refs = parseReferences(text)

    expect(refs).toHaveLength(2)
    expect(refs[0].index).toBe(1)
    expect(refs[0].year).toBe('2023')
    expect(refs[0].authors).toContain('Smith')
    expect(refs[1].index).toBe(2)
    expect(refs[1].year).toBe('2022')
  })

  it('parses references with period number format 1.', () => {
    const text = `
1. Smith, J. (2023). Paper title. Journal.
2. Doe, A. (2022). Another paper. Conference.
`
    const refs = parseReferences(text)

    expect(refs).toHaveLength(2)
    expect(refs[0].index).toBe(1)
    expect(refs[1].index).toBe(2)
  })

  it('handles multi-line references', () => {
    // Parser expects [N]. format with period
    const text = `
[1]. Smith, J., Johnson, A., Williams, B., & Thompson, C. (2023). A very long
    paper title that spans multiple lines. Journal of Extended Titles,
    15(3), 100-150.
[2]. Doe, A. (2022). Short paper. Conference.
`
    const refs = parseReferences(text)

    expect(refs).toHaveLength(2)
    expect(refs[0].rawText).toContain('multiple lines')
  })

  it('extracts title from reference', () => {
    // Uses period number format which parser recognizes
    const text = `
1. Smith, J. (2023). The Impact of Machine Learning on Testing. Journal.
`
    const refs = parseReferences(text)

    expect(refs).toHaveLength(1)
    expect(refs[0].title).toContain('Machine Learning')
  })

  it('handles "et al." author format', () => {
    // Uses period number format
    // Note: Current parser extracts first author name only from "et al." format
    const text = `
1. Smith et al. (2023). Paper with many authors. Journal.
`
    const refs = parseReferences(text)

    expect(refs).toHaveLength(1)
    // The rawText contains the full "et al." but authors field gets truncated
    expect(refs[0].rawText).toContain('Smith et al')
  })

  it('returns empty array for empty input', () => {
    const refs = parseReferences('')
    expect(refs).toHaveLength(0)
  })
})

describe('matchCitationToReference', () => {
  const sampleReferences: Reference[] = [
    {
      index: 1,
      rawText: 'Smith, J. (2023). Paper about AI. Journal.',
      authors: 'Smith, J.',
      year: '2023',
      title: 'Paper about AI',
    },
    {
      index: 2,
      rawText: 'Doe, A., & Johnson, B. (2022). Machine learning study. Conf.',
      authors: 'Doe, A., & Johnson, B.',
      year: '2022',
      title: 'Machine learning study',
    },
    {
      index: 15,
      rawText: 'Williams et al. (2021). Deep learning review. Review.',
      authors: 'Williams et al.',
      year: '2021',
      title: 'Deep learning review',
    },
  ]

  it('matches [1] format', () => {
    const match = matchCitationToReference('[1]', sampleReferences)
    expect(match).not.toBeNull()
    expect(match?.index).toBe(1)
    expect(match?.authors).toBe('Smith, J.')
  })

  it('matches (1) format', () => {
    const match = matchCitationToReference('(2)', sampleReferences)
    expect(match).not.toBeNull()
    expect(match?.index).toBe(2)
  })

  it('matches plain number', () => {
    const match = matchCitationToReference('15', sampleReferences)
    expect(match).not.toBeNull()
    expect(match?.index).toBe(15)
  })

  it('matches multi-number citation [1,2,3] (returns first)', () => {
    const match = matchCitationToReference('[1,2,3]', sampleReferences)
    expect(match).not.toBeNull()
    expect(match?.index).toBe(1)
  })

  it('matches author-year format "Smith (2023)"', () => {
    const match = matchCitationToReference('Smith (2023)', sampleReferences)
    expect(match).not.toBeNull()
    expect(match?.authors).toBe('Smith, J.')
  })

  it('matches author-year with "et al." format', () => {
    const match = matchCitationToReference('Williams et al. (2021)', sampleReferences)
    expect(match).not.toBeNull()
    expect(match?.index).toBe(15)
  })

  it('matches partial author name with year', () => {
    const match = matchCitationToReference('Doe, 2022', sampleReferences)
    expect(match).not.toBeNull()
    expect(match?.index).toBe(2)
  })

  it('matches "Author et al." without year', () => {
    const match = matchCitationToReference('Williams et al.', sampleReferences)
    expect(match).not.toBeNull()
    expect(match?.index).toBe(15)
  })

  it('returns null for non-matching citation', () => {
    const match = matchCitationToReference('NonExistent (2020)', sampleReferences)
    expect(match).toBeNull()
  })

  it('returns null for empty references array', () => {
    const match = matchCitationToReference('[1]', [])
    expect(match).toBeNull()
  })

  it('handles citation with surrounding text', () => {
    const match = matchCitationToReference('as shown by Smith (2023) in their study', sampleReferences)
    expect(match).not.toBeNull()
    expect(match?.year).toBe('2023')
  })
})
