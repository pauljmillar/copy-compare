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
    
    let supabase;
    try {
      supabase = createServiceClient();
    } catch (clientError) {
      console.error("Failed to create Supabase client:", clientError);
      return NextResponse.json(
        { 
          error: clientError instanceof Error 
            ? clientError.message 
            : "Failed to initialize database connection. Check your environment variables.",
        },
        { status: 500 },
      );
    }

    let data, error;
    try {
      console.log("[Insert] Attempting to insert campaign...");
      const result = await supabase.from("campaigns").insert({
        company_name: payload.company_name,
        campaign: payload.campaign,
        channel: payload.channel,
        sent_at: payload.sent_at ?? new Date().toISOString(),
        body: payload.body,
        occurrences: 1,
      });
      data = result.data;
      error = result.error;
      
      if (error) {
        console.error("[Insert] Supabase returned error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          status: error.status,
          // Log the full error object to see what's actually there
          fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          errorKeys: Object.keys(error),
        });
      } else {
        console.log("[Insert] Successfully inserted campaign");
      }
    } catch (fetchError) {
      console.error("[Insert] Exception during insert:", {
        error: fetchError,
        message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        stack: fetchError instanceof Error ? fetchError.stack : undefined,
      });
      return NextResponse.json(
        { 
          error: "Network error connecting to database.",
          details: fetchError instanceof Error ? fetchError.message : String(fetchError),
          hint: "Check that NEXT_PUBLIC_SUPABASE_URL is correct and the database is accessible.",
        },
        { status: 500 },
      );
    }

    if (error) {
      // Provide more detailed error information for debugging
      const errorMessage = error.message || "Failed to insert campaign.";
      return NextResponse.json(
        { 
          error: errorMessage,
          details: error.details || null,
          hint: error.hint || null,
          code: error.code || null,
          status: error.status || null,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Insert API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unexpected error inserting a new campaign.";
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 },
    );
  }
}
