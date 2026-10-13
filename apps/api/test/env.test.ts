import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from '../src/config/env';

const valido = {
  NODE_ENV: 'development',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
  JWT_SECRET: 'x'.repeat(32),
  PRINT_KEY: 'y'.repeat(32),
  CORS_ORIGINS: 'http://localhost:5173, https://black-station-web.vercel.app',
  CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_KEY: '123',
  CLOUDINARY_API_SECRET: 'abc',
};

function sinVariable(key: keyof typeof valido): Record<string, string> {
  const env: Record<string, string> = { ...valido };
  delete env[key];
  return env;
}

const apiRoot = fileURLToPath(new URL('..', import.meta.url));

/** Corre `src/index.ts` en un proceso aparte con el env dado (sin heredar el de los tests). */
function arrancar(env: Record<string, string>) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: apiRoot,
    env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '', ...env },
    encoding: 'utf8',
    timeout: 30_000,
  });
}

describe('parseEnv', () => {
  it('acepta un env válido con defaults', () => {
    const env = parseEnv(valido);
    expect(env.PORT).toBe(3000);
    expect(env.FORCE_OPEN).toBe(false);
    expect(env.CORS_ORIGINS).toEqual([
      'http://localhost:5173',
      'https://black-station-web.vercel.app',
    ]);
  });

  it('dice qué variable falta', () => {
    const sinUri = sinVariable('MONGODB_URI');
    expect(() => parseEnv(sinUri)).toThrow(EnvError);
    expect(() => parseEnv(sinUri)).toThrow(/MONGODB_URI: falta/);
  });

  it('exige 32 caracteres en JWT_SECRET y PRINT_KEY', () => {
    expect(() => parseEnv({ ...valido, JWT_SECRET: 'corto', PRINT_KEY: 'corta' })).toThrow(
      /JWT_SECRET: mínimo 32[\s\S]*PRINT_KEY: mínimo 32/,
    );
  });

  it('rechaza FORCE_OPEN=true en producción', () => {
    expect(parseEnv({ ...valido, FORCE_OPEN: 'true' }).FORCE_OPEN).toBe(true);
    expect(() => parseEnv({ ...valido, NODE_ENV: 'production', FORCE_OPEN: 'true' })).toThrow(
      /FORCE_OPEN/,
    );
  });
});

describe('arranque del proceso', () => {
  it('sin MONGODB_URI no arranca y lo dice', () => {
    const sinUri = sinVariable('MONGODB_URI');
    const result = arrancar(sinUri);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/MONGODB_URI: falta/);
  });

  it('con FORCE_OPEN=true y NODE_ENV=production no arranca', () => {
    const result = arrancar({ ...valido, NODE_ENV: 'production', FORCE_OPEN: 'true' });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/FORCE_OPEN: no se permite con NODE_ENV=production/);
  });
});
