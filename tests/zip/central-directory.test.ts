import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCentralDirectory, clearCentralDirectoryCache } from '@/services/zip/central-directory';
import type { ZipCentralDirectory } from '@/types/zip';

const { mockUnzip, mockR2RangeReader } = vi.hoisted(() => ({
  mockUnzip: vi.fn(),
  mockR2RangeReader: vi.fn()
}));

vi.mock('unzipit', () => ({
  unzip: mockUnzip
}));

vi.mock('@/adapters/zip/r2-range-reader', () => ({
  R2RangeReader: mockR2RangeReader
}));

describe('Central Directory Service', () => {
  let mockBucket: { head: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
  let mockKV: {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockReader: { getLength: ReturnType<typeof vi.fn>; read: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUnzip.mockReset();
    mockR2RangeReader.mockReset();

    mockBucket = {
      head: vi.fn(),
      get: vi.fn()
    };

    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    };

    mockReader = {
      getLength: vi.fn().mockResolvedValue(5000),
      read: vi.fn()
    };

    mockR2RangeReader.mockImplementation(() => mockReader);
  });

  describe('getCentralDirectory', () => {
    it('returns cached central directory from KV', async () => {
      const cachedCD: ZipCentralDirectory = {
        entries: {
          'index.html': {
            name: 'index.html',
            size: 1024,
            compressedSize: 512,
            offset: 0,
            crc32: 12345,
            compressionMethod: 8
          }
        },
        totalSize: 5000,
        cachedAt: new Date().toISOString()
      };

      mockKV.get.mockResolvedValue(cachedCD);

      const result = await getCentralDirectory(mockBucket as any, mockKV as any, 'test.zip');

      expect(result).toEqual(cachedCD);
      expect(mockKV.get).toHaveBeenCalledWith('cd:test.zip', 'json');
      expect(mockR2RangeReader).not.toHaveBeenCalled();
      expect(mockUnzip).not.toHaveBeenCalled();
    });

    it('hydrates from R2 when KV cache misses and caches result', async () => {
      mockKV.get.mockResolvedValue(null);

      const entryOffset = vi.fn().mockResolvedValue(256);
      mockUnzip.mockResolvedValue({
        entries: {
          'index.html': {
            size: 1024,
            compressedSize: 512,
            crc32: 12345,
            compressionMethod: 8,
            offset: entryOffset
          },
          'styles.css': {
            size: 256,
            compressedSize: 200,
            crc32: 67890,
            compressionMethod: 0,
            offset: vi.fn().mockResolvedValue(1024)
          }
        }
      });

      const result = await getCentralDirectory(mockBucket as any, mockKV as any, 'test.zip');

      expect(mockKV.get).toHaveBeenCalledWith('cd:test.zip', 'json');
      expect(mockR2RangeReader).toHaveBeenCalledWith(mockBucket, 'test.zip');
      expect(mockUnzip).toHaveBeenCalledWith(mockReader);
      expect(mockReader.getLength).toHaveBeenCalledTimes(1);
      expect(entryOffset).toHaveBeenCalled();

      expect(result.entries['index.html']).toMatchObject({
        name: 'index.html',
        size: 1024,
        compressedSize: 512,
        offset: 256,
        crc32: 12345,
        compressionMethod: 8
      });
      expect(result.entries['styles.css']).toMatchObject({
        name: 'styles.css',
        size: 256,
        compressedSize: 200,
        offset: 1024,
        crc32: 67890,
        compressionMethod: 0
      });
      expect(result.totalSize).toBe(5000);
      expect(typeof result.cachedAt).toBe('string');

      expect(mockKV.put).toHaveBeenCalledTimes(1);
      const [, payload, options] = mockKV.put.mock.calls[0];
      expect(options).toEqual({ expirationTtl: 86400 });

      const parsedPayload = JSON.parse(payload);
      expect(parsedPayload.entries['index.html']).toMatchObject({
        name: 'index.html',
        size: 1024,
        compressedSize: 512,
        offset: 256,
        crc32: 12345,
        compressionMethod: 8
      });
      expect(parsedPayload.totalSize).toBe(5000);
      expect(typeof parsedPayload.cachedAt).toBe('string');
    });

    it('falls back to R2 when KV read fails', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockKV.get.mockRejectedValue(new Error('KV error'));

      mockUnzip.mockResolvedValue({
        entries: {}
      });

      await getCentralDirectory(mockBucket as any, mockKV as any, 'test.zip');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read central directory from KV cache')
      );
      expect(mockR2RangeReader).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('propagates errors from unzip when R2 access fails', async () => {
      mockKV.get.mockResolvedValue(null);
      const failure = new Error('range read failed');
      mockUnzip.mockRejectedValue(failure);

      await expect(getCentralDirectory(mockBucket as any, mockKV as any, 'test.zip')).rejects.toThrow(
        'Failed to read central directory from ZIP'
      );

      expect(mockKV.put).not.toHaveBeenCalled();
    });
  });

  describe('clearCentralDirectoryCache', () => {
    it('deletes central directory from KV', async () => {
      await clearCentralDirectoryCache(mockKV as any, 'test.zip');

      expect(mockKV.delete).toHaveBeenCalledWith('cd:test.zip');
    });

    it('swallows deletion errors', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockKV.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(clearCentralDirectoryCache(mockKV as any, 'test.zip')).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clear central directory cache')
      );
      warnSpy.mockRestore();
    });

    it('handles multiple ZIPs', async () => {
      await clearCentralDirectoryCache(mockKV as any, 'test1.zip');
      await clearCentralDirectoryCache(mockKV as any, 'test2.zip');

      expect(mockKV.delete).toHaveBeenNthCalledWith(1, 'cd:test1.zip');
      expect(mockKV.delete).toHaveBeenNthCalledWith(2, 'cd:test2.zip');
    });
  });
});