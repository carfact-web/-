/* eslint-disable @typescript-eslint/no-require-imports -- Build with local synthetic data; no preview/validator bypass. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../..');
try{
 if(process.version!=='v22.23.0')throw Error('Project Node22 required');
 require('./verify.cjs').verify();
 const state=JSON.parse(fs.readFileSync(path.join(repo,'../native-status-private.json'),'utf8'));
 const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://carfact-local-build.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:state.env.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:'',CARFACT_LOCAL_SANDBOX:'0',NEXT_PUBLIC_LOCAL_SANDBOX:'0',NEXT_PUBLIC_SITE_URL:'https://carfact.kr',APP_URL:'https://carfact.kr',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--require='+JSON.stringify(path.join(__dirname,'build-guard.cjs'))};
 delete env.VERCEL_ENV;delete env.NODE_ENV;
 const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 const result=spawnSync(process.execPath,[npm,'run','build'],{cwd:repo,env,stdio:'inherit',windowsHide:true});process.exitCode=result.status??1;
}catch{console.error('Local-only normal build refused; configuration details suppressed.');process.exitCode=1}
