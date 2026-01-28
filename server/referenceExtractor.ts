import type { Reference } from "@shared/schema";

export function findReferencesSection(text: string): string | null {
  const lines = text.split('\n');
  
  const headingPatterns = [
    /^#{1,3}\s*references?\s*$/i,
    /^#{1,3}\s*bibliography\s*$/i,
    /^#{1,3}\s*works?\s*cited\s*$/i,
    /^#{1,3}\s*literature\s*cited\s*$/i,
    /^\s*references?\s*$/i,
    /^\s*bibliography\s*$/i,
    /^\s*works?\s*cited\s*$/i,
    /^REFERENCES?\s*$/,
    /^BIBLIOGRAPHY\s*$/,
  ];
  
  let startIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (headingPatterns.some(p => p.test(line))) {
      startIndex = i + 1;
      break;
    }
  }
  
  if (startIndex === -1) {
    const lastThird = Math.floor(lines.length * 0.7);
    for (let i = lastThird; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      if (line === 'references' || line === 'bibliography') {
        startIndex = i + 1;
        break;
      }
    }
  }
  
  if (startIndex === -1) return null;
  
  return lines.slice(startIndex).join('\n');
}

export function parseReferences(referencesText: string): Reference[] {
  const references: Reference[] = [];
  const lines = referencesText.split('\n');
  
  let currentRef = '';
  let currentIndex = 0;
  
  const numberedPattern = /^\s*\[?(\d+)\]?[\.\)]\s*/;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    const numberedMatch = trimmedLine.match(numberedPattern);
    
    if (numberedMatch) {
      if (currentRef) {
        references.push(parseReferenceEntry(currentRef, currentIndex));
      }
      currentIndex = parseInt(numberedMatch[1], 10);
      currentRef = trimmedLine.replace(numberedPattern, '').trim();
    } else if (currentRef) {
      currentRef += ' ' + trimmedLine;
    } else if (looksLikeReferenceStart(trimmedLine)) {
      if (currentRef) {
        references.push(parseReferenceEntry(currentRef, currentIndex));
      }
      currentIndex = references.length + 1;
      currentRef = trimmedLine;
    } else if (currentRef) {
      currentRef += ' ' + trimmedLine;
    }
  }
  
  if (currentRef) {
    references.push(parseReferenceEntry(currentRef, currentIndex || references.length + 1));
  }
  
  return references;
}

function looksLikeReferenceStart(line: string): boolean {
  const authorYearPattern = /^[A-Z][a-z]+,?\s+[A-Z]\.?\s*[,&]?\s*.*\(\d{4}\)/;
  const authorPattern = /^[A-Z][a-z]+,\s+[A-Z]\./;
  
  return authorYearPattern.test(line) || authorPattern.test(line);
}

function parseReferenceEntry(text: string, index: number): Reference {
  const ref: Reference = {
    index,
    rawText: text.trim(),
  };
  
  const yearMatch = text.match(/\((\d{4})\)/);
  if (yearMatch) {
    ref.year = yearMatch[1];
  }
  
  const authorPatterns = [
    /^([A-Z][a-z]+(?:,\s*[A-Z]\.?\s*(?:[A-Z]\.?\s*)?)?(?:\s*(?:,|&|and)\s*[A-Z][a-z]+(?:,\s*[A-Z]\.?\s*(?:[A-Z]\.?\s*)?)?)*)/,
    /^([A-Z][a-z]+\s+et\s+al\.?)/i,
  ];
  
  for (const pattern of authorPatterns) {
    const match = text.match(pattern);
    if (match) {
      ref.authors = match[1].trim();
      break;
    }
  }
  
  const titlePatterns = [
    /\)\.\s*([^.]+(?:\.[^.]+)?)\./,
    /\d{4}\)\s*([^.]+)\./,
    /"([^"]+)"/,
  ];
  
  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match && match[1].length > 10) {
      ref.title = match[1].trim();
      break;
    }
  }
  
  return ref;
}

export function matchCitationToReference(
  selectedText: string, 
  references: Reference[]
): Reference | null {
  const text = selectedText.trim();
  
  const numberedMatch = text.match(/\[(\d+)\]|\((\d+)\)|^(\d+)$/);
  if (numberedMatch) {
    const num = parseInt(numberedMatch[1] || numberedMatch[2] || numberedMatch[3], 10);
    const ref = references.find(r => r.index === num);
    if (ref) return ref;
  }
  
  const multiNumberMatch = text.match(/\[(\d+(?:,\s*\d+)+)\]/);
  if (multiNumberMatch) {
    const firstNum = parseInt(multiNumberMatch[1].split(',')[0].trim(), 10);
    const ref = references.find(r => r.index === firstNum);
    if (ref) return ref;
  }
  
  const authorYearMatch = text.match(/([A-Z][a-z]+)(?:\s+et\s+al\.?)?\s*[,\(]?\s*(\d{4})/);
  if (authorYearMatch) {
    const authorName = authorYearMatch[1].toLowerCase();
    const year = authorYearMatch[2];
    
    const ref = references.find(r => {
      const refAuthors = r.authors?.toLowerCase() || r.rawText.toLowerCase();
      const refYear = r.year;
      return refAuthors.includes(authorName) && refYear === year;
    });
    if (ref) return ref;
  }
  
  const authorOnlyMatch = text.match(/([A-Z][a-z]+)\s+et\s+al\.?/i);
  if (authorOnlyMatch) {
    const authorName = authorOnlyMatch[1].toLowerCase();
    const ref = references.find(r => {
      const refAuthors = r.authors?.toLowerCase() || r.rawText.toLowerCase();
      return refAuthors.includes(authorName);
    });
    if (ref) return ref;
  }
  
  return null;
}
