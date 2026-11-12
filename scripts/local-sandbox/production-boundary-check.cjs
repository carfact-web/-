/* eslint-disable @typescript-eslint/no-require-imports -- Read-only local production-mode boundary verification. */
'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),net=require('node:net'),{spawn}=require('node:child_process');
const repo=path.resolve(__dirname,'../..');require('./verify.cjs').verify();
let child;
(async()=>{
 await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',reject);probe.listen(3101,'127.0.0.1',()=>probe.close(resolve))});
 child=spawn(process.execPath,[path.join(repo,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3101'],{cwd:repo,env:{...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--require='+JSON.stringify(path.join(__dirname,'network.cjs'))},windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Production check server did not become ready')),20000);child.once('error',reject);child.once('exit',()=>{clearTimeout(timer);reject(Error('Production check server exited'))});child.stdout.on('data',chunk=>{if(String(chunk).includes('Ready')){clearTimeout(timer);resolve()}});child.stderr.resume()});
 const r=await fetch('http://127.0.0.1:3101/',{signal:AbortSignal.timeout(10000)});assert.equal(r.status,200);const html=await r.text();assert(!html.includes('로컬 테스트 전용'));assert(!html.includes('로컬 테스트 환경 안내'));assert(!html.includes('href="/local-test"'));assert(!html.includes('③ 후기 작성'));assert(!html.includes('href="/admin/webtoons"'));
 const denied=await fetch('http://127.0.0.1:3101/admin/webtoons',{headers:{'X-Role':'admin'},signal:AbortSignal.timeout(10000)});assert.equal(denied.status,404);assert(!(await denied.text()).includes('새 작품 제목'));
 assert.equal((await fetch('http://127.0.0.1:3101/local-test?CARFACT_LOCAL_SANDBOX=1',{signal:AbortSignal.timeout(10000)})).status,404);
 console.log('PASS production-mode HTTP: home200 without local banner/test/admin links; direct admin and local-test404, forged role ignored.');
})().catch(()=>{console.error('Production boundary check failed; details suppressed.');process.exitCode=1}).finally(()=>{child?.kill()});
