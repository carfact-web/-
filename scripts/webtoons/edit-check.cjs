/* eslint-disable @typescript-eslint/no-require-imports -- Local-only integration fixture; no production access. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID,createHash}=require('node:crypto');
const repo=path.resolve(__dirname,'../..'),work=path.dirname(repo);require('../local-sandbox/verify.cjs').verify();
const {createClient}=require('@supabase/supabase-js'),sharp=require('sharp'),{PDFDocument}=require('pdf-lib'),{Client}=require(path.join(work,'supabase-tools/node_modules/pg'));
const env=JSON.parse(fs.readFileSync(path.join(work,'native-status-private.json'))).env,base='http://127.0.0.1:3100',ep='/api/admin/webtoons/drafts';let c;
(async()=>{
 c=new Client({connectionString:env.DB_URL});await c.connect();
 const tables=['webtoon_works','webtoon_episodes','webtoon_assets','webtoon_episode_pages'],before={};for(const t of tables)before[t]=(await c.query('select * from public.'+t)).rows;
 async function token(file){const s=createClient(env.API_URL,env.ANON_KEY,{auth:{persistSession:false}}),a=JSON.parse(fs.readFileSync(path.join(work,file))),r=await s.auth.signInWithPassword(a);assert(!r.error);return r.data.session.access_token;}
 const admin=await token('webtoon-admin-account.json'),normal=await token('local-test-account.json');
 async function api(method,body,credential=admin,origin=base){const r=await fetch(base+ep,{method,headers:{Authorization:'Bearer '+credential,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
 async function create(editId){const r=await api('POST',{id:randomUUID(),...(editId?{episodeId:editId}:{})});assert.equal(r.status,200);return r.data;}
 async function save(d,data){const r=await api('PATCH',{id:d.id,version:d.version,data});assert.equal(r.status,200);return r.data;}
 async function commit(d,title,overrides={}){const v=d.data;return api('PATCH',{id:d.id,version:d.version,publish:true,title,published:v.published??true,popup:v.popup,message:v.message,startsAt:v.startsAt,endsAt:v.endsAt,...overrides});}
 async function pdf(label){const d=await PDFDocument.create();d.addPage([300,500]).drawText('LOCAL synthetic '+label);d.addPage([300,500]).drawText('Second '+label);return Buffer.from(await d.save());}
 async function upload(d,bytes,type,id=randomUUID()){const form=new FormData();form.set('workId',d.work_id);form.set('file',new Blob([bytes],{type}),type==='application/pdf'?'synthetic.pdf':'synthetic.png');const r=await fetch(base+'/api/admin/webtoons/'+(type==='application/pdf'?'pdf-upload':'upload'),{method:'POST',headers:{Authorization:'Bearer '+admin,'X-Upload-Id':id},body:form});return {status:r.status,data:await r.json()};}
 const image=await sharp({create:{width:400,height:800,channels:3,background:'#6c83ad'}}).png().toBuffer();
 function job(asset,type){return {id:asset.id,name:'local fixture',size:asset.bytes,sha256:createHash('sha256').update(asset.id).digest('hex'),type,asset};}
 async function state(id){return (await c.query('select * from public.webtoon_episodes where id=$1',[id])).rows[0];}
 async function promo(){return (await c.query('select * from public.webtoon_promotion where id=1')).rows[0];}
 let d=await create(),a=(await upload(d,await pdf('original'),'application/pdf')).data,cover=(await upload(d,image,'image/png')).data;
 d=await save(d,{jobs:[job(a,'application/pdf')],pageIds:[],pdfAssetId:a.id,coverAssetId:cover.id,coverUploadId:cover.id,title:'LOCAL editable fixture',popup:true,message:'LOCAL fixture popup',startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString()});
 const settings=await promo();assert.equal((await commit(d,'LOCAL editable fixture',{promotionVersion:settings.version})).status,200);
 const episodeId=d.episode_id,initial=await state(episodeId),initialPromo=await promo();
 d=await create(episodeId);assert.equal(d.data.title,'LOCAL editable fixture');assert.equal(d.data.pdfAssetId,a.id);assert(d.data.popup);
 d=await save(d,{...d.data,title:'LOCAL title only'});assert.equal((await commit(d,'LOCAL title only')).status,200);
 assert.equal((await state(episodeId)).pdf_asset_id,a.id);assert.equal(+(await state(episodeId)).published_at,+initial.published_at);assert.equal((await promo()).version,initialPromo.version);
 d=await create(episodeId);const cover2=(await upload(d,await sharp(image).tint('#cd6c77').png().toBuffer(),'image/png')).data;
 d=await save(d,{...d.data,coverAssetId:cover2.id});assert.equal((await commit(d,'LOCAL cover edited')).status,200);assert.equal((await state(episodeId)).cover_asset_id,cover2.id);assert.equal((await promo()).version,initialPromo.version);
 d=await create(episodeId);const stable=await state(episodeId),bad=await upload(d,Buffer.from('not a pdf'),'application/pdf');assert.equal(bad.status,422);assert.deepEqual(await state(episodeId),stable);
 const newId=randomUUID(),replacement=(await upload(d,await pdf('replacement'),'application/pdf',newId)).data;assert.equal((await upload(d,await pdf('replacement'),'application/pdf',newId)).data.id,newId);
 d=await save(d,{...d.data,jobs:[job(replacement,'application/pdf')],pdfAssetId:replacement.id,pageIds:[]});assert.deepEqual(await state(episodeId),stable);assert.equal((await fetch(base+'/api/webtoons/media/'+newId)).status,404);
 assert.equal((await commit(d,'LOCAL PDF replaced')).status,200);assert.equal((await state(episodeId)).pdf_asset_id,newId);assert.equal((await promo()).version,initialPromo.version);
 d=await create(episodeId);const cancelled=(await upload(d,await pdf('cancelled'),'application/pdf')).data;d=await save(d,{...d.data,jobs:[job(cancelled,'application/pdf')],pdfAssetId:cancelled.id,pageIds:[]});assert.equal((await api('DELETE',{id:d.id})).status,200);assert.equal((await state(episodeId)).pdf_asset_id,newId);assert.equal((await c.query('select count(*) from public.webtoon_assets where id=$1',[cancelled.id])).rows[0].count,'0');assert.equal((await c.query('select count(*) from public.webtoon_assets where id=$1',[newId])).rows[0].count,'1');
 d=await create(episodeId);const images=[(await upload(d,image,'image/png')).data,(await upload(d,await sharp(image).flip().tint('#229977').png().toBuffer(),'image/png')).data];
 d=await save(d,{...d.data,jobs:images.map(a=>job(a,'image/webp')),pdfAssetId:null,pageIds:images.map(a=>a.id)});assert.equal((await commit(d,'LOCAL images')).status,200);
 d=await create(episodeId);d=await save(d,{...d.data,jobs:[...d.data.jobs].reverse(),pageIds:[...d.data.pageIds].reverse()});assert.equal((await commit(d,'LOCAL reordered')).status,200);assert.deepEqual((await c.query('select asset_id from public.webtoon_episode_pages where episode_id=$1 order by position',[episodeId])).rows.map(p=>p.asset_id),[images[1].id,images[0].id]);assert.equal((await promo()).version,initialPromo.version);
 d=await create(episodeId);d=await save(d,{...d.data,published:false,popup:false});assert.equal((await commit(d,'LOCAL private')).status,200);assert.equal((await fetch(base+'/api/webtoons/media/'+images[1].id)).status,404);assert(!(await promo()).enabled);
 const disabledVersion=(await promo()).version;d=await create(episodeId);d=await save(d,{...d.data,published:true,popup:false});assert.equal((await commit(d,'LOCAL public again')).status,200);assert.equal(+(await state(episodeId)).published_at,+initial.published_at);assert.equal((await promo()).version,disabledVersion);
 const other=await create(episodeId);d=await create(episodeId);assert.equal((await commit(d,'LOCAL conflict winner')).status,200);assert.equal((await commit(other,'LOCAL conflict loser')).status,409);await api('DELETE',{id:other.id});
 assert.equal((await api('POST',{id:randomUUID(),episodeId},normal)).status,403);assert.equal((await api('POST',{id:randomUUID(),episodeId},'')).status,401);assert.equal((await api('POST',{id:randomUUID(),episodeId},admin,'https://outside.invalid')).status,403);
 assert.equal((await fetch(base+'/api/webtoons/media/'+images[1].id)).status,200);
 for(const t of tables){const rows=(await c.query('select * from public.'+t)).rows;for(const row of before[t])assert(rows.some(r=>JSON.stringify(r)===JSON.stringify(row)),'Unrelated local post/file changed');}
 fs.writeFileSync(path.join(work,'webtoon-edit-test-state.json'),JSON.stringify({workId:d.work_id,episodeId,title:'LOCAL conflict winner'}),{mode:0o600});
 console.log('PASS title-only/cover/PDF replacement/image order, private staging, failed/cancelled replacement preserves live files, stable publication date/popup version, unpublish/republish, conflict rollback, role/Origin denial, unrelated posts preserved');
})().catch(e=>{console.error('FAILED local edit check:',e.name,e.message?.slice(0,180));process.exitCode=1;}).finally(()=>c?.end());
