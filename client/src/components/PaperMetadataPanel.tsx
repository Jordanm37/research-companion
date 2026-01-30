import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Settings2,
  X,
  Plus,
  ExternalLink,
  FileText,
  Calendar,
  Tag,
  BookOpen,
} from "lucide-react";
import type { Paper, PaperStatus, UpdatePaper } from "@shared/types";

interface PaperMetadataPanelProps {
  paper: Paper;
  onUpdate: (updates: UpdatePaper) => Promise<void>;
  isUpdating?: boolean;
}

const statusOptions: { value: PaperStatus; label: string; description: string }[] = [
  { value: "unread", label: "Unread", description: "Not started" },
  { value: "reading", label: "Reading", description: "Currently reading" },
  { value: "done", label: "Done", description: "Finished reading" },
  { value: "archived", label: "Archived", description: "For reference" },
];

export function PaperMetadataPanel({
  paper,
  onUpdate,
  isUpdating,
}: PaperMetadataPanelProps) {
  const [newTag, setNewTag] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleStatusChange = async (status: PaperStatus) => {
    await onUpdate({ status });
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    const currentTags = paper.tags || [];
    if (currentTags.includes(newTag.trim())) {
      setNewTag("");
      return;
    }
    await onUpdate({ tags: [...currentTags, newTag.trim()] });
    setNewTag("");
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const currentTags = paper.tags || [];
    await onUpdate({ tags: currentTags.filter((t) => t !== tagToRemove) });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          data-testid="button-paper-metadata"
        >
          <Settings2 className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[340px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Paper Details
          </SheetTitle>
          <SheetDescription>
            Manage paper metadata, status, and tags
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <p className="text-sm text-foreground">{paper.title || paper.filename}</p>
          </div>

          {/* Authors */}
          {paper.authors && paper.authors.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Authors</label>
              <p className="text-sm text-muted-foreground">
                {paper.authors.join(", ")}
              </p>
            </div>
          )}

          {/* Year */}
          {paper.year && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{paper.year}</span>
            </div>
          )}

          {/* External Links */}
          <div className="flex flex-wrap gap-2">
            {paper.arxivId && (
              <a
                href={`https://arxiv.org/abs/${paper.arxivId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                arXiv:{paper.arxivId}
              </a>
            )}
            {paper.doi && (
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                DOI
              </a>
            )}
            {paper.webUrl && !paper.arxivId && (
              <a
                href={paper.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Source
              </a>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Reading Status
            </label>
            <Select
              value={paper.status}
              onValueChange={(v) => handleStatusChange(v as PaperStatus)}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-full" data-testid="select-paper-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {opt.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reading Progress */}
          {paper.lastPageRead && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="w-4 h-4" />
              <span>Last read: Page {paper.lastPageRead}</span>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags
            </label>

            {/* Existing tags */}
            {paper.tags && paper.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {paper.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:bg-destructive/20 rounded p-0.5"
                      disabled={isUpdating}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add tag input */}
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                disabled={isUpdating}
                className="flex-1"
                data-testid="input-new-tag"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleAddTag}
                disabled={!newTag.trim() || isUpdating}
                data-testid="button-add-tag"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Abstract preview */}
          {paper.abstract && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Abstract</label>
              <p className="text-xs text-muted-foreground line-clamp-6">
                {paper.abstract}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
