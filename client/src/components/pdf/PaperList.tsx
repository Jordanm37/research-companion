import { useState } from "react";
import { StickyNote, Link, Upload, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaperStatus } from "@shared/types";

export interface PaperItem {
  id: string;
  title?: string;
  filename: string;
  status?: PaperStatus;
  tags?: string[];
  arxivId?: string;
  year?: string;
}

interface PaperListProps {
  papers: PaperItem[];
  onSelectPaper?: (paperId: string) => void;
  onIngestUrl?: (url: string) => Promise<void>;
  isIngesting?: boolean;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  unread: { label: "Unread", className: "bg-gray-500/20 text-gray-600 dark:text-gray-400" },
  reading: { label: "Reading", className: "bg-blue-500/20 text-blue-600 dark:text-blue-400" },
  done: { label: "Done", className: "bg-green-500/20 text-green-600 dark:text-green-400" },
  archived: { label: "Archived", className: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" },
};

/**
 * Empty state component showing available papers when no PDF is loaded.
 * Displays a list of papers with status badges and tags.
 * Supports URL ingestion for adding new papers.
 */
export function PaperList({ papers, onSelectPaper, onIngestUrl, isIngesting }: PaperListProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleIngest = async () => {
    if (!url.trim() || !onIngestUrl) return;

    setError(null);
    try {
      await onIngestUrl(url.trim());
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add paper");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-muted/30">
      <div className="text-center p-8 max-w-md w-full">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <StickyNote className="w-8 h-8 text-muted-foreground" />
        </div>

        {/* Title */}
        <h3
          className="text-lg font-medium mb-2"
          data-testid="text-no-pdf-title"
        >
          Research Library
        </h3>

        {/* URL Ingestion */}
        {onIngestUrl && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-3">
              Add a paper from arXiv or PDF URL
            </p>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://arxiv.org/abs/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleIngest()}
                disabled={isIngesting}
                className="flex-1"
                data-testid="input-paper-url"
              />
              <Button
                onClick={handleIngest}
                disabled={!url.trim() || isIngesting}
                size="sm"
                data-testid="button-ingest-url"
              >
                {isIngesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link className="w-4 h-4" />
                )}
              </Button>
            </div>
            {error && (
              <p className="text-xs text-destructive mt-2">{error}</p>
            )}
          </div>
        )}

        {/* Paper List */}
        {papers.length > 0 ? (
          <div className="text-left">
            <h4 className="text-sm font-medium mb-3 text-center">
              Your Papers ({papers.length})
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {papers.map((paper) => (
                <button
                  key={paper.id}
                  onClick={() => onSelectPaper?.(paper.id)}
                  className="w-full p-3 text-left rounded-md border bg-card hover-elevate transition-colors"
                  data-testid={`button-paper-${paper.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {paper.title || paper.filename}
                      </div>
                      {paper.year && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {paper.year}
                          {paper.arxivId && ` • arXiv:${paper.arxivId}`}
                        </div>
                      )}
                    </div>
                    {paper.status && statusConfig[paper.status] && (
                      <Badge
                        variant="secondary"
                        className={`shrink-0 text-xs ${statusConfig[paper.status].className}`}
                      >
                        {statusConfig[paper.status].label}
                      </Badge>
                    )}
                  </div>
                  {paper.tags && paper.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {paper.tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs px-1.5 py-0"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {paper.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{paper.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p
            className="text-sm text-muted-foreground"
            data-testid="text-no-pdf-description"
          >
            Upload a PDF or add a paper from URL to start reading
          </p>
        )}
      </div>
    </div>
  );
}

export default PaperList;
