export type FsMode = 'FSA_API';

export class FileSystemAdapter {
  private rootDirectoryHandle: FileSystemDirectoryHandle | null = null;

  constructor(handle: FileSystemDirectoryHandle | null = null) {
    this.rootDirectoryHandle = handle;
  }

  getHandle(): FileSystemDirectoryHandle | null {
    return this.rootDirectoryHandle;
  }

  private async getDirectoryHandleForPath(path: string, create = false): Promise<FileSystemDirectoryHandle | null> {
    if (!this.rootDirectoryHandle) return null;
    const parts = this.normalizePath(path).split('/').filter(Boolean);
    if (parts.length <= 1) return this.rootDirectoryHandle;
    let current = this.rootDirectoryHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i], { create });
    }
    return current;
  }

  async readTextFile(path: string): Promise<string> {
    const dirHandle = await this.getDirectoryHandleForPath(path, false);
    if (!dirHandle) throw new Error(`Path not found: ${path}`);
    const filename = path.split('/').filter(Boolean).pop()!;
    const fileHandle = await dirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return file.text();
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    const dirHandle = await this.getDirectoryHandleForPath(path, true);
    if (!dirHandle) throw new Error(`Cannot create path: ${path}`);
    const filename = path.split('/').filter(Boolean).pop()!;
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async deleteFile(path: string): Promise<void> {
    const dirHandle = await this.getDirectoryHandleForPath(path, false);
    if (!dirHandle) return;
    const filename = path.split('/').filter(Boolean).pop()!;
    try { await dirHandle.removeEntry(filename); } catch { /* ignore */ }
  }

  async listFiles(subFolder: string): Promise<string[]> {
    if (!this.rootDirectoryHandle) return [];
    const parts = subFolder.split('/').filter(Boolean);
    let dir = this.rootDirectoryHandle;
    for (const p of parts) {
      try {
        dir = await dir.getDirectoryHandle(p);
      } catch {
        return [];
      }
    }
    const files: string[] = [];
    for await (const entry of (dir as any).values()) {
      if (entry.kind === 'file') files.push(entry.name);
    }
    return files;
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      const dirHandle = await this.getDirectoryHandleForPath(path, false);
      if (!dirHandle) return false;
      const filename = path.split('/').filter(Boolean).pop()!;
      await dirHandle.getFileHandle(filename);
      return true;
    } catch { return false; }
  }

  async ensureDirectory(path: string): Promise<void> {
    if (!this.rootDirectoryHandle) return;
    const parts = path.split('/').filter(Boolean);
    let current = this.rootDirectoryHandle;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
  }

  private normalizePath(path: string): string {
    let cleaned = path.replace(/\\/g, '/');
    if (!cleaned.startsWith('/')) cleaned = '/' + cleaned;
    return cleaned;
  }
}

// IndexedDB persistence for the directory handle
const DB_NAME = 'KoraPOS_FSHandles';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'lastDirectoryHandle';

function initHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await initHandleDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await initHandleDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

export async function clearDirectoryHandle(): Promise<void> {
  const db = await initHandleDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
}
