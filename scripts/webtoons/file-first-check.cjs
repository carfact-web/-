/* eslint-disable @typescript-eslint/no-require-imports -- Local sandbox integration runner. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID,createHash}=require('node:crypto');
const repo=path.resolve(__dirname,'../..'),work=path.dirname(repo);
require('../local-sandbox/verify.cjs').verify();
const {createClient}=require('@supabase/supabase-js'),sharp=require('sharp');
const env=JSON.parse(fs.readFileSync(path.join(work,'native-status-private.json'))).env;
const base='http://127.0.0.1:3100',endpoint='/api/admin/webtoons/drafts';
async function login(name){const client=createClient(env.API_URL,env.ANON_KEY,{auth:{persistSession:false}}),account=JSON.parse(fs.readFileSync(path.join(work,name)));const result=await client.auth.signInWithPassword(account);assert(!result.error);return result.data.session.access_token;}
(async()=>{
 const admin=await login('webtoon-admin-account.json'),ordinary=await login('local-test-account.json');
 async function request(method,body,token=admin,origin=base){const r=await fetch(base+endpoint,{method,headers:{Authorization:'Bearer '+token,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
 const id=randomUUID();let response=await request('POST',{id});assert.equal(response.status,200);const draft=response.data;
 assert.equal((await request('POST',{id})).data.episode_id,draft.episode_id);
 assert.equal((await request('POST',{id:randomUUID()},ordinary)).status,403);
 assert.equal((await request('POST',{id:randomUUID()},'')).status,401);
 assert.equal((await request('POST',{id:randomUUID()},admin,'https://outside.invalid')).status,403);
 assert.equal((await request('PATCH',{id,version:draft.version,publish:true,title:'LOCAL incomplete',popup:false})).status,400);
 const bytes=await sharp({create:{width:400,height:800,channels:3,background:'#4e73a1'}}).png().toBuffer(),assetId=randomUUID();
 async function upload(){const form=new FormData();form.set('workId',draft.work_id);form.set('file',new Blob([bytes],{type:'image/png'}),'local-check.png');const r=await fetch(base+'/api/admin/webtoons/upload',{method:'POST',headers:{Authorization:'Bearer '+admin,'X-Upload-Id':assetId},body:form});assert(r.ok);return r.json();}
 const asset=await upload();assert.equal((await upload()).id,asset.id);
 assert.equal((await fetch(base+'/api/webtoons/media/'+assetId)).status,404);
 const data={jobs:[{id:assetId,name:'local-check.png',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),type:'image/png',asset}],pageIds:[assetId],pdfAssetId:null,coverAssetId:null,coverUploadId:randomUUID(),title:'',popup:false,message:'',startsAt:'',endsAt:'',ready:true};
 response=await request('PATCH',{id,version:draft.version,data});assert.equal(response.status,200);assert.equal(response.data.data.ready,false);
 assert.equal((await request('PATCH',{id,version:response.data.version,publish:true,title:'',popup:false})).status,400);
 response=await request('DELETE',{id});assert.equal(response.status,200);
 assert.equal((await fetch(base+'/api/webtoons/media/'+assetId,{headers:{Authorization:'Bearer '+admin}})).status,404);
 assert.equal((await request('DELETE',{id})).status,200);
 console.log('PASS idempotent creation/upload, incomplete/title publication guards, anonymous/nonadmin/external-origin denial, private media and repeatable cancellation cleanup');
})().catch(e=>{console.error('FAILED local file-first integration:',e.name);process.exitCode=1;});
