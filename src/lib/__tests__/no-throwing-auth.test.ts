import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guard against reintroducing the throw-based auth helpers.
 *
 * `throw new Response(...)` is a Remix idiom. Next's App Router treats a
 * thrown Response as an unhandled error and serves an empty-bodied 500, so a
 * route using it can never return the 401/403 it means to — which is exactly
 * how an unauthenticated projector ended up reporting a network failure.
 */

const API_DIR = join(process.cwd(), 'src/app/api');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : routeFiles(full);
    }
    return entry === 'route.ts' ? [full] : [];
  });
}

describe('API routes never use the throw-based auth helpers', () => {
  const files = routeFiles(API_DIR);

  it('finds route files to check', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files.map((f) => [f.slice(f.indexOf('src/')), f] as const))(
    '%s',
    (_label, file) => {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/\bgetSessionUser\s*\(/);
      expect(src).not.toMatch(/\brequireCourseAdmin\b/);
      expect(src).not.toMatch(/\brequireSuperAdmin\b/);
    },
  );

  it('keeps throw new Response out of the permissions module', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/permissions.ts'), 'utf8');
    expect(src).not.toMatch(/throw new Response/);
  });
});
