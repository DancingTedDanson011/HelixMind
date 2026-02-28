import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/spiral/**', 'src/storage/**', 'src/cli/**'],
      exclude: [
        'src/index.ts',
        'src/types.ts',
        'src/cli/index.ts',
        'src/cli/ui/logo.ts',
        'src/cli/ui/spinner.ts',
        'src/cli/ui/chat-view.ts',
        'src/cli/commands/chat.ts',
        'src/cli/commands/config.ts',
        'src/cli/commands/spiral.ts',
        'src/cli/providers/types.ts',
        'src/cli/types.d.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 30000,
  },
});