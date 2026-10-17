import { describe, expect, it } from 'vitest';
import { fotoCloudinary } from './foto';

describe('fotoCloudinary', () => {
  it('inserta las transformaciones después de /upload/', () => {
    expect(
      fotoCloudinary(
        'https://res.cloudinary.com/x/image/upload/v1/blackstation/products/a.jpg',
        400,
      ),
    ).toBe(
      'https://res.cloudinary.com/x/image/upload/f_auto,q_auto,w_400,c_limit/v1/blackstation/products/a.jpg',
    );
  });

  it('usa el ancho pedido', () => {
    expect(fotoCloudinary('https://res.cloudinary.com/x/image/upload/v1/a.jpg', 800)).toContain(
      '/upload/f_auto,q_auto,w_800,c_limit/v1/a.jpg',
    );
  });

  it.each([
    ['data URL', 'data:image/jpeg;base64,AAAA'],
    ['otro dominio', 'https://example.com/image/upload/v1/a.jpg'],
    ['Cloudinary sin /upload/', 'https://res.cloudinary.com/x/image/fetch/v1/a.jpg'],
    ['texto que no es URL', 'no-es-una-url'],
  ])('%s → vuelve igual', (_caso, url) => {
    expect(fotoCloudinary(url, 400)).toBe(url);
  });
});
