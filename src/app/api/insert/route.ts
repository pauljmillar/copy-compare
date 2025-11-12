import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseServer";
import { insertCampaignSchema } from "@/lib/schema";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = insertCampaignSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const payload = parseResult.data;
    const supabase = createServiceClient();

    const { error } = await supabase.from("campaigns").insert({
      company_name: payload.company_name,
      campaign: payload.campaign,
      channel: payload.channel,
      sent_at: payload.sent_at ?? new Date().toISOString(),
      body: payload.body,
      occurrences: 1,
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to insert campaign." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Insert API error:", error);
    return NextResponse.json(
      { error: "Unexpected error inserting a new campaign." },
      { status: 500 },
    );
  }
}
