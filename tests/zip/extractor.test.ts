import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractFile, extractFiles } from '@/services/zip/extractor';
import type { ZipFileEntry } from '@/types/zip';
import pako from 'pako';

describe('ZIP Extractor Service', () => {
  let mockBucket: any;

  beforeEach(() => {
    mockBucket = {
      get: vi.fn()
    };
  });

  describe('extractFile', () => {
    it('should extract a stored (uncompressed) file', async () => {
      const fileData = new Uint8Array([1, 2, 3, 4, 5]);
      mockBucket.get.mockResolvedValue({
        body: {},
        arrayBuffer: vi.fn().mockResolvedValue(fileData.buffer)
      });

      const entry: ZipFileEntry = {
        name: 'test.txt',
        size: 5,
        compressedSize: 5,
        offset: 0,
        crc32: 12345,
        compressionMethod: 0 // Stored
      };

      const result = await extractFile(mockBucket, 'test.zip', entry);

      expect(result).toEqual(fileData.buffer);
      expect(mockBucket.get).toHaveBeenCalledWith('test.zip', {
        range: { offset: 0, length: 5 }
      });
    });

    it('should extract and decompress a deflate-compressed file', async () => {
      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const compressedData = pako.deflateRaw(originalData);

      mockBucket.get.mockResolvedValue({
        body: {},
        arrayBuffer: vi.fn().mockResolvedValue(compressedData.buffer)
      });

      const entry: ZipFileEntry = {
        name: 'test.txt',
        size: 5,
        compressedSize: compressedData.length,
        offset: 0,
        crc32: 12345,
        compressionMethod: 8 // Deflate
      };

      const result = await extractFile(mockBucket, 'test.zip', entry);
      const decompressed = new Uint8Array(result);

      expect(decompressed).toEqual(originalData);
    });

    it('should throw error for unsupported compression method', async () => {
      mockBucket.get.mockResolvedValue({
        body: {},
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0))
      });

      const entry: ZipFileEntry = {
        name: 'test.txt',
        size: 5,
        compressedSize: 5,
        offset: 0,
        crc32: 12345,
        compressionMethod: 99 // Unsupported
      };

      await expect(extractFile(mockBucket, 'test.zip', entry)).rejects.toThrow(
        'Unsupported compression method'
      );
    });

    it('should throw error if R2 get fails', async () => {
      mockBucket.get.mockResolvedValue(null);

      const entry: ZipFileEntry = {
        name: 'test.txt',
        size: 5,
        compressedSize: 5,
        offset: 0,
        crc32: 12345,
        compressionMethod: 0
      };

      await expect(extractFile(mockBucket, 'test.zip', entry)).rejects.toThrow(
        'Failed to extract file'
      );
    });

    it('should throw error if decompression fails', async () => {
      const invalidData = new Uint8Array([255, 255, 255, 255]);
      mockBucket.get.mockResolvedValue({
        body: {},
        arrayBuffer: vi.fn().mockResolvedValue(invalidData.buffer)
      });

      const entry: ZipFileEntry = {
        name: 'test.txt',
        size: 100,
        compressedSize: 4,
        offset: 0,
        crc32: 12345,
        compressionMethod: 8 // Deflate
      };

      await expect(extractFile(mockBucket, 'test.zip', entry)).rejects.toThrow(
        'Failed to decompress file'
      );
    });
  });

  describe('extractFiles', () => {
    it('should extract multiple files', async () => {
      const file1Data = new Uint8Array([1, 2, 3]);
      const file2Data = new Uint8Array([4, 5, 6]);

      mockBucket.get
        .mockResolvedValueOnce({
          body: {},
          arrayBuffer: vi.fn().mockResolvedValue(file1Data.buffer)
        })
        .mockResolvedValueOnce({
          body: {},
          arrayBuffer: vi.fn().mockResolvedValue(file2Data.buffer)
        });

      const entries: ZipFileEntry[] = [
        {
          name: 'file1.txt',
          size: 3,
          compressedSize: 3,
          offset: 0,
          crc32: 111,
          compressionMethod: 0
        },
        {
          name: 'file2.txt',
          size: 3,
          compressedSize: 3,
          offset: 3,
          crc32: 222,
          compressionMethod: 0
        }
      ];

      const results = await extractFiles(mockBucket, 'test.zip', entries);

      expect(results.size).toBe(2);
      expect(results.get('file1.txt')).toEqual(file1Data.buffer);
      expect(results.get('file2.txt')).toEqual(file2Data.buffer);
    });

    it('should continue extracting even if one file fails', async () => {
      const file1Data = new Uint8Array([1, 2, 3]);
      const file3Data = new Uint8Array([7, 8, 9]);

      mockBucket.get
        .mockResolvedValueOnce({
          body: {},
          arrayBuffer: vi.fn().mockResolvedValue(file1Data.buffer)
        })
        .mockResolvedValueOnce(null) // file2 fails
        .mockResolvedValueOnce({
          body: {},
          arrayBuffer: vi.fn().mockResolvedValue(file3Data.buffer)
        });

      const entries: ZipFileEntry[] = [
        {
          name: 'file1.txt',
          size: 3,
          compressedSize: 3,
          offset: 0,
          crc32: 111,
          compressionMethod: 0
        },
        {
          name: 'file2.txt',
          size: 3,
          compressedSize: 3,
          offset: 3,
          crc32: 222,
          compressionMethod: 0
        },
        {
          name: 'file3.txt',
          size: 3,
          compressedSize: 3,
          offset: 6,
          crc32: 333,
          compressionMethod: 0
        }
      ];

      const results = await extractFiles(mockBucket, 'test.zip', entries);

      expect(results.size).toBe(2);
      expect(results.has('file1.txt')).toBe(true);
      expect(results.has('file2.txt')).toBe(false);
      expect(results.has('file3.txt')).toBe(true);
    });

    it('should handle empty file list', async () => {
      const results = await extractFiles(mockBucket, 'test.zip', []);

      expect(results.size).toBe(0);
      expect(mockBucket.get).not.toHaveBeenCalled();
    });
  });
});