"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  Typography,
  Input,
} from "@material-tailwind/react";
import type { CampaignRecord } from "@/lib/types";

type SortField = "company_name" | "campaign" | "channel" | "sent_at" | "occurrences";
type SortOrder = "asc" | "desc";

interface CampaignsTableProps {
  refreshTrigger?: number;
}

export function CampaignsTable({ refreshTrigger = 0 }: CampaignsTableProps) {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("occurrences");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [totalCount, setTotalCount] = useState(0);

  const TABLE_HEAD = [
    { label: "Company", field: "company_name" as SortField },
    { label: "Channel", field: "channel" as SortField },
    { label: "Occurrences", field: "occurrences" as SortField },
    { label: "Body Preview" },
  ];

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        search,
        sortBy,
        sortOrder,
        limit: "100",
        offset: "0",
      });

      const response = await fetch(`/api/campaigns?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch campaigns");
      }

      setCampaigns(result.data || []);
      setTotalCount(result.count || 0);
    } catch (err) {
      console.error("Error fetching campaigns:", err);
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, [search, sortBy, sortOrder]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns, refreshTrigger]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null;
    return (
      <span className="ml-1 text-xs">
        {sortOrder === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  if (loading && campaigns.length === 0) {
    return (
      <Card className="h-full w-full overflow-scroll">
        <div className="p-8 text-center text-slate-600">
          Loading campaigns...
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full w-full overflow-scroll">
      <div className="mb-4 flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:w-72">
          <Input
            label="Search campaigns"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            crossOrigin={undefined}
            className="rounded-lg"
          />
        </div>
        <Typography variant="small" color="gray" className="font-normal">
          {totalCount} {totalCount === 1 ? "campaign" : "campaigns"}
        </Typography>
      </div>

      {error && (
        <div className="mx-4 mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <table className="w-full min-w-max table-auto text-left">
        <thead>
          <tr>
            {TABLE_HEAD.map((head) => (
              <th
                key={head.label}
                className="border-b border-blue-gray-100 bg-blue-gray-50 p-4"
              >
                {head.field ? (
                  <button
                    onClick={() => handleSort(head.field!)}
                    className="flex items-center gap-1 font-normal leading-none opacity-70 hover:opacity-100 transition"
                  >
                    <Typography
                      variant="small"
                      color="blue-gray"
                      className="font-normal"
                    >
                      {head.label}
                    </Typography>
                    <SortIcon field={head.field!} />
                  </button>
                ) : (
                  <Typography
                    variant="small"
                    color="blue-gray"
                    className="font-normal leading-none opacity-70"
                  >
                    {head.label}
                  </Typography>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campaigns.length === 0 ? (
            <tr>
              <td colSpan={TABLE_HEAD.length} className="p-8 text-center text-slate-600">
                {search ? "No campaigns found matching your search." : "No campaigns yet. Upload your first campaign to get started."}
              </td>
            </tr>
          ) : (
            campaigns.map((campaign, index) => {
              const isLast = index === campaigns.length - 1;
              const classes = isLast
                ? "p-4"
                : "p-4 border-b border-blue-gray-50";

              return (
                <tr key={campaign.id} className="even:bg-blue-gray-50/50">
                  <td className={classes}>
                    <Typography
                      variant="small"
                      color="blue-gray"
                      className="font-normal"
                    >
                      {campaign.company_name}
                    </Typography>
                  </td>
                  <td className={classes}>
                    <Typography
                      variant="small"
                      color="blue-gray"
                      className="font-normal"
                    >
                      {campaign.channel}
                    </Typography>
                  </td>
                  <td className={classes}>
                    <Typography
                      variant="small"
                      color="blue-gray"
                      className="font-normal"
                    >
                      {campaign.occurrences}
                    </Typography>
                  </td>
                  <td className={classes}>
                    <Typography
                      variant="small"
                      color="blue-gray"
                      className="font-normal text-xs"
                    >
                      {truncateText(campaign.body, 200)}
                    </Typography>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </Card>
  );
}

