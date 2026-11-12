/* eslint-disable @typescript-eslint/no-require-imports -- Synchronous CommonJS preload and CLI validation. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const repo=path.resolve(__dirname,'../..');
const hostnames=new Set(['127.0.0.1','localhost','[::1]','::1']);
function localUrl(value,label){
 let u;try{u=new URL(value);}catch{throw Error('Invalid local endpoint: '+label);}
 if(!hostnames.has(u.hostname)||!['http:','https:','postgres:','postgresql:','smtp:','pop3:','tcp:'].includes(u.protocol))throw Error('Nonlocal endpoint rejected: '+label);
 if(['http:','https:'].includes(u.protocol)&&(u.username||u.password))throw Error('Unexpected endpoint credentials: '+label);
 return u;
}
function assertLocalState(state,active){
 if(state.readiness!=='ready')throw Error('Local services not ready');
 for(const key of ['API_URL','REST_URL','DB_URL','STORAGE_S3_URL'])localUrl(state.env?.[key],key);
 for(const key of ['auth.http','rest.http','storage.http','database.sql'])localUrl(state.endpoints?.[key]?.url,key);
 for(const [key,value] of Object.entries(state.env||{}))if(key.endsWith('_URL'))localUrl(value,key);
 for(const [key,value] of Object.entries(state.endpoints||{}))localUrl(value.url,key);
 const api=localUrl(active.NEXT_PUBLIC_SUPABASE_URL,'NEXT_PUBLIC_SUPABASE_URL');
 if(api.origin!==new URL(state.env.API_URL).origin)throw Error('App and local stack API differ');
 const endpointNames=/^(NEXT_PUBLIC_)?(SUPABASE|DATABASE|DIRECT|DB|AUTH|STORAGE|REST).*?(URL|URI|HOST)$/;
 for(const [key,value] of Object.entries(active))if(value&&endpointNames.test(key)){
  if(key.endsWith('HOST')){if(!hostnames.has(value))throw Error('Nonlocal host rejected: '+key);}
  else localUrl(value,key);
 }
 for(const [app,local] of [['NEXT_PUBLIC_SUPABASE_ANON_KEY','ANON_KEY'],['SUPABASE_SERVICE_ROLE_KEY','SERVICE_ROLE_KEY']]){
  if(!active[app]||active[app]!==state.env[local])throw Error('App key does not match local stack: '+app);
 }
 if(active.CARFACT_LOCAL_SANDBOX!=='1'||active.NEXT_PUBLIC_LOCAL_SANDBOX!=='1')throw Error('Both private and public local sandbox flags are required');
 return true;
}
function verify(){
 require(path.join(repo,'node_modules/@next/env')).loadEnvConfig(repo,true,{info(){},error(){}});
 const state=JSON.parse(fs.readFileSync(path.join(repo,'../native-status-private.json'),'utf8'));
 return assertLocalState(state,process.env);
}
module.exports={assertLocalState,verify};
if(require.main===module){try{verify();console.log('PASS local DB/Auth/Storage endpoints, app endpoint and keys match');}catch(e){console.error(e.message);process.exitCode=1;}}
