import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("GOOGLE_GEMINI_API_KEY is not set. Image comparison will not work.");
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export interface ImageComparisonResult {
  isSimilar: boolean;
  confidence: number; // 0-1 scale
  reasoning: string;
  details: string;
}

/**
 * Compare uploaded images with images from database records using Gemini 2.5 Flash
 * @param uploadedImages Array of image buffers (from uploaded files)
 * @param databaseImages Array of image buffers (from database records)
 * @returns Comparison result with similarity assessment
 */
export async function compareImagesWithGemini(
  uploadedImages: Buffer[],
  databaseImages: Buffer[],
): Promise<ImageComparisonResult> {
  if (!genAI) {
    throw new Error("Gemini API key is not configured");
  }

  if (uploadedImages.length === 0 || databaseImages.length === 0) {
    return {
      isSimilar: false,
      confidence: 0,
      reasoning: "No images provided for comparison",
      details: "At least one uploaded image and one database image is required",
    };
  }

  try {
    // Try gemini-2.0-flash-exp first (experimental, requires paid tier)
    // Fall back to gemini-1.5-flash (stable, free tier supported)
    // To enable paid tier: Enable billing in Google Cloud Console
    let model;
    const useExperimental = process.env.GEMINI_USE_EXPERIMENTAL === "true";
    
    if (useExperimental) {
      try {
        model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      } catch {
        // Fallback to stable if experimental fails
        model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      }
    } else {
      model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    // Helper to detect mime type from buffer
    const detectMimeType = (buffer: Buffer): string => {
      // Check magic bytes for common image formats
      if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
      if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
      if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
      if (buffer[0] === 0x25 && buffer[1] === 0x50) return "application/pdf"; // PDF
      return "image/jpeg"; // Default fallback
    };

    // Convert buffers to base64 for Gemini
    const uploadedBase64 = uploadedImages.map((buf) => ({
      inlineData: {
        data: buf.toString("base64"),
        mimeType: detectMimeType(buf),
      },
    }));

    const databaseBase64 = databaseImages.map((buf) => ({
      inlineData: {
        data: buf.toString("base64"),
        mimeType: detectMimeType(buf),
      },
    }));

    const prompt = `You are an expert at comparing marketing campaign images. Compare the uploaded campaign images with the database campaign images.

Uploaded images: ${uploadedImages.length} image(s)
Database images: ${databaseImages.length} image(s)

Analyze:
1. Visual similarity (layout, design, colors, fonts)
2. Content similarity (text, messaging, branding)
3. Overall campaign match likelihood

Respond with a JSON object in this exact format:
{
  "isSimilar": boolean,
  "confidence": number (0-1, where 1 is very confident they are the same campaign),
  "reasoning": "brief explanation of your assessment",
  "details": "detailed analysis of similarities and differences"
}

Be strict: only mark as similar if the images appear to be from the same campaign or very similar campaigns.`;

    const parts = [
      { text: prompt },
      ...uploadedBase64,
      ...databaseBase64,
    ];

    const result = await model.generateContent({ contents: [{ role: "user", parts }] });
    const response = result.response;
    const text = response.text();

    // Try to extract JSON from the response
    let comparisonResult: ImageComparisonResult;
    try {
      // Look for JSON in the response (might be wrapped in markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        comparisonResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      // Fallback: try to parse the entire response
      try {
        comparisonResult = JSON.parse(text);
      } catch {
        // If parsing fails, create a result from the text
        const lowerText = text.toLowerCase();
        const isSimilar = lowerText.includes("similar") || lowerText.includes("match") || lowerText.includes("same");
        const confidenceMatch = text.match(/confidence[:\s]+([0-9.]+)/i);
        const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : (isSimilar ? 0.7 : 0.3);

        comparisonResult = {
          isSimilar,
          confidence: Math.min(1, Math.max(0, confidence)),
          reasoning: text.substring(0, 200),
          details: text,
        };
      }
    }

    return comparisonResult;
  } catch (error) {
    console.error("Gemini image comparison error:", error);
    
    // Check if it's a quota/rate limit error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
      throw new Error(
        `Gemini API rate limit exceeded. The free tier has usage limits. Please wait a moment and try again, or check your quota at https://ai.dev/usage?tab=rate-limit`,
      );
    }
    
    throw new Error(
      `Failed to compare images with Gemini: ${errorMessage}`,
    );
  }
}

