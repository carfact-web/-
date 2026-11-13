/* eslint-disable @typescript-eslint/no-require-imports -- Production-only artifact staging. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const{verify}=require('./verify-artifact.cjs');
const source=path.resolve(process.argv[2]||''),manifest=JSON.parse(fs.readFileSync(path.join(source,'production-source-manifest.json'),'utf8'));
if(manifest.sourceDirty&&!process.argv.includes('--allow-dirty-for-verification'))throw Error('Dirty verification source is not a release.');
for(const entry of manifest.files){if(crypto.createHash('sha256').update(fs.readFileSync(path.join(source,entry.path))).digest('hex')!==entry.sha256)throw Error('Source changed after export');}
const artifact=path.join(source,'.next/standalone');if(!fs.existsSync(path.join(artifact,'server.js')))throw Error('Build standalone output first');
fs.cpSync(path.join(source,'.next/static'),path.join(artifact,'.next/static'),{recursive:true});fs.cpSync(path.join(source,'public'),path.join(artifact,'public'),{recursive:true});
const next=JSON.parse(fs.readFileSync(path.join(source,'node_modules/next/package.json'))),sharp=JSON.parse(fs.readFileSync(path.join(source,'node_modules/sharp/package.json')));
fs.writeFileSync(path.join(artifact,'production-release-manifest.json'),JSON.stringify({sourceCommit:manifest.sourceCommit,sourceDirty:manifest.sourceDirty,platform:process.platform,arch:process.arch,node:process.version,next:next.version,sharp:sharp.version,sourceManifestSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(source,'production-source-manifest.json'))).digest('hex')},null,2)+'\n');
console.log('PASS standalone staged with public/static and provenance; files',verify(artifact));
