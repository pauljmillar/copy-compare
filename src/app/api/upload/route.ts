import { NextRequest, NextResponse } from "next/server";
import { extractTextFromBuffer } from "@/lib/textract";
import { createServiceClient } from "@/lib/supabaseServer";
import type { CampaignMatch, UploadResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("file") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "At least one file is required." },
        { status: 400 },
      );
    }

    // Validate all files
    for (const file of files) {
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Invalid file provided." },
          { status: 400 },
        );
      }
      if (file.size === 0) {
        return NextResponse.json(
          { error: `The file "${file.name}" is empty.` },
          { status: 400 },
        );
      }
    }

    // Process all files and merge OCR text
    const ocrTexts: string[] = [];
    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const text = await extractTextFromBuffer(buffer);
        if (text.trim()) {
          ocrTexts.push(text.trim());
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        // Continue with other files even if one fails
      }
    }

    // Merge all OCR text with double newlines between files
    const ocrText = ocrTexts.join("\n\n");

    let matches: CampaignMatch[] = [];

    // Try to search for similar campaigns, but don't fail if it doesn't work
    try {
      const supabase = createServiceClient();
      
      if (ocrText.trim()) {
        try {
          const { data, error } = await supabase.rpc("search_campaigns", {
            q: ocrText,
            k: 5,
          });

          if (error) {
            // Log the error but don't fail the upload - user can still insert a new campaign
            console.error("Supabase search error:", error);
            // Continue with empty matches array - this handles cases where:
            // - Database is empty (first upload)
            // - Function doesn't exist yet
            // - Connection issues
            matches = [];
          } else {
            matches = data ?? [];
          }
        } catch (fetchError) {
          // Network/fetch errors - log but continue
          console.error("Network error during search:", fetchError);
          matches = [];
        }
      }
    } catch (clientError) {
      // Client creation error (missing env vars, invalid URL, etc.)
      console.error("Failed to create Supabase client:", clientError);
      // Continue with empty matches - user can still insert a new campaign
      matches = [];
    }

    const payload: UploadResponse = {
      text: ocrText,
      matches,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      { error: "Unexpected error processing the upload." },
      { status: 500 },
    );
  }
}
