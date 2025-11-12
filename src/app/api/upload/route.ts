import { NextRequest, NextResponse } from "next/server";
import { extractTextFromBuffer } from "@/lib/textract";
import { createServiceClient } from "@/lib/supabaseServer";
import type { CampaignMatch, UploadResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "A file is required." },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "The uploaded file is empty." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ocrText = await extractTextFromBuffer(buffer);

    const supabase = createServiceClient();
    let matches: CampaignMatch[] = [];

    if (ocrText.trim()) {
      const { data, error } = await supabase.rpc("search_campaigns", {
        q: ocrText,
        k: 5,
      });

      if (error) {
        console.error("Supabase search error:", error);
        return NextResponse.json(
          { error: "Failed to search for similar campaigns." },
          { status: 500 },
        );
      }

      matches = data ?? [];
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
