export type CampaignRecord = {
  id: number;
  company_name: string;
  campaign: string;
  channel: string;
  sent_at: string;
  body: string;
  occurrences: number;
};

export type CampaignMatch = CampaignRecord & {
  similarity: number;
};

export type UploadResponse = {
  text: string;
  matches: CampaignMatch[];
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
