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

#### Technical Deep Dive: GIN Index Structure

**What is an Inverted Index?**

A traditional index maps: `Record ID → Data`
```
Record 123 → "Save 50% on premium services"
Record 456 → "Get 30% off today"
Record 789 → "Save big on services"
```

An **inverted index** flips this: `Token → [Record IDs]`
```
" Sa" → [123, 789]
"Sav" → [123, 789]
"ave" → [123]
"ve " → [123]
" 50" → [123]
"50%" → [123]
"Get" → [456]
" 30" → [456]
"30%" → [456]
"big" → [789]
...
```

**How GIN Index Stores Trigrams:**

1. **Index Creation (One-time):**
   - PostgreSQL scans all existing records in the `body` column
   - For each record, extracts all trigrams from the text
   - Builds the inverted mapping: `trigram → [record_ids]`
   - Stores this in a B-tree structure for fast lookups

2. **On INSERT:**
   ```
   INSERT INTO campaigns (body) VALUES ('Save 50% on premium services');
   ```
   - PostgreSQL extracts trigrams: `" Sa"`, `"Sav"`, `"ave"`, `"ve "`, `" 50"`, `"50%"`, `"% o"`, `" on"`, etc.
   - For each trigram, adds the new record ID to its posting list:
     - `" Sa"` → [..., new_id]
     - `"Sav"` → [..., new_id]
     - `"ave"` → [..., new_id]
     - etc.
   - This happens automatically - no application code needed

3. **On UPDATE:**
   - Old trigrams are removed from their posting lists
   - New trigrams are added to their posting lists
   - Only changed trigrams are updated (efficient)

4. **On DELETE:**
   - Record ID is removed from all trigram posting lists
   - Index entries with empty lists may be cleaned up

**Query Execution Process:**

When you search: `SELECT * FROM campaigns WHERE body % 'Save 50%'`

1. **Query Trigram Extraction:**
   - Query text: `"Save 50%"`
   - Trigrams: `" Sa"`, `"Sav"`, `"ave"`, `"ve "`, `" 50"`, `"50%"`

2. **Index Lookups (Parallel):**
   ```
   Lookup " Sa" → [123, 789, 1011, ...]
   Lookup "Sav" → [123, 789, ...]
   Lookup "ave" → [123, 456, 789, ...]
   Lookup "ve " → [123, 1011, ...]
   Lookup " 50" → [123, 2022, ...]
   Lookup "50%" → [123, ...]
   ```

3. **Set Intersection:**
   - Find records that appear in multiple posting lists
   - Records appearing in more lists = more matching trigrams = higher similarity
   - Example: Record 123 appears in all 6 lists → high similarity
   - Record 789 appears in 3 lists → medium similarity

4. **Similarity Calculation:**
   - For each candidate record, calculate: `matching_trigrams / total_unique_trigrams`
   - Sort by similarity score (descending)
   - Return top k results

**Storage Structure:**

The GIN index uses a B-tree structure internally:
```
B-tree Root
├── Trigram " 50" → Posting List [123, 2022, 3033, ...]
├── Trigram " 30" → Posting List [456, 789, ...]
├── Trigram " Sa" → Posting List [123, 789, 1011, ...]
├── Trigram "Sav" → Posting List [123, 789, ...]
└── ... (sorted alphabetically by trigram)
```

**Performance Characteristics:**

- **Lookup Time**: O(log n) to find a trigram in the B-tree, then O(m) to read the posting list (where m = number of records with that trigram)
- **Set Intersection**: Optimized using bitmap operations or sorted list merges
- **Storage**: Typically 20-50% of the original text column size
- **Maintenance**: Automatic on INSERT/UPDATE/DELETE (small overhead per operation)

**Why This is Fast:**

1. **No Full Table Scan**: Instead of checking every record, PostgreSQL only looks at records that share trigrams
2. **Parallel Lookups**: Multiple trigram lookups can happen simultaneously
3. **Efficient Set Operations**: PostgreSQL uses optimized algorithms for set intersection
4. **Index-Only Operations**: Similarity calculation can often be done using only the index

**Example Walkthrough:**

Given 3 records:
- Record 123: `"Save 50% on premium services"`
- Record 456: `"Get 30% off today"`
- Record 789: `"Save big on services"`

Query: `"Save 50%"`

**Step 1: Extract query trigrams**
- `" Sa"`, `"Sav"`, `"ave"`, `"ve "`, `" 50"`, `"50%"`

**Step 2: Index lookups**
- `" Sa"` → [123, 789]
- `"Sav"` → [123, 789]
- `"ave"` → [123]
- `"ve "` → [123]
- `" 50"` → [123]
- `"50%"` → [123]

**Step 3: Count matches per record**
- Record 123: appears in all 6 lists → 6 matching trigrams
- Record 789: appears in 2 lists → 2 matching trigrams
- Record 456: appears in 0 lists → 0 matching trigrams

**Step 4: Calculate similarity**
- Record 123: 6 matching / ~30 total trigrams ≈ 20% similarity (but with `%` operator, it's actually higher)
- Record 789: 2 matching / ~25 total trigrams ≈ 8% similarity
- Record 456: 0 matching → filtered out by `%` operator

**Step 5: Return results**
- Sorted by similarity: [123, 789]

#### Posting List Growth and Scale

**Yes, posting lists grow with each matching record:**

When a new record is inserted that contains a trigram, that record ID is appended to the posting list:

```
Initial state:
" Sa" → [123, 789]

After INSERT INTO campaigns (body) VALUES ('Save big today'):
" Sa" → [123, 789, 456]  ← New record 456 added
```

**At scale:**
- If 1 million records all contain the trigram `" Sa"`, the posting list will contain 1 million record IDs
- PostgreSQL handles this efficiently using:
  - **Compressed storage**: Record IDs are stored in sorted order, allowing delta compression
  - **Bitmap indexes**: For very large lists, PostgreSQL may use bitmap representations
  - **B-tree structure**: Even with millions of entries, lookups remain O(log n)

**Example at scale:**
```
" the" → [1, 2, 3, 4, 5, ..., 999998, 999999, 1000000]  (1M entries)
" and" → [1, 5, 12, 23, ..., 999995]  (500K entries)
" Sa" → [123, 789, 1011, 2022, ...]  (10K entries)
```

The index size grows, but query performance remains fast because:
- Only relevant trigrams are looked up (not all 1M records)
- Set intersection operations are highly optimized
- Most queries only need a small subset of all trigrams

#### Trigrams and Word Order

**Key Point: Trigrams are position-agnostic, but word order still matters indirectly.**

Trigrams don't preserve the original position of words in the text. However, word order affects which trigrams are generated, which in turn affects similarity scores.

**Example: Different word orders**

Text 1: `"I cleaned with Bob"`
- Trigrams: `" I "`, `" I c"`, `"I c"`, `" cl"`, `"cle"`, `"lea"`, `"ean"`, `"an "`, `"n w"`, `" wi"`, `"wit"`, `"ith"`, `"th "`, `"h B"`, `" Bo"`, `"Bob"`, `"ob "`

Text 2: `"Bob did not clean"`
- Trigrams: `" Bo"`, `"Bob"`, `"ob "`, `"b d"`, `" di"`, `"did"`, `"id "`, `"d n"`, `" no"`, `"not"`, `"ot "`, `"t c"`, `" cl"`, `"cle"`, `"lea"`, `"ean"`, `"an "`

**Shared trigrams:**
- `" Bo"`, `"Bob"`, `"ob "` (from "Bob")
- `" cl"`, `"cle"`, `"lea"`, `"ean"`, `"an "` (from "clean")

**Analysis:**
- They share 8 trigrams out of ~17-18 total unique trigrams
- Similarity: ~8/18 ≈ 44% (moderate similarity)
- The similarity is lower than if the words were in the same order because:
  - Different word order = different character sequences = different trigrams
  - `"I cleaned with Bob"` has trigrams like `"ean"`, `"an "`, `"n w"`, `" wi"`, `"wit"`, `"ith"`, `"th "`, `"h B"` that don't exist in `"Bob did not clean"`
  - `"Bob did not clean"` has trigrams like `"b d"`, `" di"`, `"did"`, `"id "`, `"d n"`, `" no"`, `"not"`, `"ot "`, `"t c"` that don't exist in `"I cleaned with Bob"`

**What this means:**
- ✅ Trigrams capture partial matches even when word order differs
- ✅ Common words/phrases still produce high similarity scores
- ⚠️ Exact word order produces higher similarity than scrambled words
- ⚠️ Trigrams don't understand semantics - they're purely character-based

**Real-world example:**

Query: `"Save 50% on premium services"`

Match 1: `"Save 50% on premium services"` (exact match)
- All trigrams match → 100% similarity

Match 2: `"Save 50% on services premium"` (words reordered)
- Most trigrams match, but the boundary trigrams differ:
  - Sentence 1: `"um "` (end of "premium" + space), `"m s"` (premium→services), `" se"` (space + start of "services")
  - Sentence 2: `"es "` (end of "services" + space), `"s p"` (services→premium), `" pr"` (space + start of "premium")
- These boundary trigrams account for the ~5% difference
- Similarity: ~95% (very high, but slightly lower)

**Detailed trigram breakdown for "premium services" vs "services premium":**

Sentence 1: `"...premium services..."`
- Trigrams: `"pre"`, `"rem"`, `"emi"`, `"miu"`, `"ium"`, `"um "`, `"m s"`, `" se"`, `"ser"`, `"erv"`, `"rvi"`, `"vic"`, `"ice"`, `"ces"`, `"es "`

Sentence 2: `"...services premium..."`
- Trigrams: `"ser"`, `"erv"`, `"rvi"`, `"vic"`, `"ice"`, `"ces"`, `"es "`, `"s p"`, `" pr"`, `"pre"`, `"rem"`, `"emi"`, `"miu"`, `"ium"`, `"um "`

**Shared trigrams (13):**
- `"pre"`, `"rem"`, `"emi"`, `"miu"`, `"ium"`, `"um "` (from "premium")
- `"ser"`, `"erv"`, `"rvi"`, `"vic"`, `"ice"`, `"ces"`, `"es "` (from "services")

**Unique to Sentence 1 (2):**
- `"m s"` (boundary: premium→services)
- `" se"` (boundary: space→services)

**Unique to Sentence 2 (2):**
- `"s p"` (boundary: services→premium)
- `" pr"` (boundary: space→premium)

**Result:** 13 shared / 15 total unique = ~87% similarity for this phrase pair. When combined with the rest of the sentence (which matches exactly), the overall similarity is ~95%.

Match 3: `"50% Save premium services on"` (heavily reordered)
- Many trigrams still match (`" 50"`, `"50%"`, `" Sa"`, `"Sav"`, `"ave"`, `"ium"`, `"um "`, etc.)
- But missing sequential trigrams like `"ve "`, `" 50"` (from "Save 50%")
- Similarity: ~70% (moderate)

Match 4: `"premium services 50% Save on"` (completely scrambled)
- Still shares many trigrams, but fewer sequential matches
- Similarity: ~60% (lower)

**Why this works well for campaign detection:**
- Campaign copies often have the same or very similar word order → high similarity
- Paraphrased campaigns share many trigrams → moderate similarity (caught by Gemini)
- Completely different campaigns share few trigrams → low similarity (filtered out)

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

