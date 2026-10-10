import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Local D1 workerd instances require serialized suites for stable process lifetimes.
  test: { fileParallelism: false, environment: 'node', include: ['tests/**/*.test.ts'] },
});
