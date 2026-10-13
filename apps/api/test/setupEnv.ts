// Env válido para los tests (sin pisar lo que ya venga definido). `MONGODB_URI` no se usa: cada
// suite con base levanta su mongodb-memory-server.
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/no-se-usa',
  JWT_SECRET: 'test-jwt-secret-de-al-menos-32-caracteres',
  PRINT_KEY: 'test-print-key-de-al-menos-32-caracteres',
  CORS_ORIGINS: 'http://localhost:5173',
  CLOUDINARY_CLOUD_NAME: 'test',
  CLOUDINARY_API_KEY: 'test',
  CLOUDINARY_API_SECRET: 'test',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
