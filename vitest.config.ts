import { defineConfig, configDefaults } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    // Claude Code worktrees sit at .claude/worktrees/<name>/ inside the repo and
    // carry their own copy of src/, so the default glob collects every test
    // twice — once here, once per open worktree.
    exclude: [...configDefaults.exclude, '.claude/**'],
    environment: 'node',
    fakeTimers: {
      now: undefined,
    },
  },
});
