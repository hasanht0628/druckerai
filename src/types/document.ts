export interface KeyDocument {
  id: string;
  title: string;
  source: "paste" | "upload" | "google_drive";
  mimeType?: string | null;
  driveFileId?: string | null;
  driveFileName?: string | null;
  summary: string;
  rawText?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
