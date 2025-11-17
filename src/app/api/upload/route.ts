import { NextRequest, NextResponse } from "next/server";
import { extractTextFromBuffer } from "@/lib/textract";
import { createServiceClient } from "@/lib/supabaseServer";
import { compareImagesWithGemini } from "@/lib/gemini";
import type { CampaignMatch, UploadResponse, ImageComparisonResult } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Convert base64 data URL to Buffer
 */
function base64DataUrlToBuffer(dataUrl: string): Buffer | null {
  try {
    // Handle data URLs like "data:image/jpeg;base64,/9j/4AAQ..."
    const base64Match = dataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (base64Match) {
      return Buffer.from(base64Match[1], "base64");
    }
    // If it's already base64 without data URL prefix, try to decode it
    return Buffer.from(dataUrl, "base64");
  } catch {
    return null;
  }
}

/**
 * Detect MIME type from buffer magic bytes
 */
function detectMimeType(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
  if (buffer[0] === 0x25 && buffer[1] === 0x50) return "application/pdf";
  return "image/jpeg"; // Default fallback
}

/**
 * Convert buffer to base64 data URL
 */
function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

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

    // Process all files and merge OCR text, also store image buffers
    const ocrTexts: string[] = [];
    const uploadedImageBuffers: Buffer[] = [];
    
    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Store image buffer for comparison
        uploadedImageBuffers.push(buffer);
        
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
    let imageComparisons: ImageComparisonResult[] = [];

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

      // Convert uploaded images to base64 data URLs for storage
      const uploadedImageDataUrls: string[] = [];
      for (const buffer of uploadedImageBuffers) {
        const mimeType = detectMimeType(buffer);
        uploadedImageDataUrls.push(bufferToDataUrl(buffer, mimeType));
      }

      // Perform image comparison with top 2 matches using Gemini
      if (matches.length > 0 && uploadedImageBuffers.length > 0) {
        const topMatches = matches.slice(0, 2); // Get top 2 matches
        
        for (const match of topMatches) {
          // If match doesn't have images, store the uploaded images to that record
          if (!match.image_urls || match.image_urls.length === 0) {
            console.log(`Match ${match.id} has no images. Storing uploaded images to this record...`);
            
            try {
              const { error: updateError } = await supabase
                .from("campaigns")
                .update({ image_urls: uploadedImageDataUrls })
                .eq("id", match.id);

              if (updateError) {
                console.error(`Failed to update images for match ${match.id}:`, updateError);
              } else {
                console.log(`Successfully stored ${uploadedImageDataUrls.length} image(s) to match ${match.id}`);
                // Update the match object so it has images for comparison
                match.image_urls = uploadedImageDataUrls;
              }
            } catch (updateError) {
              console.error(`Error updating images for match ${match.id}:`, updateError);
              // Continue even if update fails
            }
          }

          // Now perform comparison if we have images (either from DB or just stored)
          if (match.image_urls && match.image_urls.length > 0) {
            try {
              // Convert database image URLs/base64 to buffers
              const databaseImageBuffers: Buffer[] = [];
              for (const imageUrl of match.image_urls) {
                const buffer = base64DataUrlToBuffer(imageUrl);
                if (buffer) {
                  databaseImageBuffers.push(buffer);
                }
              }

              if (databaseImageBuffers.length === 0) {
                console.log(`Could not decode images for match ${match.id}, skipping comparison`);
                continue; // Skip if we couldn't decode any images
              }

              // Compare images using Gemini
              console.log(`Comparing images for match ${match.id} using Gemini...`);
              const comparison = await compareImagesWithGemini(
                uploadedImageBuffers,
                databaseImageBuffers,
              );

              console.log(`Gemini comparison result for match ${match.id}:`, {
                isSimilar: comparison.isSimilar,
                confidence: comparison.confidence,
              });

              imageComparisons.push({
                matchId: match.id,
                isSimilar: comparison.isSimilar,
                confidence: comparison.confidence,
                reasoning: comparison.reasoning,
                details: comparison.details,
              });
            } catch (geminiError) {
              console.error(`Error comparing images for match ${match.id}:`, geminiError);
              // Continue with other matches even if one fails
            }
          }
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
      imageComparisons: imageComparisons.length > 0 ? imageComparisons : undefined,
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
