# Campaign Copy Detection Architecture

## Overview

This system uses a **2-pronged approach** to efficiently identify duplicate marketing campaigns at scale. The architecture combines fast text-based filtering with sophisticated AI-powered image comparison to achieve both speed and accuracy.

---

## Prong 1: PostgreSQL Trigram Similarity Search

### Purpose
**Fast candidate filtering** - Narrow down millions of potential matches to a small set of top candidates (default: top 5) before performing expensive AI image comparisons.

### Why It's Necessary
As the database grows to millions of campaign records, comparing every uploaded image against every stored image using AI would be:
- **Prohibitively expensive** (Gemini API costs per comparison)
- **Too slow** (seconds per comparison × millions = hours)
- **Unnecessary** (most campaigns are completely different)

### How PostgreSQL Trigram Similarity Works

#### What are Trigrams?
A **trigram** is a sequence of 3 consecutive characters from a text string. For example, the word "campaign" generates these trigrams:
- `" ca"`, `"cam"`, `"amp"`, `"mpa"`, `"pai"`, `"aig"`, `"ign"`, `"gn "`

#### The Similarity Algorithm
1. **Text Extraction**: OCR text is extracted from uploaded images using AWS Textract
2. **Trigram Generation**: Both the query text and database records are broken down into trigrams
3. **Overlap Calculation**: PostgreSQL calculates how many trigrams overlap between the query and each database record
4. **Similarity Score**: The similarity function returns a value between 0 and 1:
   ```
   similarity = (number of matching trigrams) / (total unique trigrams)
   ```

#### The GIN Index (Generalized Inverted Index)

```sql
create index idx_campaigns_body_trgm
  on campaigns using gin (body gin_trgm_ops);
```

**How it works:**
- **Inverted Index Structure**: Instead of indexing documents, it indexes trigrams
- **Fast Lookup**: For each trigram in the query, the index immediately points to all records containing that trigram
- **Set Intersection**: PostgreSQL efficiently finds records that share multiple trigrams with the query
- **Performance**: Queries that would take minutes on millions of rows complete in milliseconds

**Example:**
- Query: `"Save 50% on premium services"`
- Trigrams: `" Sa"`, `"Sav"`, `"ave"`, `"ve "`, `" 50"`, `"50%"`, etc.
- Index lookup finds all records containing these trigrams
- Records with more matching trigrams = higher similarity score

#### The Search Function

```sql
select c.*, similarity(c.body, q) as similarity
from campaigns c
where c.body % q  -- Trigram similarity operator
order by similarity desc
limit k;  -- Returns top k matches (default: 5)
```

**Key Features:**
- `%` operator: Trigram similarity match (returns true if similarity > threshold)
- `similarity()` function: Calculates exact similarity score (0-1)
- Results sorted by similarity (highest first)
- Limited to top `k` results (configurable, default: 5)

### Performance Characteristics
- **Time Complexity**: O(log n) with GIN index (vs O(n) without index)
- **Scalability**: Handles millions of records efficiently
- **Accuracy**: Good at finding textually similar campaigns, even with minor variations
- **Limitations**: Only compares text, not visual design or layout

---

## Prong 2: Gemini Image Comparison

### Purpose
**Visual verification** - Confirm that the top candidates from Prong 1 are actually visual copies, not just textually similar campaigns.

### Why It's Necessary
Text similarity alone isn't sufficient because:
- **Different campaigns can share similar text** (e.g., "50% off sale" appears in many campaigns)
- **Visual design matters** (same text, different layout/colors = different campaign)
- **Image-based campaigns** may have minimal text but identical visuals
- **False positives** from text search need visual confirmation

### Implementation Details

#### Model Selection
- **Primary**: `gemini-2.0-flash-exp` (experimental, requires paid tier)
- **Fallback**: `gemini-1.5-flash` (stable, free tier supported)
- **Configuration**: Controlled via `GEMINI_USE_EXPERIMENTAL` environment variable

#### Scope
- **Top N Matches**: Only compares the top 2 matches from Prong 1 (configurable via `k` parameter)
- **Cost Optimization**: Limits expensive AI calls to only the most promising candidates
- **Sequential Comparison**: When multiple images are uploaded (e.g., `new_1.jpg`, `new_2.jpg`, `new_3.jpg`), they are compared sequentially to corresponding database images (e.g., `existing_1.jpg`, `existing_2.jpg`, `existing_3.jpg`)

#### How It Works

1. **Image Retrieval**:
   - Uploaded images are stored as base64 data URLs
   - Database images are retrieved from the `image_urls` array field
   - If a matched record has no images, uploaded images are automatically stored for future comparisons

2. **Image Preparation**:
   - Images are converted to base64 format
   - MIME types are auto-detected (JPEG, PNG, GIF, PDF)
   - All images are sent to Gemini in order: uploaded images first, then database images

3. **AI Comparison**:
   - Gemini receives explicit instructions to compare images in sequential pairs
   - Analyzes:
     - Visual similarity (layout, design, colors, fonts)
     - Content similarity (text, messaging, branding)
     - Overall campaign match likelihood
   - Returns structured JSON with:
     - `isSimilar`: boolean
     - `confidence`: 0-1 scale
     - `reasoning`: brief explanation
     - `details`: detailed analysis

4. **Result Integration**:
   - Results are combined with text similarity scores
   - UI displays both metrics
   - "Very Likely a Copy" indicator shown when:
     - Text similarity > 90% AND
     - Gemini confirms similarity AND
     - Confidence > 70%

### Performance Characteristics
- **Time Complexity**: O(1) per comparison (API call)
- **Cost**: Per-request pricing (varies by model)
- **Accuracy**: High - understands visual context, not just text
- **Limitations**: Requires images to be stored; API rate limits apply

---

## Combined Workflow

```
1. User uploads campaign images
   ↓
2. AWS Textract extracts OCR text
   ↓
3. PostgreSQL trigram search (Prong 1)
   - Searches millions of records in milliseconds
   - Returns top 5 candidates (configurable)
   ↓
4. Gemini image comparison (Prong 2)
   - Compares uploaded images with top 2 candidates
   - Returns visual similarity assessment
   ↓
5. Results displayed to user
   - Text similarity score (from Prong 1)
   - Image comparison results (from Prong 2)
   - "Very Likely a Copy" indicator (when both confirm)
```

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER UPLOADS CAMPAIGN                            │
│                    (Images: new_1.jpg, new_2.jpg, ...)                    │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        AWS TEXTRACT (OCR)                                │
│              Extracts text from images → "Save 50% on..."                │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRONG 1: POSTGRESQL TRIGRAM SEARCH                    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  GIN Index (Generalized Inverted Index)                        │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │    │
│  │  │ Trigram  │  │ Trigram  │  │ Trigram  │  │ Trigram  │  ...  │    │
│  │  │ " Sav"   │→ │ "Sav"    │→ │ "ave"    │→ │ "ve "    │       │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │    │
│  │       │              │              │              │              │    │
│  │       └──────────────┴──────────────┴──────────────┘              │    │
│  │                      │                                             │    │
│  │                      ▼                                             │    │
│  │         ┌─────────────────────────────────────┐                  │    │
│  │         │  Records with matching trigrams      │                  │    │
│  │         │  ┌────────┐  ┌────────┐  ┌────────┐ │                  │    │
│  │         │  │Rec 1234│  │Rec 5678│  │Rec 9012│ │ ... (millions)   │    │
│  │         │  │ 95%    │  │ 87%    │  │ 72%    │ │                  │    │
│  │         │  └────────┘  └────────┘  └────────┘ │                  │    │
│  │         └─────────────────────────────────────┘                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Result: Top 5 candidates (sorted by similarity score)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Match #1 │  │ Match #2 │  │ Match #3 │  │ Match #4 │  │ Match #5 │  │
│  │  95%     │  │  87%     │  │  72%     │  │  65%     │  │  58%     │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
                                │ (Select top 2)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRONG 2: GEMINI IMAGE COMPARISON                     │
│                                                                          │
│  ┌──────────────────────┐              ┌──────────────────────┐        │
│  │  Uploaded Images     │              │  Database Images      │        │
│  │  ┌────────────────┐  │              │  ┌────────────────┐  │        │
│  │  │ new_1.jpg      │  │              │  │ existing_1.jpg │  │        │
│  │  │ new_2.jpg      │  │              │  │ existing_2.jpg │  │        │
│  │  │ new_3.jpg      │  │              │  │ existing_3.jpg │  │        │
│  │  └────────────────┘  │              │  └────────────────┘  │        │
│  └──────────┬───────────┘              └──────────┬───────────┘        │
│             │                                      │                     │
│             └──────────────┬───────────────────────┘                     │
│                            │                                             │
│                            ▼                                             │
│              ┌─────────────────────────────────────┐                    │
│              │  Gemini 2.0 Flash (Experimental)   │                    │
│              │  ┌───────────────────────────────┐ │                    │
│              │  │ Sequential Pair Comparison   │ │                    │
│              │  │ • new_1 ↔ existing_1          │ │                    │
│              │  │ • new_2 ↔ existing_2          │ │                    │
│              │  │ • new_3 ↔ existing_3          │ │                    │
│              │  └───────────────────────────────┘ │                    │
│              │                                     │                    │
│              │  Analysis:                          │                    │
│              │  • Visual similarity (layout, etc.)│                    │
│              │  • Content similarity (text, etc.)│                    │
│              │  • Overall match likelihood        │                    │
│              └──────────────┬──────────────────────┘                    │
│                             │                                           │
│                             ▼                                           │
│              ┌─────────────────────────────────────┐                    │
│              │  JSON Response                      │                    │
│              │  {                                  │                    │
│              │    "isSimilar": true,               │                    │
│              │    "confidence": 0.95,              │                    │
│              │    "reasoning": "...",              │                    │
│              │    "details": "..."                 │                    │
│              │  }                                  │                    │
│              └─────────────────────────────────────┘                    │
│                                                                          │
│  Result: Visual similarity assessment for top 2 matches                │
│  ┌──────────┐  ┌──────────┐                                            │
│  │ Match #1 │  │ Match #2 │                                            │
│  │ 95% text │  │ 87% text │                                            │
│  │ ✓ Similar│  │ ✗ Diff   │                                            │
│  │ 95% conf │  │ 45% conf │                                            │
│  └──────────┘  └──────────┘                                            │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         RESULT AGGREGATION                              │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Match #1:                                                        │  │
│  │  • Text Similarity: 95% (from Prong 1)                            │  │
│  │  • Image Similarity: ✓ Confirmed (from Prong 2)                  │  │
│  │  • Confidence: 95%                                                 │  │
│  │  • Status: ⚠️ VERY LIKELY A COPY (95% > 90% + AI confirmed)      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Match #2:                                                        │  │
│  │  • Text Similarity: 87% (from Prong 1)                            │  │
│  │  • Image Similarity: ✗ Different (from Prong 2)                   │  │
│  │  • Confidence: 45%                                                 │  │
│  │  • Status: Not a copy (text similar but images differ)            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                                  │
│              Displays matches with combined results                      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
                    ┌─────────────┐
                    │   Upload    │
                    │   Images    │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Textract   │
                    │  (OCR)      │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │             │
                    ▼             ▼
            ┌──────────────┐  ┌──────────────┐
            │   Prong 1    │  │   Prong 2    │
            │   (Text)     │  │  (Images)    │
            │              │  │              │
            │ PostgreSQL   │  │   Gemini     │
            │ Trigram      │  │  2.0 Flash   │
            │ Search       │  │  (AI)        │
            │              │  │              │
            │ Millions →   │  │ Top 2 →      │
            │ Top 5        │  │ Compare      │
            └──────┬───────┘  └──────┬───────┘
                   │                 │
                   └────────┬────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │  Aggregate  │
                    │   Results   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │     UI      │
                    │  Display    │
                    └─────────────┘
```

## Why This Architecture Works

1. **Efficiency**: Text search filters 99.99% of records before expensive AI calls
2. **Accuracy**: AI verification catches false positives from text-only matching
3. **Scalability**: GIN index ensures fast searches even with millions of records
4. **Cost-Effective**: Only top candidates use expensive AI comparisons
5. **User Experience**: Fast response times (< 5 seconds for most queries)

## Configuration

- **Top candidates from Prong 1**: `k` parameter in `search_campaigns()` function (default: 5)
- **Top candidates for Prong 2**: Hardcoded to top 2 in `src/app/api/upload/route.ts` (line 160: `matches.slice(0, 2)`)
- **Gemini model**: Controlled via `GEMINI_USE_EXPERIMENTAL` environment variable
- **Similarity threshold**: 90% text similarity + 70% AI confidence for "Very Likely a Copy" indicator

