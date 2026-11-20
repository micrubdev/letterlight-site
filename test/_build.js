// Builds the site once per test process; every test file awaits this.
// npm test builds once up front and sets LL_BUILT, so parallel test files never rebuild _site while another reads it.
import { execSync } from 'node:child_process';
let built;
export function build() {
  if (!built && !process.env.LL_BUILT) {
    execSync('npx @11ty/eleventy --quiet', { stdio: 'pipe', env: { ...process.env, NODE_NO_WARNINGS: '1' } });
    built = true;
  }
}
