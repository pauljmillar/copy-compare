import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseServer";
import { confirmSelectionSchema } from "@/lib/schema";
import type { CampaignRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = confirmSelectionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid payload." },
        { status: 400 },
      );
    }

    const { id } = parseResult.data;
    const supabase = createServiceClient();

    const { data, error: selectError } = await supabase
      .from("campaigns")
      .select("occurrences")
      .eq("id", id)
      .returns<{ occurrences: number | null }>()
      .maybeSingle();

    if (selectError || !data) {
      console.error("Supabase select error:", selectError);
      return NextResponse.json(
        { error: "Campaign not found." },
        { status: 404 },
      );
    }

    const occurrences =
      (data as { occurrences: number | null }).occurrences ?? 0;
    const newCount = occurrences + 1;

    const { error: updateError } = await supabase
      .from("campaigns")
      .update({ occurrences: newCount } as Partial<CampaignRecord>)
      .eq("id", id);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update occurrences." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, occurrences: newCount });
  } catch (error) {
    console.error("Confirm API error:", error);
    return NextResponse.json(
      { error: "Unexpected error updating the campaign." },
      { status: 500 },
    );
  }
}
