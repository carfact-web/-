/* eslint-disable @typescript-eslint/no-require-imports -- Deterministic source packaging CLI. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const destination=path.resolve(process.argv[2]||'');
if(!process.argv[2]||destination===root||destination.startsWith(root+path.sep)||fs.existsSync(destination))throw Error('Use a new directory outside the checkout; existing paths are never overwritten.');
const dirty=!!cp.execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
if(dirty&&!process.argv.includes('--allow-dirty-for-verification'))throw Error('Production packaging requires a clean pinned checkout.');
const files=cp.execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const top=new Set(['app','components','data','hooks','lib','public','types','utils']);
const config=new Set(['package.json','package-lock.json','next.config.ts','tsconfig.json','postcss.config.mjs','eslint.config.mjs','instrumentation.ts','instrumentation-node.ts','scripts/validate-env.mjs']);
const allowed=files.filter(p=>(top.has(p.split('/')[0])||config.has(p))&&!p.startsWith('app/local-test/')&&!p.startsWith('lib/local/'));
fs.mkdirSync(destination,{recursive:true,mode:0o700});
function replace(file,old,next){const p=path.join(destination,file);const s=fs.readFileSync(p,'utf8');if(s.split(old).length!==2)throw Error('Source boundary changed; review transform: '+file);fs.writeFileSync(p,s.replace(old,next));}
for(const file of allowed){if(/(^|\/)\.env|\.(pdf|key|pem|p12|pfx|der)$/i.test(file))throw Error('Unexpected sensitive/media input: '+file);const source=path.join(root,file);if(!fs.lstatSync(source).isFile())throw Error('Only regular tracked files allowed');fs.mkdirSync(path.dirname(path.join(destination,file)),{recursive:true});fs.copyFileSync(source,path.join(destination,file));}
const serverImport='import { isLocalSandboxServer } from "@/lib/local/sandbox.server";\n',clientImport='import { isLocalSandbox } from "@/lib/local/sandbox";\n';
replace('app/api/kotsa/vehicle-history/route.ts',serverImport,'');
replace('app/api/kotsa/vehicle-history/route.ts','import { localVehicleFixture } from "@/lib/local/vehicleFixture";\n','');
replace('app/api/kotsa/vehicle-history/route.ts','  if (isLocalSandboxServer()) return localVehicleFixture(request);\n','');
replace('app/layout.tsx',serverImport,'');replace('app/layout.tsx','import { WebtoonAdminLink } from "@/components/webtoons/WebtoonAdminLink";\n','');replace('app/layout.tsx','import Link from "next/link";\n','');
const layout=path.join(destination,'app/layout.tsx'),source=fs.readFileSync(layout,'utf8');const start=source.indexOf('        {isLocalSandboxServer() ? (');const end=source.indexOf('        ) : null}\n',start);if(start<0||end<start)throw Error('Banner boundary changed');fs.writeFileSync(layout,source.slice(0,start)+source.slice(end+'        ) : null}\n'.length));
replace('components/GoogleAnalytics.tsx',clientImport,'');replace('components/GoogleAnalytics.tsx','isLocalSandbox() || !gaMeasurementId','!gaMeasurementId');
replace('lib/indexNowClient.ts',clientImport,'');replace('lib/indexNowClient.ts','  if (isLocalSandbox()) return;\n','');
replace('components/webtoons/WebtoonAdminEditor.tsx',clientImport,'');replace('components/webtoons/WebtoonAdminEditor.tsx','isLocalSandbox() ? "/local-test" : "/login?redirectTo=/admin/webtoons"','"/login?redirectTo=/admin/webtoons"');
replace('components/webtoons/WebtoonPromotion.tsx','admin|login|auth|local-test','admin|login|auth');
replace('next.config.ts','const nextConfig: NextConfig = {','const nextConfig: NextConfig = {\n  output: "standalone",');
const manifest={schema:1,sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceDirty:dirty,files:[]};
for(const file of allowed){const content=fs.readFileSync(path.join(destination,file));if(/\.(tsx?|m?js|cjs|json)$/.test(file)&&/(?:@\/lib\/local\/|localVehicleFixture|isLocalSandbox|LOCAL_MOCK|local-synthetic-fixture|로컬 테스트 전용|테스트 로그인|\/local-test)/.test(content.toString()))throw Error('Local runtime marker survived: '+file);manifest.files.push({path:file,sha256:crypto.createHash('sha256').update(content).digest('hex')});}
fs.writeFileSync(path.join(destination,'production-source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log('PASS production source export:',allowed.length,'files; local routes/fixtures/tools/env excluded.');
