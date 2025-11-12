import { UploadModal } from "@/components/UploadModal";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-16">
        <section className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-900/5">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
                Next.js · Tailwind · Supabase · AWS Textract
              </span>
              <h1 className="text-4xl font-semibold text-slate-900">
                Campaign Similarity Search
              </h1>
              <p className="max-w-2xl text-lg text-slate-600">
                Upload marketing assets, extract their copy with AWS Textract,
                and compare the output against the campaigns stored in Supabase.
                Select a suggested match to increase its occurrence count, or
                add brand-new entries when nothing fits.
              </p>
              <p className="text-sm text-slate-500">
                All processing happens on your infrastructure — documents are
                parsed in AWS and results are queried via Supabase&apos;s Postgres
                `pg_trgm` similarity index.
              </p>
            </div>
            <div className="flex items-start justify-end">
              {/* Upload button opens the modal workflow */}
              <UploadModal />
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "1. Upload",
              description:
                "Drop a PDF or image. AWS Textract extracts the text server-side with your AWS credentials.",
            },
            {
              title: "2. Compare",
              description:
                "The extracted copy is sent to Supabase, which runs a pg_trgm similarity search and returns the top five matches.",
            },
            {
              title: "3. Confirm",
              description:
                "Pick an existing campaign to increment its occurrences, or insert a new record if none of the matches apply.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-900/5"
            >
              <h2 className="text-lg font-semibold text-slate-900">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {item.description}
              </p>
            </article>
          ))}
        </section>

        <section className="mb-12 rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-900/5">
          <h2 className="text-2xl font-semibold text-slate-900">
            Developer Notes
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>
              • Configure Supabase credentials in `.env.local` and ensure the
              `campaigns` table plus `search_campaigns` function exist.
            </li>
            <li>
              • Provide AWS credentials with Textract access (`AWS_REGION`,
              `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional session
              token).
            </li>
            <li>
              • API routes live under `/api/upload`, `/api/confirm`, and
              `/api/insert`. They rely on the Supabase service role key and will
              throw descriptive errors if environment variables are missing.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
