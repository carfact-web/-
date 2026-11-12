/* eslint-disable @typescript-eslint/no-require-imports -- Local CommonJS verification CLI. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const repo=path.resolve(__dirname,'../..');
const {assertLocalState,verify}=require('./verify.cjs');verify();
const state=JSON.parse(fs.readFileSync(path.join(repo,'../native-status-private.json')));
const active={...process.env};
function reject(change,label){const s=structuredClone(state),a={...active};change(s,a);assert.throws(()=>assertLocalState(s,a));console.log('PASS rejected '+label);}
reject((s)=>{s.endpoints['auth.http'].url='https://example.supabase.co/auth/v1';},'mixed Auth endpoint');
reject((s)=>{s.endpoints['storage.http'].url='https://example.supabase.co/storage/v1';},'mixed Storage endpoint');
reject((s)=>{s.env.DB_URL='postgresql://example.com/postgres';},'mixed database endpoint');
reject((s,a)=>{a.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';},'hosted app endpoint');
reject((s,a)=>{a.SUPABASE_AUTH_URL='https://example.supabase.co/auth/v1';},'inherited Auth override');
reject((s,a)=>{a.SUPABASE_SERVICE_ROLE_KEY='wrong-local-key';},'mixed server key');
reject((s,a)=>{a.NEXT_PUBLIC_SUPABASE_ANON_KEY='wrong-local-key';},'mixed browser key');
reject((s,a)=>{delete a.CARFACT_LOCAL_SANDBOX;},'missing private flag');
const publicSource=fs.readFileSync(path.join(repo,'lib/local/sandbox.ts'),'utf8').replace('export function','function');
const privateSource=fs.readFileSync(path.join(repo,'lib/local/sandbox.server.ts'),'utf8').replace(/\r\n/g,'\n').replace(/^import .*;\n/gm,'').replace('export function','function');
for(const [node,flag,server,url,expected] of [['development','1','1','http://127.0.0.1:54321',true],['production','1','1','http://127.0.0.1:54321',false],['development','1','0','http://127.0.0.1:54321',false],['development','1','1','https://example.supabase.co',false]]){
 const env={NODE_ENV:node,NEXT_PUBLIC_LOCAL_SANDBOX:flag,CARFACT_LOCAL_SANDBOX:server,NEXT_PUBLIC_SUPABASE_URL:url};
 assert.equal(vm.runInNewContext(publicSource+'\n'+privateSource+'\nisLocalSandboxServer()',{URL,process:{env}}),expected);
}
console.log('PASS server gate requires private flag + development + public flag + loopback');
