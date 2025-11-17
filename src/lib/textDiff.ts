import { diff_match_patch } from "diff-match-patch";

export type HighlightSegment = {
  text: string;
  isMatch: boolean;
};

// diff-match-patch operation constants
const DIFF_EQUAL = 0; // Text exists in both strings
const DIFF_DELETE = -1; // Text only exists in first string
const DIFF_INSERT = 1; // Text only exists in second string

/**
 * Computes the diff between two texts and returns segments with match information.
 * Matches (overlapping text) are marked for highlighting.
 * 
 * @param text1 - The first text (e.g., OCR text from uploaded document)
 * @param text2 - The second text (e.g., campaign body from database)
 * @returns Array of segments with match information
 */
export function computeTextDiff(text1: string, text2: string): HighlightSegment[] {
  const dmp = new diff_match_patch();
  
  // Compute the diff
  const diffs = dmp.diff_main(text1, text2);
  dmp.diff_cleanupSemantic(diffs);
  
  const segments: HighlightSegment[] = [];
  
  for (const [operation, text] of diffs) {
    if (operation === DIFF_EQUAL) {
      // This text exists in both - it's a match, highlight it
      if (text.trim().length > 0) {
        segments.push({ text, isMatch: true });
      } else {
        // Preserve whitespace but don't highlight it
        segments.push({ text, isMatch: false });
      }
    } else if (operation === DIFF_INSERT) {
      // This text only exists in text2 - don't highlight
      segments.push({ text, isMatch: false });
    } else if (operation === DIFF_DELETE) {
      // This text only exists in text1 - don't highlight
      // We can optionally include this or skip it
      // For now, we'll skip deletions to only show what's in text2
    }
  }
  
  return segments;
}

/**
 * Alternative approach: Find matching words/phrases between two texts.
 * This is more lenient and can handle slight variations.
 */
export function findMatchingWords(text1: string, text2: string): HighlightSegment[] {
  // Normalize both texts
  const normalize = (text: string) => 
    text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  
  const normalized1 = normalize(text1);
  const normalized2 = normalize(text2);
  
  const words1 = normalized1.split(/\s+/);
  const words2 = normalized2.split(/\s+/);
  
  // Create a set of words from text1 for quick lookup
  const words1Set = new Set(words1);
  
  // Split text2 into words while preserving original spacing
  const originalWords2 = text2.split(/(\s+)/);
  
  const segments: HighlightSegment[] = [];
  
  for (const word of originalWords2) {
    const normalizedWord = normalize(word);
    if (normalizedWord && words1Set.has(normalizedWord)) {
      segments.push({ text: word, isMatch: true });
    } else {
      segments.push({ text: word, isMatch: false });
    }
  }
  
  return segments;
}
