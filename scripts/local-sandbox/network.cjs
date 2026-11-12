/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS Node CLI/preload scripts require synchronous project-local modules. */
'use strict';
const p=require('node:path');
const repo=p.resolve(__dirname,'../..');
require(p.join(repo,'node_modules/@next/env')).loadEnvConfig(repo,true,{info(){},error(){}});
require('./verify.cjs').verify();
function allowed(url,method='GET'){
 const u=new URL(url);
 if(u.protocol==='data:')return true;
 if(['127.0.0.1','localhost','[::1]'].includes(u.hostname))return true;
 return u.protocol==='https:'&&['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname)&&['GET','HEAD'].includes(method.toUpperCase());
}
const f=globalThis.fetch;globalThis.fetch=(input,init)=>{
 const url=typeof input==='string'||input instanceof URL?String(input):input.url;
 if(!allowed(url,init?.method||input?.method||'GET'))throw Error('Local sandbox blocked external network');
 return f(input,init);
};
for(const name of ['node:http','node:https']){
 const m=require(name);
 for(const k of ['request','get']){
  const original=m[k];m[k]=function(...a){let u;const x=a[0];
   try{u=typeof x==='string'||x instanceof URL?new URL(x):new URL((x.protocol||(name==='node:https'?'https:':'http:'))+'//'+(x.hostname||x.host)+(x.path||'/'));}catch{throw Error('Local sandbox blocked network');}
   if(!allowed(u,(a[1]?.method||x.method||'GET')))throw Error('Local sandbox blocked external network');
   return original.apply(this,a);
  };
 }
}
