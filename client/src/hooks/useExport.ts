import { useState, useCallback } from "react"
import { apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"

export interface UseExportResult {
  isExporting: boolean
  vaultPath: string
  setVaultPath: (path: string) => void
  exportToObsidian: () => Promise<void>
}

export function useExport(paperId: string | null): UseExportResult {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [vaultPath, setVaultPathState] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vaultPath") || "/obsidian-vault"
    }
    return "/obsidian-vault"
  })

  const handleExport = useCallback(async () => {
    if (!paperId) return

    setIsExporting(true)
    try {
      await apiRequest("POST", `/api/papers/${paperId}/export`, {
        vaultPath,
      })
      toast({
        title: "Export successful",
        description: "Markdown file has been written to your vault",
      })
    } catch {
      toast({
        title: "Export failed",
        description: "Could not export to Obsidian vault",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }, [paperId, vaultPath, toast])

  const handleVaultPathChange = useCallback((path: string) => {
    setVaultPathState(path)
    if (typeof window !== "undefined") {
      localStorage.setItem("vaultPath", path)
    }
  }, [])

  return {
    isExporting,
    vaultPath,
    setVaultPath: handleVaultPathChange,
    exportToObsidian: handleExport,
  }
}
