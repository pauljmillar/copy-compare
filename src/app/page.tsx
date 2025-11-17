"use client";

import { useState } from "react";
import { UploadModal } from "@/components/UploadModal";
import { CampaignsTable } from "@/components/CampaignsTable";

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };
  return (
    <main className="flex min-h-screen flex-col bg-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-16">
        <section className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-900/5">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold text-slate-900">
                Campaign Similarity Search
              </h1>
              <p className="max-w-2xl text-lg text-slate-600">
                Upload marketing assets, and choose from similar assets in the db if it is a copy. If it is a new asset, choose to add it to the DB.
              </p>
            </div>
            <div className="flex items-start justify-end">
              {/* Upload button opens the modal workflow */}
              <UploadModal onSuccess={handleRefresh} />
            </div>
          </div>
        </section>

        <section className="mb-12 rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-900/5">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Campaigns
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                View, search, and sort all campaigns in the database
              </p>
            </div>
          </div>
          <CampaignsTable refreshTrigger={refreshTrigger} />
        </section>
      </div>
    </main>
  );
}
