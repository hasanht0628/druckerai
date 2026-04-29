"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { DriveFilePicker } from "@/components/documents/DriveFilePicker";
import type { KeyDocument } from "@/types/document";

export default function DocumentsPage() {
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery<KeyDocument[]>({
    queryKey: ["documents"],
    queryFn: () => fetch("/api/documents").then((r) => r.json()),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  }

  const activeDocs = documents.filter((d) => d.isActive);
  const atCap = activeDocs.length >= 5;

  return (
    <>
      <Header
        title="Documents"
        eyebrow="Inputs · Strategic references"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="view space-y-6">
          {atCap && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              5 active documents reached — the maximum for AI context. Deactivate one before adding more.
            </div>
          )}

          <Tabs defaultValue="paste">
            <TabsList>
              <TabsTrigger value="paste">Paste / Type</TabsTrigger>
              <TabsTrigger value="upload">Upload File</TabsTrigger>
              <TabsTrigger value="drive">Google Drive</TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="mt-4">
              <PasteForm onSaved={invalidate} disabled={atCap} />
            </TabsContent>

            <TabsContent value="upload" className="mt-4">
              <UploadForm onSaved={invalidate} disabled={atCap} />
            </TabsContent>

            <TabsContent value="drive" className="mt-4">
              <DriveFilePicker onImported={invalidate} />
            </TabsContent>
          </Tabs>

          <div>
            <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Your Documents ({documents.length})
            </h3>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">No documents yet. Add one above.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onDelete={invalidate}
                    onToggleActive={invalidate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function PasteForm({ onSaved, disabled }: { onSaved: () => void; disabled: boolean }) {
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim() || !rawText.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setTitle("");
      setRawText("");
      onSaved();
      toast.success("Document saved and summarised");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Document title (e.g. Q2 OKRs, Product Roadmap)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-sm"
        disabled={disabled}
      />
      <Textarea
        placeholder="Paste document content here…"
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        rows={10}
        className="text-sm resize-none font-mono"
        disabled={disabled}
      />
      <Button
        className="w-full"
        onClick={handleSave}
        disabled={saving || disabled || !title.trim() || !rawText.trim()}
      >
        {saving ? "Saving & summarising…" : "Save & Summarise"}
      </Button>
    </div>
  );
}

function UploadForm({ onSaved, disabled }: { onSaved: () => void; disabled: boolean }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) { toast.error("Select a file first"); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error("File must be under 4 MB"); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) formData.append("title", title.trim());

      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
      onSaved();
      toast.success("Document uploaded and summarised");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Title override (optional — defaults to filename)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-sm"
        disabled={disabled}
      />
      <div
        className="rounded-lg border-2 border-dashed border-border p-6 text-center cursor-pointer hover:border-zinc-400 transition-colors"
        onClick={() => !disabled && inputRef.current?.click()}
      >
        {file ? (
          <p className="text-sm font-medium">{file.name} <span className="text-muted-foreground text-xs">({(file.size / 1024).toFixed(0)} KB)</span></p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Click to select a file</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), .txt, .md — max 4 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.xlsx,.xls,.pptx,.txt,.md"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={disabled}
        />
      </div>
      <Button
        className="w-full"
        onClick={handleUpload}
        disabled={uploading || disabled || !file}
      >
        {uploading ? "Extracting & summarising…" : "Upload & Summarise"}
      </Button>
    </div>
  );
}
