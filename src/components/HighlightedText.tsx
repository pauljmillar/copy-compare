"use client";

import { useMemo } from "react";
import { computeTextDiff, type HighlightSegment } from "@/lib/textDiff";

interface HighlightedTextProps {
  /**
   * The text to highlight (e.g., campaign body from database)
   */
  text: string;
  /**
   * The reference text to compare against (e.g., OCR text from uploaded document)
   */
  referenceText: string;
  /**
   * Custom class name for the container
   */
  className?: string;
}

/**
 * Component that highlights overlapping text between two strings.
 * Matching segments are highlighted in yellow.
 */
export function HighlightedText({
  text,
  referenceText,
  className = "",
}: HighlightedTextProps) {
  const segments = useMemo<HighlightSegment[]>(() => {
    if (!text || !referenceText) {
      return [{ text: text || "", isMatch: false }];
    }
    return computeTextDiff(referenceText, text);
  }, [text, referenceText]);

  if (!text) {
    return <span className={className}></span>;
  }

  return (
    <span className={`${className} whitespace-pre-wrap break-words`}>
      {segments.map((segment, index) => {
        if (segment.isMatch && segment.text.trim().length > 0) {
          return (
            <mark
              key={index}
              className="bg-yellow-200 text-slate-900 rounded px-0.5 font-medium"
            >
              {segment.text}
            </mark>
          );
        }
        return <span key={index}>{segment.text}</span>;
      })}
    </span>
  );
}
