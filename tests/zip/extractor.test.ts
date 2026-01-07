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
      const localHeader = new Uint8Array(30);
      // filenameLength=0, extraFieldLength=0 => dataOffset = entry.offset + 30
      localHeader[26] = 0;
      localHeader[27] = 0;
      localHeader[28] = 0;
      localHeader[29] = 0;

      const fileData = new Uint8Array([1, 2, 3, 4, 5]);

      mockBucket.get
        .mockResolvedValueOnce({
          body: {},
          arrayBuffer: vi.fn().mockResolvedValue(localHeader.buffer)
        })
        .mockResolvedValueOnce({
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
      expect(mockBucket.get).toHaveBeenNthCalledWith(1, 'test.zip', {
        range: { offset: 0, length: 30 }
      });
      expect(mockBucket.get).toHaveBeenNthCalledWith(2, 'test.zip', {
        range: { offset: 30, length: 5 }
      });
    });

    it('should extract and decompress a deflate-compressed file', async () => {
      const localHeader = new Uint8Array(30);
      localHeader[26] = 0;
      localHeader[27] = 0;
      localHeader[28] = 0;
      localHeader[29] = 0;

      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const compressedData = pako.deflateRaw(originalData);

      mockBucket.get
        .mockResolvedValueOnce({
          body: {},
          arrayBuffer: vi.fn().mockResolvedValue(localHeader.buffer)
        })
        .mockResolvedValueOnce({
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
      const localHeader = new Uint8Array(30);
      localHeader[26] = 0;
      localHeader[27] = 0;
      localHeader[28] = 0;
      localHeader[29] = 0;

      mockBucket.get
        .mockResolvedValueOnce({
          body: {},
          arrayBuffer: vi.fn().mockResolvedValue(localHeader.buffer)
        })
        .mockResolvedValueOnce({
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

    it('should throw error if local header read fails', async () => {
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
        'Failed to read local header'
      );
    });

    it('should throw error if file data read fails', async () => {
      const localHeader = new Uint8Array(30);
      localHeader[26] = 0;
      localHeader[27] = 0;
      localHeader[28] = 0;
      localHeader[29] = 0;

      mockBucket.get
        .mockResolvedValueOnce({
          body: {},
          arrayBuffer: vi.fn().mockResolvedValue(localHeader.buffer)
        })
        .mockResolvedValueOnce(null);

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
      const localHeader = new Uint8Array(30);
      localHeader[26] = 0;
      localHeader[27] = 0;
      localHeader[28] = 0;
      localHeader[29] = 0;

      const invalidData = new Uint8Array([255, 255, 255, 255]);

      mockBucket.get
        .mockResolvedValueOnce({
          body: {},
          arrayBuffer: vi.fn().mockResolvedValue(localHeader.buffer)
        })
        .mockResolvedValueOnce({
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
      const header1 = new Uint8Array(30);
      header1[26] = 0;
      header1[27] = 0;
      header1[28] = 0;
      header1[29] = 0;

      const header2 = new Uint8Array(30);
      header2[26] = 0;
      header2[27] = 0;
      header2[28] = 0;
      header2[29] = 0;

      const file1Data = new Uint8Array([1, 2, 3]);
      const file2Data = new Uint8Array([4, 5, 6]);

      // Each file extraction reads: local header (30 bytes), then file bytes.
      mockBucket.get
        .mockResolvedValueOnce({ body: {}, arrayBuffer: vi.fn().mockResolvedValue(header1.buffer) })
        .mockResolvedValueOnce({ body: {}, arrayBuffer: vi.fn().mockResolvedValue(file1Data.buffer) })
        .mockResolvedValueOnce({ body: {}, arrayBuffer: vi.fn().mockResolvedValue(header2.buffer) })
        .mockResolvedValueOnce({ body: {}, arrayBuffer: vi.fn().mockResolvedValue(file2Data.buffer) });

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
      const header1 = new Uint8Array(30);
      header1[26] = 0;
      header1[27] = 0;
      header1[28] = 0;
      header1[29] = 0;

      const header3 = new Uint8Array(30);
      header3[26] = 0;
      header3[27] = 0;
      header3[28] = 0;
      header3[29] = 0;

      const file1Data = new Uint8Array([1, 2, 3]);
      const file3Data = new Uint8Array([7, 8, 9]);

      // file1: header + bytes
      // file2: header read fails (null)
      // file3: header + bytes
      mockBucket.get
        .mockResolvedValueOnce({ body: {}, arrayBuffer: vi.fn().mockResolvedValue(header1.buffer) })
        .mockResolvedValueOnce({ body: {}, arrayBuffer: vi.fn().mockResolvedValue(file1Data.buffer) })
        .mockResolvedValueOnce(null) // file2 local header fails
        .mockResolvedValueOnce({ body: {}, arrayBuffer: vi.fn().mockResolvedValue(header3.buffer) })
        .mockResolvedValueOnce({ body: {}, arrayBuffer: vi.fn().mockResolvedValue(file3Data.buffer) });

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