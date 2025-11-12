## Campaign Similarity Search

Upload marketing collateral, extract the copy with AWS Textract, and compare the text against Supabase records using Postgres `pg_trgm` similarity search. Users can confirm one of the returned matches to increment its `occurrences` value or insert a brand-new campaign when nothing matches.

### Tech Stack
- `next@16` (App Router, TypeScript, Tailwind CSS v4)
- Supabase Postgres + `pg_trgm` for similarity search
- AWS Textract (DetectDocumentText) for OCR
- API routes with server-only Supabase service role access
- Zod for request validation

---

## Prerequisites
- Node.js 18.18+ / 20+ (matches the Next.js requirement)
- Supabase project with Postgres extensions enabled
- AWS account with Textract permissions

---

## Environment Variables
Copy `.env.example` to `.env.local` and fill in credentials:

```bash
cp .env.example .env.local
```

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-only) |
| `AWS_REGION` | Region that Textract runs in |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM credentials with Textract access |
| `AWS_SESSION_TOKEN` | Optional session token if you use temporary credentials |

Never expose the service role key to the browser. It is used only inside server routes and actions.

---

## Database Setup (Supabase SQL Editor)
Enable the trigram extension and create the `campaigns` table plus search helper:

```sql
create extension if not exists pg_trgm;

create table if not exists campaigns (
  id bigint generated always as identity primary key,
  company_name text not null,
  campaign text not null,
  channel text not null,
  sent_at timestamptz not null default now(),
  body text not null,
  occurrences integer not null default 0
);

create index if not exists idx_campaigns_body_trgm
  on campaigns using gin (body gin_trgm_ops);

create or replace function search_campaigns(q text, k integer default 5)
returns table (
  id bigint,
  company_name text,
  campaign text,
  channel text,
  sent_at timestamptz,
  body text,
  occurrences integer,
  similarity real
)
language sql stable
as $$
  select
    c.*,
    similarity(c.body, q) as similarity
  from campaigns c
  where q is not null
    and c.body % q
  order by similarity desc
  limit k;
$$;
```

The app also exposes `/api/confirm`, which increments `occurrences` without a stored procedure. You can swap this for a Postgres function if you prefer.

---

## Local Development

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the workflow:
1. Click **Upload Campaign** to open the modal.
2. Select a PDF or image; AWS Textract extracts text server-side.
3. Review up to five similar campaigns returned by Supabase.
4. Confirm a match to increment occurrences, or add a new campaign.

### Testing API Routes
- Upload endpoint: `POST /api/upload` (multipart form, `file` field).
- Confirm endpoint: `POST /api/confirm` (`{ "id": number }` JSON).
- Insert endpoint: `POST /api/insert` (JSON payload matching the Zod schema).

---

## Deployment Notes
- Provide real environment variables in the target platform (Vercel/Render/Fly.io, etc.).
- Ensure AWS credentials are available to the Node.js runtime (for Vercel you may need to use a proxy or AWS role assumption).
- Restrict the Supabase service role key with RLS and service role usage limited to server code.
- Consider storing uploaded files in S3/Supabase Storage before submitting them to Textract for large documents.

---

## Roadmap Ideas
- Persist upload history with user attribution.
- Add Supabase Auth to protect the workflow.
- Stream Textract responses for large PDFs and provide progress feedback.
- Expand filters (company, channel, date range) on the results page.
