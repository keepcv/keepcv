export interface PendingFile {
  id: string;
  file: File;
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("keepcv-chat-recovery", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("files");
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function recoverFiles(key: string): Promise<PendingFile[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("files").objectStore("files").get(key);
      request.onsuccess = () => {
        const files: unknown = request.result;
        resolve(
          Array.isArray(files)
            ? (files as unknown[]).filter(
                (entry): entry is PendingFile =>
                  typeof entry === "object" &&
                  entry !== null &&
                  "id" in entry &&
                  typeof entry.id === "string" &&
                  "file" in entry &&
                  entry.file instanceof File,
              )
            : [],
        );
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function retainFiles(key: string, files: PendingFile[]): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put(files, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function generationMediaType(file: File): string {
  if (/\.(?:txt|asc|ascii|md|csv|tsv|json|yaml|yml|log)$/i.test(file.name)) return "text/plain";
  return (
    file.type ||
    (/\.pdf$/i.test(file.name)
      ? "application/pdf"
      : /\.png$/i.test(file.name)
        ? "image/png"
        : /\.jpe?g$/i.test(file.name)
          ? "image/jpeg"
          : /\.webp$/i.test(file.name)
            ? "image/webp"
            : "")
  );
}
export function generationAccept(types: readonly string[]): string {
  return types
    .flatMap((type) =>
      type === "text/plain"
        ? [type, ".txt", ".asc", ".ascii", ".md", ".csv", ".tsv", ".json", ".yaml", ".yml", ".log"]
        : [type],
    )
    .join(",");
}

export function generationFormats(types: readonly string[]): string {
  const labels: Record<string, string> = {
    "text/plain": "UTF-8 text",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/webp": "WebP",
    "application/pdf": "PDF",
  };
  return types.map((type) => labels[type] ?? type).join(", ") || "none";
}
