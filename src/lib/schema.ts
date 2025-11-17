import { z } from "zod";

export const confirmSelectionSchema = z.object({
  id: z.number().int().positive(),
});

export const insertCampaignSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  campaign: z.string().min(1, "Campaign is required"),
  channel: z.string().min(1, "Channel is required"),
  sent_at: z
    .string()
    .datetime({ offset: true })
    .optional(),
  body: z.string().min(1, "Body text is required"),
  image_urls: z.array(z.string()).optional(), // Array of base64 data URLs
});

export type ConfirmSelectionInput = z.infer<typeof confirmSelectionSchema>;
export type InsertCampaignInput = z.infer<typeof insertCampaignSchema>;
