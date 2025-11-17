export type CampaignRecord = {
  id: number;
  company_name: string;
  campaign: string;
  channel: string;
  sent_at: string;
  body: string;
  occurrences: number;
  image_urls?: string[]; // Array of base64 data URLs or file URLs
};

export type CampaignMatch = CampaignRecord & {
  similarity: number;
  image_urls?: string[]; // URLs or base64 data URLs for images
};

export type ImageComparisonResult = {
  matchId: number;
  isSimilar: boolean;
  confidence: number; // 0-1 scale
  reasoning: string;
  details: string;
};

export type UploadResponse = {
  text: string;
  matches: CampaignMatch[];
  imageComparisons?: ImageComparisonResult[]; // Results for top 2 matches
  error?: string; // Error message if upload fails
};

export type InsertCampaignPayload = {
  company_name: string;
  campaign: string;
  channel: string;
  sent_at?: string;
  body: string;
};

export type Database = {
  public: {
    Tables: {
      campaigns: {
        Row: CampaignRecord;
        Insert: Omit<CampaignRecord, "id" | "sent_at"> & {
          id?: number;
          sent_at?: string;
        };
        Update: Partial<CampaignRecord>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_campaigns: {
        Args: {
          q: string;
          k?: number;
        };
        Returns: Array<CampaignMatch>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
