import { describe, it, expect, vi, beforeEach } from 'vitest';
import { R2RangeReader } from '@/adapters/zip/r2-range-reader';

describe('R2RangeReader', () => {
  let mockBucket: any;
  let reader: R2RangeReader;

  beforeEach(() => {
    mockBucket = {
      head: vi.fn(),
      get: vi.fn()
    };
    reader = new R2RangeReader(mockBucket, 'test.zip');
  });

  describe('getLength', () => {
    it('should return the size of the ZIP file', async () => {
      mockBucket.head.mockResolvedValue({ size: 1024 });

      const length = await reader.getLength();

      expect(length).toBe(1024);
      expect(mockBucket.head).toHaveBeenCalledWith('test.zip');
    });

    it('should cache the length after first call', async () => {
      mockBucket.head.mockResolvedValue({ size: 2048 });

      const length1 = await reader.getLength();
      const length2 = await reader.getLength();

      expect(length1).toBe(2048);
      expect(length2).toBe(2048);
      expect(mockBucket.head).toHaveBeenCalledTimes(1);
    });

    it('should throw error if ZIP file not found', async () => {
      mockBucket.head.mockResolvedValue(null);

      await expect(reader.getLength()).rejects.toThrow('ZIP file not found');
    });
  });

  describe('read', () => {
    it('should read a byte range from the ZIP file', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);
      mockBucket.get.mockResolvedValue({
        body: {},
        arrayBuffer: vi.fn().mockResolvedValue(mockData.buffer)
      });

      const result = await reader.read(0, 5);

      expect(result).toEqual(mockData);
      expect(mockBucket.get).toHaveBeenCalledWith('test.zip', {
        range: { offset: 0, length: 5 }
      });
    });

    it('should throw error if range request fails', async () => {
      mockBucket.get.mockResolvedValue(null);

      await expect(reader.read(0, 5)).rejects.toThrow('Failed to read range');
    });

    it('should throw error if body is missing', async () => {
      mockBucket.get.mockResolvedValue({ body: null });

      await expect(reader.read(0, 5)).rejects.toThrow('Failed to read range');
    });

    it('should handle multiple range requests', async () => {
      const mockData1 = new Uint8Array([1, 2, 3]);
      const mockData2 = new Uint8Array([4, 5, 6]);

      mockBucket.get
        .mockResolvedValueOnce({
          body: {},
          arrayBuffer: vi.fn().mockResolvedValue(mockData1.buffer)
        })
        .mockResolvedValueOnce({
          body: {},
          arrayBuffer: vi.fn().mockResolvedValue(mockData2.buffer)
        });

      const result1 = await reader.read(0, 3);
      const result2 = await reader.read(3, 3);

      expect(result1).toEqual(mockData1);
      expect(result2).toEqual(mockData2);
      expect(mockBucket.get).toHaveBeenCalledTimes(2);
    });
  });
});