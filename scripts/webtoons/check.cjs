/* eslint-disable @typescript-eslint/no-require-imports -- Local integration runner uses project-local CommonJS tools. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),work=path.dirname(repo);process.chdir(work);
require(path.join(repo,'scripts/local-sandbox/verify.cjs')).verify();
const {createClient}=require(path.join(repo,'node_modules/@supabase/supabase-js'));
const sharp=require(path.join(repo,'node_modules/sharp'));
const {Client}=require(path.join(work,'supabase-tools/node_modules/pg'));
const BASE='http://127.0.0.1:3100';
(async()=>{
 const state=JSON.parse(fs.readFileSync('native-status-private.json')),env=state.env;
 const adminAccount=JSON.parse(fs.readFileSync('webtoon-admin-account.json')),userAccount=JSON.parse(fs.readFileSync('local-test-account.json'));
 const client=()=>createClient(env.API_URL,env.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const a=client(),u=client(),anon=client();
 const login=await a.auth.signInWithPassword(adminAccount);assert(!login.error);const adminToken=login.data.session.access_token;
 const userLogin=await u.auth.signInWithPassword(userAccount);assert(!userLogin.error);const userToken=userLogin.data.session.access_token;
 async function api(route,body,token=adminToken,method=body?'POST':'GET'){
  const headers={};if(token)headers.Authorization='Bearer '+token;if(body)headers['Content-Type']='application/json';
  const r=await fetch(BASE+route,{method,headers,body:body?JSON.stringify(body):undefined});const data=await r.json().catch(()=>({}));return {status:r.status,data};
 }
 const root='/api/admin/webtoons';
 assert.equal((await api(root,null,null)).status,401);
 for(const [route,method,body] of [[root,'POST',{kind:'work',title:'forbidden',isAdmin:true}],[root,'PATCH',{kind:'work'}],['/api/admin/webtoons/cleanup','POST',{workId:'x'}],['/api/admin/webtoons/upload','POST',{}]])assert.equal((await api(route,body,userToken,method)).status,403);
 assert.equal((await api(root,null,env.SERVICE_ROLE_KEY)).status,401);
 console.log('PASS server rejects anonymous, ordinary-user mutations/cleanup/uploads and service-key login');
 const stamp=Date.now();let r=await api(root,{kind:'work',title:'합성 웹툰 '+stamp});assert.equal(r.status,201);let w=r.data;
 const fixtureDir=path.join(work,'webtoon-fixtures');fs.mkdirSync(fixtureDir,{recursive:true});
 async function png(label,color){const svg=`<svg width="600" height="1000" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="1000" fill="${color}"/><rect x="35" y="35" width="530" height="930" rx="30" fill="white" opacity="0.85"/><text x="70" y="170" font-size="42">CARFACT LOCAL</text><text x="70" y="270" font-size="50">${label}</text><text x="70" y="400" font-size="26">SYNTHETIC TEST ONLY</text><circle cx="300" cy="650" r="140" fill="${color}"/></svg>`;return sharp(Buffer.from(svg)).png().toBuffer();}
 async function upload(workId,bytes,name='page.png',type='image/png',token=adminToken){const f=new FormData();f.set('workId',workId);f.set('file',new Blob([bytes],{type}),name);const r=await fetch(BASE+root+'/upload',{method:'POST',headers:{Authorization:'Bearer '+token},body:f});return{status:r.status,data:await r.json()};}
 const colors=['#ef4444','#22c55e','#3b82f6'];const assets=[];
 for(let i=0;i<3;i++){const bytes=await png('PAGE '+(i+1),colors[i]);fs.writeFileSync(path.join(fixtureDir,`page-${i+1}.png`),bytes);const result=await upload(w.id,bytes);assert.equal(result.status,201);assets.push(result.data);}
 const coverBytes=await png('COVER','#f59e0b');fs.writeFileSync(path.join(fixtureDir,'cover.png'),coverBytes);const uploadedCover=await upload(w.id,coverBytes);assert.equal(uploadedCover.status,201);const cover=uploadedCover.data;
 for(const [bytes,name,type,expected] of [[Buffer.from('<svg/>'),'bad.svg','image/svg+xml',415],[Buffer.from('not an image'),'fake.png','image/png',415],[Buffer.alloc(10*1024*1024+1),'large.png','image/png',413]])assert.equal((await upload(w.id,bytes,name,type)).status,expected);
 console.log('PASS valid synthetic images reencoded; SVG, spoofed image and oversized file rejected');
 async function saveWork(published,coverId=cover.id,version=w.version){const r=await api(root,{kind:'work',id:w.id,version,title:w.title,description:'운영 데이터가 아닌 합성 이미지로 만든 웹툰입니다.',coverAssetId:coverId,published},adminToken,'PATCH');if(r.status===200)w=r.data;return r;}
 assert.equal((await saveWork(false)).status,200);
 r=await api(root,{kind:'episode',workId:w.id,title:'첫 번째 합성 회차',number:1});assert.equal(r.status,201);let e1=r.data;
 r=await api(root,{kind:'episode',workId:w.id,title:'두 번째 합성 회차',number:2});assert.equal(r.status,201);let e2=r.data;
 async function saveEpisode(e,ids,published,version=e.version){return api(root,{kind:'episode',id:e.id,version,title:e.title,number:e.number,published,pageIds:ids},adminToken,'PATCH');}
 const order=[assets[2].id,assets[0].id,assets[1].id];r=await saveEpisode(e1,order,false);assert.equal(r.status,200);e1=r.data;
 r=await saveEpisode(e2,[assets[0].id],false);assert.equal(r.status,200);e2=r.data;
 const dbRead=await anon.from('webtoon_works').select('id').eq('id',w.id);assert.deepEqual(dbRead.data,[]);
 assert.equal((await api('/api/webtoons/works/'+w.id,null,null)).status,404);assert.equal((await api('/api/webtoons/episodes/'+e1.id,null,null)).status,404);
 assert.equal((await fetch(BASE+'/api/webtoons/media/'+assets[2].id)).status,404);
 assert.equal((await fetch(BASE+'/api/webtoons/media/'+assets[2].id,{headers:{Authorization:'Bearer '+userToken}})).status,403);
 assert.equal((await fetch(BASE+'/api/webtoons/media/'+assets[2].id,{headers:{Authorization:'Bearer '+adminToken}})).status,200);
 assert((await anon.storage.from('webtoon-private').download(assets[0].object_key)).error);
 assert((await u.storage.from('webtoon-private').download(assets[0].object_key)).error);
 assert((await u.storage.from('webtoon-private').createSignedUrl(assets[0].object_key,60)).error);
 assert((await u.from('webtoon_works').insert({title:'forbidden'})).error);
 assert((await u.from('webtoon_works').update({published:true}).eq('id',w.id)).error);
 assert((await u.from('webtoon_works').delete().eq('id',w.id)).error);
 assert((await u.rpc('webtoon_save_work',{p_id:w.id,p_version:w.version,p_title:'forged',p_description:'',p_cover:cover.id,p_published:true})).error);
 console.log('PASS private work/episode/image hidden; admin preview works; direct REST/Storage/signing/RPC attacks blocked');
 assert.equal((await saveWork(true)).status,200);
 r=await api('/api/webtoons/works/'+w.id,null,null);assert.equal(r.status,200);assert.equal(r.data.episodes.length,0);
 assert.equal((await fetch(BASE+'/api/webtoons/media/'+cover.id)).status,200);assert.equal((await fetch(BASE+'/api/webtoons/media/'+assets[2].id)).status,404);
 r=await saveEpisode(e1,order,true);assert.equal(r.status,200);e1=r.data;
 const stale=await saveEpisode(e1,[assets[0].id],true,e1.version-1);assert.equal(stale.status,409);
 assert.equal((await saveEpisode(e1,[assets[0].id,assets[0].id],true)).status,400);
 const other=await api(root,{kind:'work',title:'다른 합성 작품 '+stamp});const otherAsset=await upload(other.data.id,await png('OTHER','#666666'));assert.equal((await saveEpisode(e1,[otherAsset.data.id],true)).status,400);
 r=await api('/api/webtoons/episodes/'+e1.id,null,null);assert.equal(r.status,200);assert.deepEqual(r.data.pages.map(p=>p.id),order);
 r=await saveEpisode(e2,[assets[0].id],true);assert.equal(r.status,200);e2=r.data;
 r=await api('/api/webtoons/episodes/'+e1.id,null,null);assert.equal(r.data.nextId,e2.id);assert.equal(r.data.previousId,null);
 r=await api('/api/webtoons/episodes/'+e2.id,null,null);assert.equal(r.data.previousId,e1.id);
 console.log('PASS atomic image order, existing-file reuse, publication, neighbors, conflict/duplicate/cross-work rejection');
 r=await saveEpisode(e1,order,false);assert.equal(r.status,200);e1=r.data;
 let image=await fetch(BASE+'/api/webtoons/media/'+assets[2].id);assert.equal(image.status,404);assert(image.headers.get('cache-control').includes('no-store'));
 assert.equal((await fetch(BASE+'/api/webtoons/media/'+assets[0].id)).status,200); // Reused by still-public episode 2.
 assert.equal((await saveWork(false)).status,200);assert.equal((await api('/api/webtoons/episodes/'+e2.id,null,null)).status,404);assert.equal((await fetch(BASE+'/api/webtoons/media/'+assets[0].id)).status,404);
 assert.equal((await saveWork(true)).status,200);r=await saveEpisode(e1,order,true);assert.equal(r.status,200);e1=r.data;
 console.log('PASS unpublish immediately blocks old public API/image URLs without breaking another episode reuse');
 const orphan=await upload(w.id,await png('ORPHAN','#999999'));assert.equal(orphan.status,201);
 const fresh=await upload(w.id,await png('FRESH','#eeeeee'));assert.equal(fresh.status,201);
 const pg=new Client({connectionString:env.DB_URL});await pg.connect();await pg.query("update public.webtoon_assets set created_at=now()-interval '2 days' where id=any($1::uuid[])",[[orphan.data.id,assets[0].id,cover.id]]);
 r=await api(root+'/cleanup',{workId:w.id});assert.equal(r.status,200);assert.equal(r.data.removed,1);
 const service=createClient(env.API_URL,env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 assert((await service.storage.from('webtoon-private').download(orphan.data.object_key)).error);
 assert(!(await service.storage.from('webtoon-private').download(assets[0].object_key)).error);
 assert(!(await service.from('webtoon_assets').select('id').eq('id',fresh.data.id).single()).error);
 await pg.end();console.log('PASS orphan GC deletes only old detached files, preserves referenced and recent files');
 fs.writeFileSync('webtoon-test-state.json',JSON.stringify({workId:w.id,title:w.title,episode1:e1.id,episode2:e2.id,order,coverId:cover.id}),{mode:0o600});
 console.log('PASS webtoon integration suite complete; synthetic demo remains published locally');
})().catch(e=>{console.error('FAILED webtoon integration:',e.code||e.name,e.message?.split('\n')[0]);process.exitCode=1});
