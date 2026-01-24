import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "./ThemeProvider";
import { 
  Upload, 
  Download, 
  Sun, 
  Moon, 
  FolderOpen,
  FileText,
  Settings,
  Loader2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface HeaderProps {
  paperTitle: string | null;
  onUpload: (file: File) => void;
  onExport: () => void;
  isExporting: boolean;
  vaultPath: string;
  onVaultPathChange: (path: string) => void;
}

export function Header({
  paperTitle,
  onUpload,
  onExport,
  isExporting,
  vaultPath,
  onVaultPathChange,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempVaultPath, setTempVaultPath] = useState(vaultPath);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      onUpload(file);
    }
    e.target.value = "";
  };

  const handleSaveSettings = () => {
    onVaultPathChange(tempVaultPath);
    setSettingsOpen(false);
  };

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 gap-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg hidden sm:inline" data-testid="text-app-title">Research Reader</span>
        </div>
        
        {paperTitle && (
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-border">/</span>
            <span className="truncate max-w-[200px]" data-testid="text-paper-title">{paperTitle}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
            data-testid="input-upload-pdf"
          />
          <Button variant="outline" size="sm" data-testid="button-upload">
            <Upload className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Upload PDF</span>
            <span className="sm:hidden">Upload</span>
          </Button>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={onExport}
          disabled={!paperTitle || isExporting}
          data-testid="button-export"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          <span className="hidden sm:inline">Export</span>
        </Button>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="ghost" data-testid="button-settings">
              <Settings className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>
                Configure your Obsidian vault path for exports
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="vault-path" className="text-sm font-medium">
                Obsidian Vault Path
              </Label>
              <div className="flex items-center gap-2 mt-2">
                <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input
                  id="vault-path"
                  value={tempVaultPath}
                  onChange={(e) => setTempVaultPath(e.target.value)}
                  placeholder="/path/to/your/vault"
                  data-testid="input-vault-path"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Markdown files will be written directly to this directory
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSettings} data-testid="button-save-settings">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button 
          size="icon" 
          variant="ghost" 
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
        >
          {theme === "light" ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
        </Button>
      </div>
    </header>
  );
}
