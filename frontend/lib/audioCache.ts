/**
 * IndexedDB-based audio cache for persistent storage across page reloads.
 * Stores audio blobs keyed by notebookId.
 */

const DB_NAME = "studymode_audio_cache";
const DB_VERSION = 1;
const STORE_NAME = "audio_blobs";
const MAX_CACHE_SIZE_MB = 200;

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "notebookId" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export interface CachedAudio {
    notebookId: number;
    blob: Blob;
    createdAt: number;
    sizeBytes: number;
}

/** Get a cached audio blob URL, or null if not found. */
export async function getCachedAudioUrl(notebookId: number): Promise<string | null> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(notebookId);
            req.onsuccess = () => {
                const entry = req.result as CachedAudio | undefined;
                if (entry?.blob) {
                    resolve(URL.createObjectURL(entry.blob));
                } else {
                    resolve(null);
                }
            };
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

/** Store an audio blob in IndexedDB. */
export async function cacheAudioBlob(notebookId: number, blob: Blob): Promise<void> {
    try {
        const db = await openDB();
        // Evict if over size limit
        await evictIfNeeded(db, blob.size);
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            store.put({
                notebookId,
                blob,
                createdAt: Date.now(),
                sizeBytes: blob.size,
            } satisfies CachedAudio);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn("Failed to cache audio:", e);
    }
}

/** Remove cached audio for a notebook (used by Regenerate). */
export async function clearCachedAudio(notebookId: number): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).delete(notebookId);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    } catch {
        // ignore
    }
}

/** LRU eviction: remove oldest entries until under MAX_CACHE_SIZE_MB. */
async function evictIfNeeded(db: IDBDatabase, incomingSize: number): Promise<void> {
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
            const entries = (req.result as CachedAudio[]) || [];
            const maxBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;
            let totalSize = entries.reduce((s, e) => s + e.sizeBytes, 0) + incomingSize;
            if (totalSize <= maxBytes) { resolve(); return; }
            // Sort by createdAt ascending (oldest first)
            entries.sort((a, b) => a.createdAt - b.createdAt);
            for (const entry of entries) {
                if (totalSize <= maxBytes) break;
                store.delete(entry.notebookId);
                totalSize -= entry.sizeBytes;
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        };
        req.onerror = () => resolve();
    });
}
