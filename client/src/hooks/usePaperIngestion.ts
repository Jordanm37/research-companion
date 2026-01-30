import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface IngestResult {
  success: boolean;
  paper?: {
    id: string;
    title?: string;
    filename: string;
  };
  error?: string;
  alreadyExists?: boolean;
}

async function ingestPaper(url: string): Promise<IngestResult> {
  const response = await fetch("/api/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to ingest paper");
  }

  return data;
}

export function usePaperIngestion() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ingestPaper,
    onSuccess: (data) => {
      // Invalidate papers query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["papers"] });
    },
  });

  return {
    ingestPaper: mutation.mutateAsync,
    isIngesting: mutation.isPending,
    error: mutation.error?.message || null,
    lastResult: mutation.data,
  };
}
