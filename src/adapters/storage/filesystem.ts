import type { StorageAdapter, StorageObject, PutOptions, ListOptions, StorageListResult } from './interface';
import { promises as fs } from 'fs';
import path from 'path';

// Filesystem Storage Adapter for Docker/Node.js
export class FilesystemStorageAdapter implements StorageAdapter {
  constructor(private basePath: string) {}

  async get(key: string): Promise<StorageObject | null> {
    try {
      const filePath = path.join(this.basePath, key);
      const buffer = await fs.readFile(filePath);
      
      // Try to read metadata if exists
      let metadata: Record<string, string> | undefined;
      try {
        const metadataPath = `${filePath}.meta`;
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataContent);
      } catch {
        // No metadata file
      }

      return {
        body: buffer,
        metadata,
        contentType: this.getContentType(key),
        size: buffer.length,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async put(key: string, value: ArrayBuffer | string | Uint8Array, options?: PutOptions): Promise<void> {
    const filePath = path.join(this.basePath, key);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Convert value to Buffer
    let buffer: Buffer;
    if (typeof value === 'string') {
      buffer = Buffer.from(value);
    } else if (value instanceof ArrayBuffer) {
      buffer = Buffer.from(value);
    } else {
      buffer = Buffer.from(value);
    }

    // Write file
    await fs.writeFile(filePath, buffer);

    // Write metadata if provided
    if (options?.metadata) {
      const metadataPath = `${filePath}.meta`;
      await fs.writeFile(metadataPath, JSON.stringify(options.metadata));
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.unlink(filePath);
      // Try to delete metadata file if exists
      try {
        await fs.unlink(`${filePath}.meta`);
      } catch {
        // Metadata file doesn't exist
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  async list(prefix: string, options?: ListOptions): Promise<StorageListResult> {
    const fullPrefix = path.join(this.basePath, prefix);
    const keys: string[] = [];

    try {
      const files = await this.readDirRecursive(fullPrefix);
      const limit = options?.limit || 1000;
      
      for (const file of files) {
        if (!file.endsWith('.meta')) {
          const relativePath = path.relative(this.basePath, file);
          keys.push(relativePath);
          if (keys.length >= limit) break;
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }

    return {
      keys,
      truncated: false,
    };
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.basePath, key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async readDirRecursive(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await this.readDirRecursive(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return files;
  }

  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'font/otf',
      '.txt': 'text/plain',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}