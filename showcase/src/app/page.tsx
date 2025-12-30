"use client";

import type { FileMetadata } from "@heilgar/file-storage-adapter-core";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

type AdapterName = "fs" | "vercel-blob";

const ADAPTERS: Array<{ value: AdapterName; label: string; description: string }> = [
  {
    value: "fs",
    label: "Filesystem",
    description: "Local disk storage (FS_ROOT_DIR).",
  },
  {
    value: "vercel-blob",
    label: "Vercel Blob",
    description: "Remote object storage (VERCEL_BLOB_TOKEN).",
  },
];

const formatBytes = (bytes: number | undefined) => {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes as number) / Math.log(1024)),
    units.length - 1,
  );
  const value = (bytes as number) / Math.pow(1024, index);
  return `${value.toFixed(value < 10 && index > 0 ? 1 : 0)} ${units[index]}`;
};

const formatDate = (value: Date | string | undefined) => {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const fetchJson = async (input: RequestInfo, init?: RequestInit) => {
  const response = await fetch(input, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || response.statusText);
  }
  return data;
};

export default function Home() {
  const [adapter, setAdapter] = useState<AdapterName>("fs");
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [status, setStatus] = useState<string>("Ready.");
  const [busy, setBusy] = useState(false);
  const [uploadKey, setUploadKey] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [prefix, setPrefix] = useState("");
  const [copySource, setCopySource] = useState("");
  const [copyDest, setCopyDest] = useState("");
  const [moveSource, setMoveSource] = useState("");
  const [moveDest, setMoveDest] = useState("");
  const [signedKey, setSignedKey] = useState("");
  const [signedUrl, setSignedUrl] = useState("");

  const refreshList = async () => {
    try {
      setBusy(true);
      setStatus("Refreshing list...");
      const url = new URL("/api/list", window.location.origin);
      url.searchParams.set("adapter", adapter);
      if (prefix.trim()) {
        url.searchParams.set("prefix", prefix.trim());
      }
      const result = await fetchJson(url.toString());
      setFiles(result.files || []);
      setStatus(`Loaded ${result.files?.length ?? 0} file(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to list files";
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refreshList();
  }, [adapter]);

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!uploadFile) {
      setStatus("Select a file to upload.");
      return;
    }

    try {
      setBusy(true);
      setStatus("Uploading file...");
      const form = new FormData();
      form.set("file", uploadFile);
      form.set("adapter", adapter);
      if (uploadKey.trim()) {
        form.set("key", uploadKey.trim());
      }
      await fetchJson(`/api/upload?adapter=${adapter}`, {
        method: "POST",
        body: form,
      });
      setStatus("Upload complete.");
      setUploadKey("");
      setUploadFile(null);
      await refreshList();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (key: string) => {
    try {
      setBusy(true);
      setStatus(`Downloading ${key}...`);
      const url = new URL("/api/download", window.location.origin);
      url.searchParams.set("adapter", adapter);
      url.searchParams.set("key", key);
      const response = await fetch(url.toString());
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Download failed");
      }
      const blob = await response.blob();
      const filenameHeader = response.headers.get("X-File-Name");
      const filename = filenameHeader ? decodeURIComponent(filenameHeader) : key.split("/").pop() || key;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
      setStatus(`Downloaded ${filename}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Download failed";
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      setBusy(true);
      setStatus(`Deleting ${key}...`);
      const url = new URL("/api/delete", window.location.origin);
      url.searchParams.set("adapter", adapter);
      url.searchParams.set("key", key);
      await fetchJson(url.toString(), { method: "DELETE" });
      setStatus(`Deleted ${key}.`);
      await refreshList();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed";
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setBusy(true);
      setStatus("Copying file...");
      await fetchJson("/api/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adapter,
          sourceKey: copySource.trim(),
          destinationKey: copyDest.trim(),
        }),
      });
      setStatus("Copy complete.");
      setCopySource("");
      setCopyDest("");
      await refreshList();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Copy failed";
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setBusy(true);
      setStatus("Moving file...");
      await fetchJson("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adapter,
          sourceKey: moveSource.trim(),
          destinationKey: moveDest.trim(),
        }),
      });
      setStatus("Move complete.");
      setMoveSource("");
      setMoveDest("");
      await refreshList();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Move failed";
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const handleSignedUrl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setBusy(true);
      setStatus("Fetching signed URL...");
      const url = new URL("/api/signed-url", window.location.origin);
      url.searchParams.set("adapter", adapter);
      url.searchParams.set("key", signedKey.trim());
      const result = await fetchJson(url.toString());
      setSignedUrl(result.url);
      setStatus("Signed URL ready.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Signed URL failed";
      setStatus(message);
      setSignedUrl("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>Storage Adapter Showcase</p>
            <h1>Exercise every adapter with real uploads and downloads.</h1>
            <p className={styles.subhead}>
              Point the demo at your local FS root or Vercel Blob token to validate
              behavior, headers, and metadata end-to-end.
            </p>
          </div>
          <div className={styles.statusPanel}>
            <span className={styles.statusLabel}>Status</span>
            <p className={styles.statusText}>{busy ? "Working..." : status}</p>
            <button className={styles.secondaryButton} onClick={refreshList} disabled={busy}>
              Refresh list
            </button>
          </div>
        </header>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Adapter Control</h2>
            <p>Switch between adapters without reloading the page.</p>
          </div>
          <div className={styles.controls}>
            {ADAPTERS.map((entry) => (
              <button
                key={entry.value}
                className={adapter === entry.value ? styles.activeToggle : styles.toggle}
                onClick={() => setAdapter(entry.value)}
                type="button"
              >
                <span>{entry.label}</span>
                <small>{entry.description}</small>
              </button>
            ))}
            <div className={styles.envHint}>
              <h3>Env hints</h3>
              <p>
                FS_ROOT_DIR (default: <code>./storage</code>)
              </p>
              <p>
                FS_BASE_URL, STORAGE_BASE_PATH, VERCEL_BLOB_TOKEN
              </p>
            </div>
          </div>
        </section>

        <section className={styles.row}>
          <form className={`${styles.card} ${styles.uploadCard}`} onSubmit={handleUpload}>
            <div className={styles.cardHeader}>
              <h2>Upload</h2>
              <p>Send a file into the selected adapter.</p>
            </div>
            <div className={styles.uploadRow}>
              <label className={styles.field}>
                <span>File</span>
                <input
                  type="file"
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <label className={styles.field}>
                <span>Key override</span>
                <input
                  type="text"
                  placeholder="folder/file.txt"
                  value={uploadKey}
                  onChange={(event) => setUploadKey(event.target.value)}
                />
              </label>
              <button className={styles.primaryButton} type="submit" disabled={busy}>
                Upload file
              </button>
            </div>
          </form>

          <div className={`${styles.card} ${styles.filesCard}`}>
            <div className={styles.cardHeader}>
              <h2>Files</h2>
              <p>Inspect metadata and trigger downloads. Paths show when available.</p>
            </div>
            <div className={styles.filterRow}>
              <label className={styles.field}>
                <span>Prefix filter</span>
                <input
                  type="text"
                  placeholder="optional folder/"
                  value={prefix}
                  onChange={(event) => setPrefix(event.target.value)}
                />
              </label>
              <button className={styles.secondaryButton} onClick={refreshList} disabled={busy}>
                Apply filter
              </button>
            </div>
            <div className={styles.fileList}>
              {files.length === 0 ? (
                <p className={styles.emptyState}>No files yet.</p>
              ) : (
                files.map((file, index) => {
                  const key =
                    typeof file.metadata?.key === "string" ? file.metadata.key : file.name;
                  return (
                    <div
                      key={`${key}-${file.uploadedAt}-${file.size}-${index}`}
                      className={styles.fileRow}
                    >
                      <div>
                        <p className={styles.fileName}>{key}</p>
                        <p className={styles.fileMeta}>
                          {file.mimeType || "unknown"} · {formatBytes(file.size)} ·{" "}
                          {formatDate(file.uploadedAt)}
                        </p>
                      </div>
                      <div className={styles.fileActions}>
                        <button
                          className={styles.secondaryButton}
                          onClick={() => handleDownload(key)}
                          disabled={busy}
                          type="button"
                        >
                          Download
                        </button>
                        <button
                          className={styles.ghostButton}
                          onClick={() => handleDelete(key)}
                          disabled={busy}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className={styles.grid}>
          <form className={styles.card} onSubmit={handleCopy}>
            <div className={styles.cardHeader}>
              <h2>Copy</h2>
              <p>Duplicate a file within the adapter.</p>
            </div>
            <label className={styles.field}>
              <span>Source key</span>
              <input
                type="text"
                placeholder="source/file.txt"
                value={copySource}
                onChange={(event) => setCopySource(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Destination key</span>
              <input
                type="text"
                placeholder="copy/file.txt"
                value={copyDest}
                onChange={(event) => setCopyDest(event.target.value)}
              />
            </label>
            <button className={styles.primaryButton} type="submit" disabled={busy}>
              Copy file
            </button>
          </form>

          <form className={styles.card} onSubmit={handleMove}>
            <div className={styles.cardHeader}>
              <h2>Move</h2>
              <p>Relocate a file within the adapter.</p>
            </div>
            <label className={styles.field}>
              <span>Source key</span>
              <input
                type="text"
                placeholder="source/file.txt"
                value={moveSource}
                onChange={(event) => setMoveSource(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Destination key</span>
              <input
                type="text"
                placeholder="moved/file.txt"
                value={moveDest}
                onChange={(event) => setMoveDest(event.target.value)}
              />
            </label>
            <button className={styles.primaryButton} type="submit" disabled={busy}>
              Move file
            </button>
          </form>

          <form className={styles.card} onSubmit={handleSignedUrl}>
            <div className={styles.cardHeader}>
              <h2>Signed URL</h2>
              <p>Generate a read URL for the selected adapter.</p>
            </div>
            <label className={styles.field}>
              <span>Key</span>
              <input
                type="text"
                placeholder="file.txt"
                value={signedKey}
                onChange={(event) => setSignedKey(event.target.value)}
              />
            </label>
            <button className={styles.secondaryButton} type="submit" disabled={busy}>
              Get signed URL
            </button>
            {signedUrl ? (
              <div className={styles.signedUrl}>
                <p>Signed URL</p>
                <a href={signedUrl} target="_blank" rel="noreferrer">
                  {signedUrl}
                </a>
              </div>
            ) : null}
          </form>
        </section>
      </main>
    </div>
  );
}
