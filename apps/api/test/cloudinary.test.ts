import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnv } from '../src/config/env';
import { destroyImage, esFotoPropia, firmarParams } from '../src/lib/cloudinary';
import { setClock } from '../src/lib/clock';

const sha1 = (s: string) => createHash('sha1').update(s).digest('hex');

afterEach(() => {
  setClock(null);
  vi.restoreAllMocks();
});

describe('firmarParams', () => {
  it('ordena alfabéticamente, une con & y concatena el secret', () => {
    expect(firmarParams({ timestamp: 123, public_id: 'a/b', folder: 'x' }, 'secreto')).toBe(
      sha1('folder=x&public_id=a/b&timestamp=123secreto'),
    );
  });

  it('usa CLOUDINARY_API_SECRET por defecto', () => {
    expect(firmarParams({ timestamp: 1 })).toBe(
      sha1(`timestamp=1${getEnv().CLOUDINARY_API_SECRET}`),
    );
  });
});

describe('esFotoPropia', () => {
  const cloud = getEnv().CLOUDINARY_CLOUD_NAME;
  const url = `https://res.cloudinary.com/${cloud}/image/upload/v1/blackstation/products/a.jpg`;

  it('acepta carpeta y cuenta propias', () => {
    expect(esFotoPropia(url, 'blackstation/products/a')).toBe(true);
  });

  it('rechaza otra carpeta u otra cuenta', () => {
    expect(esFotoPropia(url, 'blackstation/otra/a')).toBe(false);
    expect(esFotoPropia(url, 'blackstation/productsx/a')).toBe(false);
    expect(
      esFotoPropia(
        `https://res.cloudinary.com/${cloud}x/image/upload/a.jpg`,
        'blackstation/products/a',
      ),
    ).toBe(false);
    expect(
      esFotoPropia(`http://res.cloudinary.com/${cloud}/a.jpg`, 'blackstation/products/a'),
    ).toBe(false);
  });
});

describe('destroyImage', () => {
  it('POST a image/destroy con public_id, timestamp, api_key y firma', async () => {
    setClock(() => new Date('2026-10-16T21:00:00.000Z'));
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ result: 'ok' }));

    await expect(destroyImage('blackstation/products/a')).resolves.toBe('ok');

    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = getEnv();
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`);
    expect(init?.method).toBe('POST');
    const body = Object.fromEntries(new URLSearchParams(String(init?.body)));
    expect(body).toEqual({
      public_id: 'blackstation/products/a',
      timestamp: '1792184400',
      api_key: CLOUDINARY_API_KEY,
      signature: sha1(
        `public_id=blackstation/products/a&timestamp=1792184400${CLOUDINARY_API_SECRET}`,
      ),
    });
  });

  it('devuelve el result de Cloudinary (not found)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ result: 'not found' }));
    await expect(destroyImage('blackstation/products/a')).resolves.toBe('not found');
  });

  it('tira si Cloudinary no responde 2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    await expect(destroyImage('blackstation/products/a')).rejects.toThrow(/500/);
  });

  it('tira si fetch rechaza', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('sin red'));
    await expect(destroyImage('blackstation/products/a')).rejects.toThrow('sin red');
  });
});
