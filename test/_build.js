// Builds the site once per test process; every test file awaits this.
import { execSync } from 'node:child_process';
let built;
export function build() {
  if (!built) {
    execSync('npx @11ty/eleventy --quiet', { stdio: 'pipe', env: { ...process.env, NODE_NO_WARNINGS: '1' } });
    built = true;
  }
}
