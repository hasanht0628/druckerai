"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

interface Props {
  onImported: () => void;
}

export function DriveFilePicker({ onImported }: Props) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/documents/drive")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setFiles(data);
      })
      .catch(() => setError("Failed to load Google Drive files"))
      .finally(() => setLoading(false));
  }, []);

  async function handleImport(file: DriveFile) {
    setImporting(file.id);
    try {
      const res = await fetch("/api/documents/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id, fileName: file.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      onImported();
      toast.success(`"${file.name}" imported and summarised`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        {error.includes("scope") && (
          <p className="text-xs text-muted-foreground mt-2">
            Run <code className="bg-zinc-100 px-1 rounded">node scripts/setup-google-auth.js</code> to add Drive access.
          </p>
        )}
      </div>
    );
  }

  if (!files.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No Google Docs found in your Drive.
      </p>
    );
  }

  return (
    <div className="divide-y rounded-lg border overflow-hidden">
      {files.map((file) => (
        <div key={file.id} className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              Modified {new Date(file.modifiedTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs shrink-0"
            disabled={importing === file.id}
            onClick={() => handleImport(file)}
          >
            <Download className="h-3 w-3 mr-1" />
            {importing === file.id ? "Importing…" : "Import"}
          </Button>
        </div>
      ))}
    </div>
  );
}
