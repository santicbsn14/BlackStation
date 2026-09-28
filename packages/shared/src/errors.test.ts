import { describe, expect, it } from 'vitest';
import { ERROR_CODES, ERROR_STATUS, isErrorCode } from './errors';

describe('ERROR_CODES', () => {
  it('no tiene duplicados', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it('cada code tiene su status y no sobran status', () => {
    expect(Object.keys(ERROR_STATUS).sort()).toEqual([...ERROR_CODES].sort());
  });

  it('isErrorCode reconoce solo los codes definidos', () => {
    expect(isErrorCode('SLOT_FULL')).toBe(true);
    expect(isErrorCode('HTTP_ERROR')).toBe(false);
    expect(isErrorCode(42)).toBe(false);
  });
});
