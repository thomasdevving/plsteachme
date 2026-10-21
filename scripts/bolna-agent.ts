// Prints, creates or updates the Bolna voice coaching agent from lib/voice/agent-config.ts.
//   npm run bolna:agent -- --print [--mode tools] [--placeholders]
//   npm run bolna:agent -- --create [--mode tools]
//   npm run bolna:agent -- --update <agent_id> [--mode tools]
// Reads BOLNA_API_KEY, BOLNA_TOOL_SECRET, BOLNA_WEBHOOK_SECRET, NEXT_PUBLIC_SITE_URL and
// VOICE_MAX_CALL_SECONDS from the environment (for example: node --env-file=.env.local).
import { writeFileSync } from 'node:fs';
import { buildAgentConfig, EXAMPLE_INPUT as PLACEHOLDERS, type AgentMode } from '../lib/voice/agent-config';

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const value = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const mode: AgentMode = value('--mode') === 'tools' ? 'tools' : 'graph';
  if (flag('--examples')) {
    for (const m of ['graph', 'tools'] as const) writeFileSync(new URL(`../bolna/agent.${m}.example.json`, import.meta.url), `${JSON.stringify(buildAgentConfig({ ...PLACEHOLDERS, mode: m }), null, 2)}\n`);
    return;
  }
  const env = process.env;
  const input = flag('--placeholders') ? { ...PLACEHOLDERS, mode } : {
    appUrl: env.NEXT_PUBLIC_SITE_URL || '', toolSecret: env.BOLNA_TOOL_SECRET || '', webhookSecret: env.BOLNA_WEBHOOK_SECRET || '',
    maxCallSeconds: Number(env.VOICE_MAX_CALL_SECONDS || 300), mode,
  };
  if (!/^https:\/\//.test(input.appUrl)) throw new Error('NEXT_PUBLIC_SITE_URL must be the public HTTPS address Bolna can reach.');
  if (input.toolSecret.length < 24 || input.webhookSecret.length < 24) throw new Error('BOLNA_TOOL_SECRET and BOLNA_WEBHOOK_SECRET need at least 24 characters.');
  const config = buildAgentConfig(input);
  if (flag('--print') || flag('--placeholders')) { console.log(JSON.stringify(config, null, 2)); return; }
  const key = env.BOLNA_API_KEY;
  if (!key) throw new Error('Set BOLNA_API_KEY.');
  const base = (env.BOLNA_API_BASE || 'https://api.bolna.ai').replace(/\/$/, '');
  const id = value('--update');
  if (!id && !flag('--create')) throw new Error('Use --print, --create or --update <agent_id>.');
  const response = await fetch(id ? `${base}/v2/agent/${encodeURIComponent(id)}` : `${base}/v2/agent`, {
    method: id ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(config),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Bolna returned ${response.status}: ${body.slice(0, 500)}`);
  console.log(body);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
