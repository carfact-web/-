/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node validation worker. */
const {parentPort}=require('node:worker_threads');const {PDFDocument}=require('pdf-lib');
console.warn=()=>{};
parentPort.once('message',async({bytes,maxPages})=>{
 const start=performance.now();
 try{
  const data=new Uint8Array(bytes);
  if(Buffer.from(data.subarray(0,5)).toString()!=='%PDF-'||!Buffer.from(data.subarray(Math.max(0,data.length-2048))).includes(Buffer.from('%%EOF')))throw Error('CORRUPT');
  const doc=await PDFDocument.load(data,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true});
  if(doc.isEncrypted)throw Error('ENCRYPTED');
  const count=doc.getPageCount();if(count<1||count>maxPages)throw Error('PAGES');
  const sizes=doc.getPages().map(page=>{const media=page.getMediaBox(),crop=page.getCropBox();let width=Math.min(media.x+media.width,crop.x+crop.width)-Math.max(media.x,crop.x),height=Math.min(media.y+media.height,crop.y+crop.height)-Math.max(media.y,crop.y);if(width<=0||height<=0)({width,height}=media);if(Math.abs(page.getRotation().angle)%180===90)[width,height]=[height,width];if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>14400||height>14400||Math.max(width/height,height/width)>20)throw Error('DIMENSIONS');return{width,height};});
  parentPort.postMessage({ok:true,count,sizes,elapsedMs:Math.round(performance.now()-start),heapBytes:process.memoryUsage().heapUsed});
 }catch(e){const code=/encrypt/i.test(e.message)?'ENCRYPTED':['PAGES','DIMENSIONS'].includes(e.message)?e.message:'CORRUPT';parentPort.postMessage({ok:false,code});}
});
