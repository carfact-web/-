/* eslint-disable @typescript-eslint/no-require-imports -- Local synthetic PDF fixture generation. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PDFDocument, rgb } = require('pdf-lib');
const work = path.resolve(__dirname, '../../..');
const fontkit = require(path.join(work, 'browser-tools/node_modules/@pdf-lib/fontkit'));
const PDFKit = require(path.join(work, 'browser-tools/node_modules/pdfkit'));
async function main() {
 const fontFile = process.argv[2] || (process.platform === 'win32' ? path.join(process.env.WINDIR || 'C:/Windows', 'Fonts/malgun.ttf') : '');
 if (!fontFile || !fs.existsSync(fontFile)) throw Error('Pass an installed Korean TTF font path.');
 const output = path.join(work, 'output/pdf'); fs.mkdirSync(output, { recursive: true });
 const fontBytes = fs.readFileSync(fontFile);
 for (const count of [30, 40, 60, 201]) {
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  for (let number = 1; number <= count; number++) {
   const page = doc.addPage([595, 842]);
   page.drawRectangle({ x: 25, y: 25, width: 545, height: 792, color: rgb(0.96, 0.97, 1) });
   page.drawText('CARFACT 한글 PDF 합성 검증', { x: 45, y: 740, size: 24, font });
   page.drawText(`${number} / ${count}`, { x: 45, y: 675, size: 42, font });
   page.drawText('운영 자료나 실제 회원정보를 사용하지 않았습니다.', { x: 45, y: 600, size: 16, font });
   page.drawText('세로 스크롤 · 확대 · 페이지 이동 · 이어보기 테스트', { x: 45, y: 550, size: 16, font });
   page.drawRectangle({ x: 70, y: 120, width: 455, height: 330, color: rgb(number % 3 / 3, 0.5, 0.7) });
  }
  fs.writeFileSync(path.join(output, `carfact-korean-${count}.pdf`), await doc.save());
  console.log(`Generated synthetic Korean PDF: ${count} pages.`);
 }
 fs.writeFileSync(path.join(output, 'carfact-damaged.pdf'), Buffer.from('%PDF-1.7\ninvalid synthetic object\n%%EOF'));
 await new Promise((resolve, reject) => {
  const doc = new PDFKit({ userPassword: crypto.randomBytes(16).toString('hex'), ownerPassword: crypto.randomBytes(16).toString('hex'), pdfVersion: '1.7' });
  const stream = fs.createWriteStream(path.join(output, 'carfact-encrypted.pdf'));
  stream.on('finish', resolve); stream.on('error', reject); doc.on('error', reject);
  doc.pipe(stream); doc.text('CARFACT synthetic encrypted PDF.'); doc.end();
 });
 console.log('Generated damaged and genuinely encrypted negative fixtures outside Git.');
}
main().catch(() => { console.error('Synthetic PDF fixture generation failed; private details suppressed.'); process.exitCode = 1; });
