"use client";

import { useState, useRef } from "react";
import { UploadModal } from "@/components/UploadModal";
import { CampaignsTable } from "@/components/CampaignsTable";
import { Typography } from "@material-tailwind/react";

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const howItWorksRef = useRef<HTMLDivElement>(null);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const scrollToHowItWorks = () => {
    howItWorksRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white shadow-sm">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Typography variant="h5" color="blue-gray" className="font-bold" {...({} as any)}>
              Campaign Copy Detection
            </Typography>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={scrollToHowItWorks}
              className="text-sm font-medium text-slate-700 transition hover:text-blue-600"
            >
              How It Works
            </button>
            <UploadModal onSuccess={handleRefresh} />
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <Typography variant="h1" color="blue-gray" className="mb-6 font-bold" {...({} as any)}>
              Detect Duplicate Marketing Campaigns
            </Typography>
            <Typography variant="lead" color="gray" className="mb-8 text-lg" {...({} as any)}>
              Upload your marketing assets and instantly identify if they're copies of existing campaigns.
              Our AI-powered system uses advanced text similarity and image comparison to find matches.
            </Typography>
            <div className="flex justify-center">
              <UploadModal onSuccess={handleRefresh} />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-6 py-12">
          {/* Campaigns Table Section */}
          <section className="mb-16">
            <div className="mb-6">
              <Typography variant="h3" color="blue-gray" className="mb-2 font-semibold" {...({} as any)}>
                All Campaigns
              </Typography>
              <Typography variant="paragraph" color="gray" className="text-slate-600" {...({} as any)}>
                View, search, and sort all campaigns in the database
              </Typography>
            </div>
            <CampaignsTable refreshTrigger={refreshTrigger} />
          </section>

          {/* How It Works Section */}
          <section id="how-it-works" ref={howItWorksRef} className="rounded-2xl bg-white p-10 shadow-lg ring-1 ring-slate-900/5">
            <Typography variant="h3" color="blue-gray" className="mb-4 font-semibold" {...({} as any)}>
              How It Works
            </Typography>
            <Typography variant="paragraph" color="gray" className="mb-8 text-slate-600" {...({} as any)}>
              Our system uses a <strong>2-pronged approach</strong> to efficiently identify duplicate marketing campaigns at scale, combining fast text-based filtering with sophisticated AI-powered image comparison.
            </Typography>
            
            {/* Prong 1: PostgreSQL Trigram Search */}
            <div className="mb-12 rounded-lg border border-blue-200 bg-blue-50/50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white">
                  <span className="text-sm font-bold">1</span>
                </div>
                <Typography variant="h4" color="blue-gray" className="font-semibold" {...({} as any)}>
                  Prong 1: PostgreSQL Trigram Similarity Search
                </Typography>
              </div>
              
              <Typography variant="paragraph" color="gray" className="mb-4 text-slate-700" {...({} as any)}>
                <strong>Purpose:</strong> Fast candidate filtering - Narrow down millions of potential matches to a small set of top candidates (default: top 5) before performing expensive AI image comparisons.
              </Typography>

              <div className="space-y-4">
                <div>
                  <Typography variant="h6" color="blue-gray" className="mb-2 font-semibold" {...({} as any)}>
                    What are Trigrams?
                  </Typography>
                  <Typography variant="paragraph" color="gray" className="text-slate-600" {...({} as any)}>
                    A <strong>trigram</strong> is a sequence of 3 consecutive characters from a text string. For example, the word "campaign" generates these trigrams: <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">" ca"</code>, <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">"cam"</code>, <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">"amp"</code>, <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">"mpa"</code>, etc.
                  </Typography>
                </div>

                <div>
                  <Typography variant="h6" color="blue-gray" className="mb-2 font-semibold" {...({} as any)}>
                    The Similarity Algorithm
                  </Typography>
                  <ol className="ml-4 list-decimal space-y-2 text-slate-600">
                    <li><strong>Text Extraction:</strong> OCR text is extracted from uploaded images using AWS Textract</li>
                    <li><strong>Trigram Generation:</strong> Both the query text and database records are broken down into trigrams</li>
                    <li><strong>Overlap Calculation:</strong> PostgreSQL calculates how many trigrams overlap between the query and each database record</li>
                    <li><strong>Similarity Score:</strong> <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">similarity = (matching trigrams) / (total unique trigrams)</code> - returns a value between 0 and 1</li>
                  </ol>
                </div>

                <div>
                  <Typography variant="h6" color="blue-gray" className="mb-2 font-semibold" {...({} as any)}>
                    The GIN Index (Generalized Inverted Index)
                  </Typography>
                  <Typography variant="paragraph" color="gray" className="mb-2 text-slate-600" {...({} as any)}>
                    Instead of indexing documents, the GIN index indexes trigrams. This enables:
                  </Typography>
                  <ul className="ml-4 list-disc space-y-1 text-slate-600">
                    <li><strong>Fast Lookup:</strong> For each trigram in the query, the index immediately points to all records containing that trigram</li>
                    <li><strong>Set Intersection:</strong> PostgreSQL efficiently finds records that share multiple trigrams with the query</li>
                    <li><strong>Performance:</strong> O(log n) time complexity - queries that would take minutes on millions of rows complete in milliseconds</li>
                  </ul>
                </div>

                <div className="rounded-lg bg-slate-100 p-4">
                  <Typography variant="small" color="blue-gray" className="mb-2 font-semibold" {...({} as any)}>
                    Example:
                  </Typography>
                  <Typography variant="paragraph" color="gray" className="text-sm text-slate-600" {...({} as any)}>
                    Query: <code>"Save 50% on premium services"</code><br />
                    Trigrams: <code>" Sa"</code>, <code>"Sav"</code>, <code>"ave"</code>, <code>"ve "</code>, <code>" 50"</code>, <code>"50%"</code>, etc.<br />
                    The index finds all records containing these trigrams, and records with more matching trigrams receive higher similarity scores.
                  </Typography>
                </div>
              </div>
            </div>

            {/* Prong 2: Gemini Image Comparison */}
            <div className="mb-8 rounded-lg border border-green-200 bg-green-50/50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white">
                  <span className="text-sm font-bold">2</span>
                </div>
                <Typography variant="h4" color="blue-gray" className="font-semibold" {...({} as any)}>
                  Prong 2: Gemini Image Comparison
                </Typography>
              </div>
              
              <Typography variant="paragraph" color="gray" className="mb-4 text-slate-700" {...({} as any)}>
                <strong>Purpose:</strong> Visual verification - Confirm that the top candidates from Prong 1 are actually visual copies, not just textually similar campaigns.
              </Typography>

              <div className="space-y-4">
                <div>
                  <Typography variant="h6" color="blue-gray" className="mb-2 font-semibold" {...({} as any)}>
                    Why Image Comparison is Necessary
                  </Typography>
                  <ul className="ml-4 list-disc space-y-1 text-slate-600">
                    <li>Different campaigns can share similar text (e.g., "50% off sale" appears in many campaigns)</li>
                    <li>Visual design matters (same text, different layout/colors = different campaign)</li>
                    <li>Image-based campaigns may have minimal text but identical visuals</li>
                    <li>False positives from text search need visual confirmation</li>
                  </ul>
                </div>

                <div>
                  <Typography variant="h6" color="blue-gray" className="mb-2 font-semibold" {...({} as any)}>
                    Implementation Details
                  </Typography>
                  <ul className="ml-4 list-disc space-y-1 text-slate-600">
                    <li><strong>Model:</strong> Gemini 2.0 Flash (experimental) or Gemini 1.5 Flash (stable fallback)</li>
                    <li><strong>Scope:</strong> Only compares the top 2 matches from Prong 1 (configurable) to optimize costs</li>
                    <li><strong>Sequential Comparison:</strong> When multiple images are uploaded (e.g., <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">new_1.jpg</code>, <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">new_2.jpg</code>), they are compared sequentially to corresponding database images (e.g., <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">existing_1.jpg</code>, <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">existing_2.jpg</code>)</li>
                    <li><strong>Analysis:</strong> Gemini evaluates visual similarity (layout, design, colors, fonts), content similarity (text, messaging, branding), and overall campaign match likelihood</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Combined Result */}
            <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-6">
              <Typography variant="h5" color="blue-gray" className="mb-4 font-semibold" {...({} as any)}>
                Combined Result
              </Typography>
              <Typography variant="paragraph" color="gray" className="mb-3 text-slate-700" {...({} as any)}>
                Results from both prongs are combined to provide a comprehensive assessment:
              </Typography>
              <ul className="ml-4 list-disc space-y-2 text-slate-600">
                <li><strong>Text Similarity Score</strong> from Prong 1 (0-100%)</li>
                <li><strong>Image Comparison Result</strong> from Prong 2 (similar/different with confidence score)</li>
                <li><strong>"Very Likely a Copy" Indicator</strong> appears when:
                  <ul className="ml-4 mt-1 list-disc">
                    <li>Text similarity &gt; 90% AND</li>
                    <li>Gemini confirms images are similar AND</li>
                    <li>AI confidence &gt; 70%</li>
                  </ul>
                </li>
              </ul>
            </div>

            {/* More About Trigram Matching */}
            <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-6">
              <Typography variant="h5" color="blue-gray" className="mb-4 font-semibold" {...({} as any)}>
                More About Trigram Matching: Why Word Order Matters
              </Typography>
              
              <Typography variant="paragraph" color="gray" className="mb-4 text-slate-600" {...({} as any)}>
                Trigrams are <strong>position-agnostic</strong> (they don't remember where in the text they came from), but <strong>word order still affects similarity scores</strong> because it determines which trigrams are generated.
              </Typography>

              <div className="mb-4 rounded-lg bg-white p-4">
                <Typography variant="h6" color="blue-gray" className="mb-3 font-semibold" {...({} as any)}>
                  Example: Word Reordering Impact
                </Typography>
                <div className="space-y-3 text-sm">
                  <div>
                    <Typography variant="small" color="blue-gray" className="font-semibold" {...({} as any)}>
                      Exact Match:
                    </Typography>
                    <Typography variant="paragraph" color="gray" className="text-slate-600" {...({} as any)}>
                      <code className="rounded bg-slate-100 px-1 py-0.5">"Save 50% on premium services"</code> → <strong>100% similarity</strong>
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="small" color="blue-gray" className="font-semibold" {...({} as any)}>
                      Reordered:
                    </Typography>
                    <Typography variant="paragraph" color="gray" className="text-slate-600" {...({} as any)}>
                      <code className="rounded bg-slate-100 px-1 py-0.5">"Save 50% on services premium"</code> → <strong>~95% similarity</strong>
                    </Typography>
                    <Typography variant="small" color="gray" className="mt-1 text-slate-500" {...({} as any)}>
                      The 5% difference comes from boundary trigrams: <code>"m s"</code> and <code>" se"</code> (premium→services) vs <code>"s p"</code> and <code>" pr"</code> (services→premium)
                    </Typography>
                  </div>
                </div>
              </div>

              <Typography variant="paragraph" color="gray" className="mb-2 text-slate-600" {...({} as any)}>
                <strong>Why this works well for campaign detection:</strong>
              </Typography>
              <ul className="ml-4 list-disc space-y-1 text-slate-600">
                <li>Campaign copies often have the same word order → high similarity (90%+)</li>
                <li>Paraphrased campaigns share many trigrams → moderate similarity (caught by Gemini image comparison)</li>
                <li>Completely different campaigns share few trigrams → low similarity (filtered out)</li>
              </ul>

              <div className="mt-4 rounded-lg bg-blue-50 p-4">
                <Typography variant="small" color="blue-gray" className="font-semibold" {...({} as any)}>
                  💡 Pro Tip
                </Typography>
                <Typography variant="paragraph" color="gray" className="mt-1 text-sm text-slate-600" {...({} as any)}>
                  For multi-page documents, name your files with sequence numbers (e.g., <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">campaign_0.jpg</code>, <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">campaign_1.jpg</code>) to ensure proper sequential ordering during OCR and image comparison.
                </Typography>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto w-full max-w-7xl px-6 text-center">
          <Typography variant="small" color="gray" className="text-slate-600" {...({} as any)}>
            Campaign Copy Detection System
          </Typography>
        </div>
      </footer>
    </div>
  );
}
