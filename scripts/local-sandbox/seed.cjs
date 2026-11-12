/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS Node CLI/preload scripts require synchronous project-local modules. */
const path=require('node:path');
const repo=path.resolve(__dirname,'../..');
const work=path.dirname(repo);
process.chdir(work);
const fs=require('node:fs');
const {Client}=require(path.join(work,'supabase-tools/node_modules/pg'));
const {createClient}=require(path.join(repo,'node_modules/@supabase/supabase-js'));
(async()=>{
 const state=JSON.parse(fs.readFileSync('native-status-private.json'));
 const env=state.env;
 require('./verify.cjs').assertLocalState(state,{NEXT_PUBLIC_SUPABASE_URL:env.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:env.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:env.SERVICE_ROLE_KEY,NEXT_PUBLIC_LOCAL_SANDBOX:'1',CARFACT_LOCAL_SANDBOX:'1'});
 for(const k of ['API_URL','DB_URL']){const u=new URL(env[k]);if(!['localhost','127.0.0.1'].includes(u.hostname))throw Error('Nonlocal endpoint rejected');}
 const pg=new Client({connectionString:env.DB_URL});await pg.connect();
 await pg.query(fs.readFileSync(path.join(__dirname,'security-and-fixture.sql'),'utf8'));
 const admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const saved=fs.existsSync('local-test-account.json')?JSON.parse(fs.readFileSync('local-test-account.json')):null;
 const email=saved?.email||'reviewer@carfact.local';const password=saved?.password||require('node:crypto').randomBytes(20).toString('base64url');
 let data,error;
 if(saved){const result=await admin.auth.admin.getUserById(saved.userId);data=result.data;error=result.error;}
 else {const result=await admin.auth.admin.createUser({email,password,email_confirm:true});data=result.data;error=result.error;}
 if(error||!data.user)throw error||new Error('Missing synthetic user');
 const {error:pe}=await admin.from('user_profiles').upsert({id:data.user.id,nickname:'로컬테스터',role:'user'});if(pe)throw pe;
 fs.writeFileSync('local-test-account.json',JSON.stringify({email,password,userId:data.user.id}),{mode:0o600});
 const local={NEXT_PUBLIC_SUPABASE_URL:env.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:env.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:env.SERVICE_ROLE_KEY,NEXT_PUBLIC_LOCAL_SANDBOX:'1',CARFACT_LOCAL_SANDBOX:'1'};
 const target='repo/.env.local';if(fs.existsSync(target)){const old=fs.readFileSync(target,'utf8');if(old.includes('.supabase.co')){const backup='preservation/env-public-production.reference';if(fs.existsSync(backup))throw Error('Production reference already preserved; refusing overwrite');fs.renameSync(target,backup);}}
 fs.writeFileSync(target,Object.entries(local).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{mode:0o600});
 const n=await pg.query('select count(*)::int as n from supabase_migrations.schema_migrations');console.log('PASS local schema migrations:',n.rows[0].n,'; synthetic user/vehicle created; loopback-only environment set.');
 await pg.end();
})().catch(()=>{console.error('Local seed failed; sensitive details suppressed.');process.exitCode=1});
