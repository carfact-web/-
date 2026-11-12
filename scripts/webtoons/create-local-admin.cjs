/* eslint-disable @typescript-eslint/no-require-imports -- Guarded local-only account provisioning. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..'),work=path.dirname(repo);require(path.join(repo,'scripts/local-sandbox/verify.cjs')).verify();
const {Client}=require(path.join(work,'supabase-tools/node_modules/pg')),{createClient}=require(path.join(repo,'node_modules/@supabase/supabase-js'));
(async()=>{
 const env=JSON.parse(fs.readFileSync(path.join(work,'native-status-private.json'))).env;
 const admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const file=path.join(work,'webtoon-admin-account.json'),saved=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null;
 const email=saved?.email||'webtoon-admin@carfact.local',password=saved?.password||crypto.randomBytes(20).toString('base64url');
 const result=saved?await admin.auth.admin.getUserById(saved.userId):await admin.auth.admin.createUser({email,password,email_confirm:true});
 if(result.error||!result.data.user)throw Error('Local account unavailable');
 const db=new Client({connectionString:env.DB_URL});await db.connect();
 try{await db.query("update public.user_profiles set role='admin',nickname='웹툰 테스트 관리자' where id=$1",[result.data.user.id]);}finally{await db.end();}
 fs.writeFileSync(file,JSON.stringify({email,password,userId:result.data.user.id}),{mode:0o600});
 console.log('Local synthetic webtoon admin ready; credentials kept in private parent file.');
})().catch(()=>{console.error('Local admin setup failed; credential details suppressed.');process.exitCode=1});
