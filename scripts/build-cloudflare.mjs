import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';

// OpenNext copies .env files into its server bundle. Runtime credentials belong
// in ignored .dev.vars locally and encrypted Worker secrets in production.
for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  if (!existsSync(file)) continue;
  for (const [name, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    if (value.trim() && /(?:KEY|TOKEN|SECRET|PASSWORD)$/.test(name) &&
        !['SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].includes(name)) {
      throw new Error(`Move ${name} from ${file} to .dev.vars / Worker secrets before building.`);
    }
  }
}

// These public values must agree at build time (static pages) and request time.
const { vars } = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const env = { ...process.env };
for (const name of ['NEXT_PUBLIC_SITE_URL', 'OPERATOR_NAME', 'CONTACT_EMAIL']) {
  if (vars[name]) env[name] = vars[name];
}
const result = spawnSync(process.execPath, ['node_modules/@opennextjs/cloudflare/dist/cli/index.js', 'build'], {
  env, stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
