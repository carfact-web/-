#!/usr/bin/env python3
"""Manage only an unlinked local Supabase instance. Never accepts remote commands."""
import json,os,re,subprocess,sys
from pathlib import Path
repo=Path(__file__).resolve().parents[2]
work=repo.parent
backend=work/'local-backend'
cli=work/'supabase-tools/node_modules/.bin/supabase'
env=os.environ.copy()
env['SUPABASE_HOME']=str(work/'supabase-home')
env['SUPABASE_TELEMETRY_DISABLED']='1'
for k in ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','SUPABASE_PROJECT_ID']:
 env.pop(k,None)

def run(args):
 r=subprocess.run([str(cli),'--workdir',str(backend),*args],env=env,capture_output=True,text=True)
 if r.returncode:raise SystemExit('Local Supabase command failed; inspect private local state without printing keys.')
 return r.stdout

def status():
 s=json.loads(run(['status','--output-format','json']))
 if s.get('readiness')!='ready':raise SystemExit('Local services not ready.')
 for k in ['API_URL','DB_URL']:
  from urllib.parse import urlparse
  if urlparse(s['env'][k]).hostname not in ['127.0.0.1','localhost']:raise SystemExit('Nonlocal endpoint refused.')
 p=work/'native-status-private.json';p.write_text(json.dumps(s));p.chmod(0o600)
 return s

command=sys.argv[1] if len(sys.argv)==2 else ''
if command=='prepare':
 m=backend/'supabase/migrations';m.mkdir(parents=True,exist_ok=True)
 config=backend/'supabase/config.toml'
 if not config.exists():config.write_text((Path(__file__).parent/'config.toml').read_text())
 schema=(repo/'supabase/schema.sql').read_text()
 tables=re.findall(r'create table if not exists public\.[\s\S]*?\n\);',schema)
 base='create extension if not exists "pgcrypto";\ncreate extension if not exists "pg_trgm";\n'+'\n\n'.join(tables)
 base=base.replace('  user_id uuid not null references auth.users(id) on delete cascade,','  user_id uuid not null references auth.users(id) on delete cascade,\n  author_id uuid references auth.users(id) on delete set null,',1)
 (m/'20260530000000_local_bootstrap.sql').write_text(base)
 for p in sorted((repo/'supabase/migrations').glob('*.sql')):
  s=p.read_text()
  for name,types in [('set_review_helpful_count','uuid,integer'),('public_get_recent_home_reviews','integer')]:
   if f'create or replace function public.{name}(' in s:s=f'drop function if exists public.{name}({types});\n'+s
  (m/p.name).write_text(s)
 print('Prepared unlinked local migrations; no production files changed.')
elif command=='start':
 run(['start','--runtime','native','--exclude','realtime,functions,analytics,pooler','--eager']);s=status()
 for key in ['API_URL','STUDIO_URL','MAILPIT_URL']:print(key,s['env'][key])
elif command=='status':
 s=status()
 for key in ['API_URL','STUDIO_URL','MAILPIT_URL']:print(key,s['env'][key])
elif command=='stop':
 run(['stop']);print('Stopped only the local backend.')
elif command=='seed':
 status();subprocess.run([str(work/'toolchain/node-v22.23.0-darwin-arm64/bin/node'),str(Path(__file__).parent/'seed.cjs')],env=env,cwd=repo,check=True)
elif command=='app':
 status()
 env['NODE_OPTIONS']='--require='+str(Path(__file__).parent/'network.cjs')
 env['NEXT_TELEMETRY_DISABLED']='1'
 os.chdir(repo)
 os.execvpe('sh',['sh','scripts/with-project-node.sh','npm','run','dev','--','--hostname','127.0.0.1','--port','3100'],env)
else:raise SystemExit('Usage: python3 scripts/local-sandbox/manage.py prepare|start|status|seed|app|stop')
