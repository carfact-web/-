/* eslint-disable @typescript-eslint/no-require-imports -- Restricted build process network preload. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const repo=path.resolve(__dirname,'../..'),state=JSON.parse(fs.readFileSync(path.join(repo,'../native-status-private.json'),'utf8'));
const alias='https://carfact-local-build.supabase.co';
require('./verify.cjs').assertLocalState(state,{NEXT_PUBLIC_SUPABASE_URL:state.env.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:state.env.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:state.env.SERVICE_ROLE_KEY,NEXT_PUBLIC_LOCAL_SANDBOX:'1',CARFACT_LOCAL_SANDBOX:'1'});
if(process.env.NEXT_PUBLIC_SUPABASE_URL!==alias||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!==state.env.ANON_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY!==''||process.env.NEXT_PUBLIC_LOCAL_SANDBOX!=='0'||process.env.CARFACT_LOCAL_SANDBOX!=='0'||process.env.VERCEL_ENV==='preview')throw Error('Unexpected local build configuration');
function checked(url,method){const u=new URL(url);if(!['GET','HEAD'].includes(method.toUpperCase()))throw Error('Build writes denied');if(u.protocol==='https:'&&['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname))return u;if(['127.0.0.1','localhost','[::1]'].includes(u.hostname))return u;throw Error('Build external network denied');}
const original=globalThis.fetch;
globalThis.fetch=(input,init)=>{
 const u=new URL(typeof input==='string'||input instanceof URL?String(input):input.url),method=init?.method||(input instanceof Request?input.method:'GET');
 if(u.origin===alias){if(method!=='GET'||!/^\/rest\/v1\/(vehicles|reviews|community_posts)$/.test(u.pathname)||u.searchParams.get('limit')!=='5000')throw Error('Only existing sitemap SELECTs allowed');const local=new URL(u.pathname+u.search,state.env.API_URL);console.log('Local build sitemap SELECT:',u.pathname.split('/').pop());return original(input instanceof Request?new Request(local,input):local,init);}
 checked(u,method);return original(input,init);
};
for(const name of ['node:http','node:https']){const lib=require(name);for(const key of ['request','get']){const request=lib[key];lib[key]=function(...args){const x=args[0];const u=typeof x==='string'||x instanceof URL?new URL(x):new URL((x.protocol||(name==='node:https'?'https:':'http:'))+'//'+(x.hostname||x.host)+(x.path||'/'));checked(u,args[1]?.method||x.method||'GET');return request.apply(this,args)}}}
