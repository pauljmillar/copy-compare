-- Migration script to add image_urls column to existing campaigns table
-- Run this if you already have a campaigns table without the image_urls column

-- Add the image_urls column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'campaigns' 
        AND column_name = 'image_urls'
    ) THEN
        ALTER TABLE campaigns 
        ADD COLUMN image_urls text[] DEFAULT '{}';
    END IF;
END $$;

-- Update the search_campaigns function to include image_urls
create or replace function search_campaigns(q text, k integer default 5)
returns table (
  id bigint,
  company_name text,
  campaign text,
  channel text,
  sent_at timestamptz,
  body text,
  occurrences integer,
  image_urls text[],
  similarity real
)
language sql stable
as $$
  select
    c.id,
    c.company_name,
    c.campaign,
    c.channel,
    c.sent_at,
    c.body,
    c.occurrences,
    coalesce(c.image_urls, '{}'::text[]) as image_urls,
    similarity(c.body, q) as similarity
  from campaigns c
  where q is not null
    and c.body % q
  order by similarity desc
  limit k;
$$;

