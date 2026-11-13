/* eslint-disable @typescript-eslint/no-require-imports -- Local-only real Auth/CSRF regression. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
require('../local-sandbox/verify.cjs').verify();
const work=path.resolve(__dirname,'../../..'),env=JSON.parse(fs.readFileSync(path.join(work,'native-status-private.json'))).env;
const{createClient}=require('@supabase/supabase-js'),base='http://127.0.0.1:3100';
(async()=>{
 const signIn=async file=>{const account=JSON.parse(fs.readFileSync(path.join(work,file))),client=createClient(env.API_URL,env.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),result=await client.auth.signInWithPassword(account);assert(!result.error,'Local test account required');return result.data.session.access_token;};
 const admin=await signIn('webtoon-admin-account.json'),user=await signIn('local-test-account.json');
 function request(host,protocol,origin,token=admin,extra={},method='POST'){
  // Node fetch replaces Host; use the HTTP transport to model the proxy faithfully.
  return new Promise((resolve,reject)=>{const req=http.request(base+'/api/admin/webtoons/session',{method,headers:{Host:host,'X-Forwarded-Proto':protocol,...(origin===undefined?{}:{Origin:origin}),...(token?{Authorization:'Bearer '+token}:{}),...extra}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const headers=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)headers.append(res.rawHeaders[i],res.rawHeaders[i+1]);resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers}));});});req.on('error',reject);req.end();});
 }
 for(const [host,proto,origin] of [['carfact.kr','https','https://carfact.kr'],['www.carfact.kr','https','https://www.carfact.kr'],['carfact.kr:443','https','https://carfact.kr'],['carfact.kr:8443','https','https://carfact.kr:8443'],['carfact.kr','http','http://carfact.kr'],['127.0.0.1:3100','http',base]]){
  const response=await request(host,proto,origin);assert.equal(response.status,200,'Same public origin with default/explicit port');assert.equal(response.headers.get('location'),null);const cookie=response.headers.get('set-cookie');assert(cookie.includes('HttpOnly')&&cookie.includes('SameSite=strict')&&cookie.includes('Path=/admin/webtoons')&&cookie.includes('Max-Age=300'));
  assert.equal((await fetch(base+'/admin/webtoons',{headers:{Cookie:cookie.split(';')[0]},redirect:'manual'})).status,200,'Real local administrator page authorization');
 }
 for(const [host,origin,extra] of [['carfact.kr','https://www.carfact.kr',{}],['www.carfact.kr','https://carfact.kr',{}],['carfact.kr','https://outside.invalid',{}],['carfact.kr',undefined,{}],['carfact.kr','null',{}],['carfact.kr','https://outside.invalid',{'X-Forwarded-Host':'outside.invalid'}],['carfact.kr','https://carfact.kr:3100',{}],['carfact.kr',undefined,{Referer:'https://carfact.kr/admin'}],['carfact.kr','https://outside.invalid',{Referer:'https://carfact.kr/admin'}]]){
  const response=await request(host,'https',origin,admin,extra);assert.equal(response.status,403,'Cross-origin/missing Origin must be denied');assert.equal(response.headers.get('set-cookie'),null);
 }
 assert.equal((await request('carfact.kr','https','https://carfact.kr',user)).status,403,'Ordinary user denied');assert.equal((await request('carfact.kr','https','https://carfact.kr',null)).status,401,'Anonymous denied');assert.equal((await request('carfact.kr','https','https://carfact.kr',env.SERVICE_ROLE_KEY)).status,401,'Service credential is not a human admin');
 assert.equal((await request('carfact.kr','https','https://outside.invalid',null,{},'DELETE')).status,403,'Logout CSRF denied');assert.equal((await request('carfact.kr','https','https://carfact.kr',null,{},'DELETE')).status,200,'Same-origin cookie clearing preserved');
 console.log('PASS real local admin session/page: proxied portless hosts, www exact match, default/custom/local ports; external/missing/null/alias/forwarded-host spoof denied; ordinary/anonymous/service denied; strict cookie unchanged');
})().catch(e=>{console.error('Session origin regression failed:',e.name,e.message);process.exitCode=1;});
