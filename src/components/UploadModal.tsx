"use client";

import {
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type FormEventHandler,
} from "react";
import type { CampaignMatch } from "@/lib/types";

type Step = "upload" | "review" | "new-record" | "success";

type MetadataFormState = {
  company_name: string;
  campaign: string;
  channel: string;
  sent_at: string;
};

const initialFormState: MetadataFormState = {
  company_name: "",
  campaign: "",
  channel: "",
  sent_at: "",
};

export function UploadModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [ocrText, setOcrText] = useState("");
  const [matches, setMatches] = useState<CampaignMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<MetadataFormState>(
    initialFormState,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasMatches = matches.length > 0;

  const similarityCaption = useMemo(() => {
    if (!hasMatches) return null;
    const top = matches[0];
    return `Top match similarity: ${Math.round(top.similarity * 100)}%`;
  }, [matches, hasMatches]);

  const resetState = () => {
    setStep("upload");
    setOcrText("");
    setMatches([]);
    setError(null);
    setSuccessMessage(null);
    setIsLoading(false);
    setIsSubmitting(false);
    setFormValues(initialFormState);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpen = () => {
    setOpen(true);
    resetState();
  };

  const handleClose = () => {
    setOpen(false);
    resetState();
  };

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to process upload.");
      }

      setOcrText(payload.text);
      setMatches(payload.matches ?? []);
      setStep("review");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unexpected error uploading file.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectMatch = async (match: CampaignMatch) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: match.id }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update occurrences.");
      }

      setSuccessMessage(
        `Occurrences updated to ${payload.occurrences ?? "the new value"} for ${match.campaign}.`,
      );
      setStep("success");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error confirming match.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNoneSelected = () => {
    setStep("new-record");
    setFormValues((prev) => ({
      ...prev,
      campaign: prev.campaign || "New Campaign",
    }));
  };

  const handleFormChange: ChangeEventHandler<
    HTMLInputElement | HTMLSelectElement
  > = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateRecord: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const sentAtIso = formValues.sent_at
        ? new Date(formValues.sent_at).toISOString()
        : undefined;

      const response = await fetch("/api/insert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formValues,
          sent_at: sentAtIso,
          body: ocrText,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const message =
          typeof payload.error === "string"
            ? payload.error
            : "Failed to insert new campaign.";
        throw new Error(message);
      }

      setSuccessMessage("New campaign inserted successfully.");
      setStep("success");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error creating a new campaign.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Upload Campaign
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-8 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-4 top-4 text-slate-500 transition hover:text-slate-700"
              aria-label="Close upload modal"
            >
              ×
            </button>

            <header className="mb-6 space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">
                Campaign Similarity Search
              </h2>
              <p className="text-sm text-slate-600">
                Upload a document to extract its text with AWS Textract and find
                similar campaigns stored in Supabase.
              </p>
            </header>

            <div className="space-y-5">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {step === "upload" && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                  <p className="text-sm text-slate-600">
                    Drag and drop a PDF or image, or click to select a file.
                  </p>
                  <label className="mt-4 inline-flex cursor-pointer items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {isLoading ? "Processing..." : "Choose file"}
                  </label>
                  <p className="mt-3 text-xs text-slate-500">
                    The file never leaves your Supabase project. AWS Textract is
                    invoked server-side to extract text for similarity search.
                  </p>
                </div>
              )}

              {step === "review" && (
                <section className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-slate-700">
                      Extracted text
                    </h3>
                    <textarea
                      value={ocrText}
                      readOnly
                      rows={8}
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-700">
                        Top matches
                      </h3>
                      {similarityCaption && (
                        <span className="text-xs uppercase tracking-wide text-slate-500">
                          {similarityCaption}
                        </span>
                      )}
                    </div>

                    {hasMatches ? (
                      <ul className="space-y-3">
                        {matches.map((match) => (
                          <li
                            key={match.id}
                            className="rounded-lg border border-slate-200 p-4 shadow-sm"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {match.company_name}
                                </p>
                                <p className="text-sm text-slate-600">
                                  {match.campaign} · {match.channel}
                                </p>
                              </div>
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                                {Math.round(match.similarity * 100)}% match
                              </span>
                            </div>
                            <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                              {match.body}
                            </p>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                              <p className="text-xs text-slate-500">
                                Occurrences: {match.occurrences}
                              </p>
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleSelectMatch(match)}
                                className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {isSubmitting ? "Saving..." : "Use this match"}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        No similar campaigns were found. You can add this as a
                        new campaign instead.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleNoneSelected}
                      className="text-sm font-medium text-blue-600 hover:text-blue-500"
                    >
                      None of these match
                    </button>
                    <button
                      type="button"
                      onClick={resetState}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      Upload another file
                    </button>
                  </div>
                </section>
              )}

              {step === "new-record" && (
                <form
                  onSubmit={handleCreateRecord}
                  className="space-y-4 rounded-lg border border-slate-200 p-4"
                >
                  <div>
                    <label
                      htmlFor="company_name"
                      className="text-sm font-medium text-slate-700"
                    >
                      Company name
                    </label>
                    <input
                      id="company_name"
                      name="company_name"
                      required
                      value={formValues.company_name}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="campaign"
                      className="text-sm font-medium text-slate-700"
                    >
                      Campaign name
                    </label>
                    <input
                      id="campaign"
                      name="campaign"
                      required
                      value={formValues.campaign}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="channel"
                      className="text-sm font-medium text-slate-700"
                    >
                      Channel
                    </label>
                    <input
                      id="channel"
                      name="channel"
                      required
                      value={formValues.channel}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sent_at"
                      className="text-sm font-medium text-slate-700"
                    >
                      Sent at (optional)
                    </label>
                    <input
                      id="sent_at"
                      name="sent_at"
                      type="datetime-local"
                      value={formValues.sent_at}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Extracted text
                    </label>
                    <textarea
                      value={ocrText}
                      readOnly
                      rows={6}
                      className="mt-1 w-full resize-none rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep("review")}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      Back to matches
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubmitting ? "Saving..." : "Create campaign"}
                    </button>
                  </div>
                </form>
              )}

              {step === "success" && (
                <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  <p>{successMessage ?? "Action completed successfully."}</p>
                  <button
                    type="button"
                    onClick={resetState}
                    className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                  >
                    Start another upload
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
