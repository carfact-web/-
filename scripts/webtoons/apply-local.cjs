/* eslint-disable @typescript-eslint/no-require-imports -- Explicitly local-only migration runner. */
const path=require('node:path'),fs=require('node:fs');
const repo=path.resolve(__dirname,'../..'),work=path.dirname(repo);
require(path.join(repo,'scripts/local-sandbox/verify.cjs')).verify();
const {Client}=require(path.join(work,'supabase-tools/node_modules/pg'));
(async()=>{
 const env=JSON.parse(fs.readFileSync(path.join(work,'native-status-private.json'))).env;
 const db=new Client({connectionString:env.DB_URL});await db.connect();
 try {
  for (const [version,name] of [['20261112090000','add_webtoon_publishing'],['20261112100000','add_webtoon_pdf']]) {
   const applied=await db.query('select 1 from supabase_migrations.schema_migrations where version=$1',[version]);
   if(applied.rowCount){console.log('Local migration already applied:',version);continue;}
   const sql=fs.readFileSync(path.join(repo,'supabase/migrations/'+version+'_'+name+'.sql'),'utf8').replace(/\nbegin;\n/,'\n').replace(/\ncommit;\s*$/,'\n');
   await db.query('begin');await db.query(sql);await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,name,[]]);await db.query('commit');
   console.log('Applied to verified local database only:',version);
  }
 }catch(e){await db.query('rollback');throw e;}finally{await db.end();}
})().catch(e=>{console.error('Local migration failed:',e.code||e.name);process.exitCode=1});
