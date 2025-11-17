import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "sent_at";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("campaigns")
      .select("*", { count: "exact" });

    // Apply search filter if provided
    if (search) {
      query = query.or(
        `company_name.ilike.%${search}%,campaign.ilike.%${search}%,channel.ilike.%${search}%,body.ilike.%${search}%`
      );
    }

    // Apply sorting
    const ascending = sortOrder === "asc";
    query = query.order(sortBy, { ascending });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Supabase fetch error:", error);
      return NextResponse.json(
        {
          error: error.message || "Failed to fetch campaigns.",
          details: error.details || null,
          hint: error.hint || null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || [],
      count: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Campaigns API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error fetching campaigns.",
      },
      { status: 500 }
    );
  }
}

