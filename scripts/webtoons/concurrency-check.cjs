/* eslint-disable @typescript-eslint/no-require-imports -- Verified local concurrency regression test. */
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),work=path.dirname(repo);require(path.join(repo,'scripts/local-sandbox/verify.cjs')).verify();
const{Client}=require(path.join(work,'supabase-tools/node_modules/pg')),{createClient}=require(path.join(repo,'node_modules/@supabase/supabase-js'));
(async()=>{
 const env=JSON.parse(fs.readFileSync(path.join(work,'native-status-private.json'))).env;
 const c=createClient(env.API_URL,env.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),login=await c.auth.signInWithPassword(JSON.parse(fs.readFileSync(path.join(work,'webtoon-admin-account.json'))));assert(!login.error);const token=login.data.session.access_token;
 async function api(body,method='POST',suffix=''){const r=await fetch('http://127.0.0.1:3100/api/admin/webtoons'+suffix,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:r.status,data:await r.json()};}
 const w=await api({kind:'work',title:'동시 정리 검증 '+Date.now()});assert.equal(w.status,201);
 const form=new FormData();form.set('workId',w.data.id);form.set('file',new Blob([fs.readFileSync(path.join(work,'webtoon-fixtures/page-1.png'))],{type:'image/png'}),'page.png');
 const uploaded=await fetch('http://127.0.0.1:3100/api/admin/webtoons/upload',{method:'POST',headers:{Authorization:'Bearer '+token},body:form});assert.equal(uploaded.status,201);const asset=await uploaded.json();
 const e=await api({kind:'episode',workId:w.data.id,title:'동시 편집 회차',number:1});assert.equal(e.status,201);
 const blocker=new Client({connectionString:env.DB_URL}),observer=new Client({connectionString:env.DB_URL});await blocker.connect();await observer.connect();
 try {
  await observer.query("update public.webtoon_assets set created_at=now()-interval '2 days' where id=$1",[asset.id]);
  await blocker.query('begin');await blocker.query('select pg_advisory_xact_lock(hashtextextended($1::text,928341))',[w.data.id]);
  const attaching=api({kind:'episode',id:e.data.id,version:e.data.version,title:e.data.title,number:1,published:false,pageIds:[asset.id]},'PATCH');
  async function waiting(name){for(let i=0;i<100;i++){const r=await observer.query("select count(*)::int n from pg_stat_activity where wait_event_type='Lock' and lower(wait_event)='advisory' and query like $1",['%'+name+'%']);if(r.rows[0].n>0)return;await new Promise(r=>setTimeout(r,30));}throw Error('Expected lock wait not observed');}
  await waiting('webtoon_save_episode');
  const cleaning=api({workId:w.data.id},'POST','/cleanup');await waiting('webtoon_claim_orphans');
  await blocker.query('commit');const [saved,cleaned]=await Promise.all([attaching,cleaning]);assert.equal(saved.status,200);assert.equal(cleaned.status,200);assert.equal(cleaned.data.removed,0);
  const row=await observer.query('select state from public.webtoon_assets where id=$1',[asset.id]);assert.equal(row.rows[0].state,'ready');
  const service=createClient(env.API_URL,env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});assert(!(await service.storage.from('webtoon-private').download(asset.object_key)).error);
  console.log('PASS concurrent attachment wins before GC; newly referenced file remains ready and downloadable');
 }finally{await blocker.query('rollback').catch(()=>{});await blocker.end();await observer.end();}
})().catch(e=>{console.error('FAILED concurrency test:',e.code||e.name,e.message?.split('\n')[0]);process.exitCode=1});
