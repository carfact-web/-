/* eslint-disable @typescript-eslint/no-require-imports -- Windows-only local preparation CLI. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../..');
const work = path.dirname(repo);
const backend = path.join(work, 'local-backend-windows');
function prepare() {
 const migrations = path.join(backend, 'supabase/migrations');
 fs.mkdirSync(migrations, { recursive: true });
 const config = path.join(backend, 'supabase/config.toml');
 if (!fs.existsSync(config)) {
  const template = fs.readFileSync(path.join(__dirname, 'config.toml'), 'utf8');
  fs.writeFileSync(config, template.replace('project_id = "local-backend"', 'project_id = "carfact-windows"'));
 }
 const schema = fs.readFileSync(path.join(repo, 'supabase/schema.sql'), 'utf8').replace(/\r\n/g, '\n');
 const tables = schema.match(/create table if not exists public\.[\s\S]*?\n\);/g);
 if (!tables || tables.length !== 9) throw Error('Unexpected bootstrap schema; refusing preparation.');
 let base = 'create extension if not exists "pgcrypto";\ncreate extension if not exists "pg_trgm";\n' + tables.join('\n\n');
 base = base.replace('  user_id uuid not null references auth.users(id) on delete cascade,', '  user_id uuid not null references auth.users(id) on delete cascade,\n  author_id uuid references auth.users(id) on delete set null,');
 fs.writeFileSync(path.join(migrations, '20260530000000_local_bootstrap.sql'), base);
 for (const name of fs.readdirSync(path.join(repo, 'supabase/migrations')).filter(n => n.endsWith('.sql')).sort()) {
  let sql = fs.readFileSync(path.join(repo, 'supabase/migrations', name), 'utf8').replace(/\r\n/g, '\n');
  for (const [fn, types] of [['set_review_helpful_count', 'uuid,integer'], ['public_get_recent_home_reviews', 'integer']]) {
   if (sql.includes(`create or replace function public.${fn}(`)) sql = `drop function if exists public.${fn}(${types});\n` + sql;
  }
  fs.writeFileSync(path.join(migrations, name), sql);
 }
 console.log('Prepared separate Windows SQL/config only; no DB started or modified.');
}
const dockerExe = path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Docker/Docker/resources/bin/docker.exe');
const cliExe = path.join(work, 'supabase-tools/node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
const pipe = 'npipe:////./pipe/dockerDesktopLinuxEngine';
const network = 'carfact-windows-loopback';
function run(exe, args, env = process.env) {
 const result = spawnSync(exe, args, { cwd: repo, env, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
 if (result.status !== 0) throw Error('Local command failed; output suppressed to protect credentials.');
 return result.stdout;
}
function docker(args) { return run(dockerExe, ['--context', 'desktop-linux', ...args]); }
function localDocker() {
 if (process.version !== 'v22.23.0') throw Error('Use project Node 22.23.0.');
 if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) throw Error('Inherited Docker overrides refused.');
 const context = JSON.parse(docker(['context', 'inspect', 'desktop-linux']))[0];
 if (context.Endpoints?.docker?.Host !== pipe) throw Error('Expected local Docker Desktop named pipe.');
 if (docker(['info', '--format', '{{.OSType}}']).trim() !== 'linux') throw Error('Linux engine required.');
}
function cli(args) {
 const env = { ...process.env, DOCKER_HOST: pipe, SUPABASE_TELEMETRY_DISABLED: '1', SUPABASE_EXPERIMENTAL_STACK: '1' };
 for (const key of ['DOCKER_CONTEXT', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD', 'SUPABASE_PROJECT_ID']) delete env[key];
 return run(cliExe, ['--workdir', backend, ...args], env);
}
function restrictedFile(file, contents) {
 if (!fs.existsSync(file)) fs.writeFileSync(file, '', { mode: 0o600 });
 const user = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
 run('icacls', [file, '/inheritance:r', '/grant:r', `${user}:(F)`, '*S-1-5-18:(F)', '*S-1-5-32-544:(F)']);
 if (contents !== undefined) fs.writeFileSync(file, contents, { mode: 0o600 });
}
function bindings() {
 const ids = docker(['ps', '-q', '--filter', 'name=supabase-local-backend-windows-']).trim().split(/\s+/).filter(Boolean);
 if (!ids.length) throw Error('No CARFACT containers running.');
 const containers = JSON.parse(docker(['inspect', ...ids]));
 for (const container of containers) for (const values of Object.values(container.NetworkSettings.Ports || {})) {
  for (const binding of values || []) if (!['127.0.0.1', '::1'].includes(binding.HostIp)) throw Error('Nonloopback published port refused.');
 }
}
function status(save = true) {
 localDocker(); bindings();
 const state = JSON.parse(cli(['status', '--output-format', 'json']));
 if (state.runtime !== 'docker' || path.resolve(state.identity?.project_root || '') !== backend) throw Error('Wrong runtime/project identity.');
 const env = state.env;
 require('./verify.cjs').assertLocalState(state, { ...process.env, NEXT_PUBLIC_SUPABASE_URL: env.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: env.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY, NEXT_PUBLIC_LOCAL_SANDBOX: '1', CARFACT_LOCAL_SANDBOX: '1' });
 if (save) restrictedFile(path.join(work, 'native-status-private.json'), JSON.stringify(state));
 console.log('PASS local Docker identity, ready services, loopback bindings and endpoints; credentials hidden.');
 return state;
}
function start() {
 localDocker();
 const config = path.join(backend, 'supabase/config.toml');
 if (!fs.existsSync(config)) throw Error('Run prepare first.');
 let networks = docker(['network', 'ls', '--filter', `name=^${network}$`, '--format', '{{.Name}}']).trim();
 if (!networks) docker(['network', 'create', '--driver', 'bridge', '--opt', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', network]);
 const options = JSON.parse(docker(['network', 'inspect', network]))[0].Options;
 if (options?.['com.docker.network.bridge.host_binding_ipv4'] !== '127.0.0.1') throw Error('Loopback network option missing.');
 // Existing stacks retain their eager setting. Stop/start explicitly, preserving data.
 cli(['stop']);
 cli(['start', '--runtime', 'docker', '--network-id', network, '--exclude', 'realtime,functions,analytics,pooler', '--eager']);
 status();
}
function seed() {
 status();
 // Refuse inherited remote overrides before the shared seed can write anything.
 for (const [name, value] of Object.entries(process.env)) if (value && /^(NEXT_PUBLIC_)?(SUPABASE|DATABASE|DIRECT|DB|AUTH|STORAGE|REST).*?(URL|URI|HOST)$/.test(name)) {
  const hostname = name.endsWith('HOST') ? value : new URL(value).hostname;
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname)) throw Error('Nonlocal environment override refused.');
 }
 const privateFiles = [path.join(repo, '.env.local'), path.join(work, 'local-test-account.json'), path.join(work, 'webtoon-admin-account.json')];
 if (!fs.existsSync(path.join(repo, '.env.local'))) restrictedFile(path.join(repo, '.env.local'), '');
 try {
  console.log(run(process.execPath, [path.join(__dirname, 'seed.cjs')]).trim());
  console.log(run(process.execPath, [path.join(repo, 'scripts/webtoons/create-local-admin.cjs')]).trim());
 } finally { for (const file of privateFiles) if (fs.existsSync(file)) restrictedFile(file); }
}
function doctor() {
 localDocker();
 if (!fs.existsSync(path.join(repo, 'node_modules/next/package.json')) || !fs.existsSync(cliExe)) throw Error('Project dependencies missing.');
 console.log('PASS project Node, dependencies and local Linux Docker engine.');
}
function app() {
 status(); require('./verify.cjs').verify();
 const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
 env.NODE_OPTIONS = '--require=' + JSON.stringify(path.join(__dirname, 'network.cjs'));
 const result = spawnSync(process.execPath, [path.join(repo, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3100'], { cwd: repo, env, stdio: 'inherit', windowsHide: true });
 process.exitCode = result.status ?? 1;
}
if (require.main === module) {
 try {
  if (process.platform !== 'win32') throw Error('Use manage.py on macOS.');
  const commands = { prepare, doctor, start, status, seed, app, stop: () => { localDocker(); cli(['stop']); console.log('Stopped only the CARFACT Windows stack; data preserved.'); } };
  const command = commands[process.argv[2]];
  if (!command) throw Error('Usage: manage-windows.cjs prepare|doctor|start|status|seed|app|stop');
  command();
 } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { prepare, restrictedFile };
