"use client";

import { useState } from "react";

/**
 * Uploading a photograph from an editing screen.
 *
 * Shared rather than repeated in each editor: the failure cases - a file that
 * is not an image, one that is too big, a server that is not reachable - are
 * the same everywhere and are worth getting right once.
 */
export function useUpload() {
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(index: number, file: File) {
    setUploading(index);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/staff/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That upload did not work.");
        return null;
      }
      return data as { id: string; url: string };
    } catch {
      setError("Could not reach the server.");
      return null;
    } finally {
      setUploading(null);
    }
  }

  return { upload, uploading, error, setError };
}
