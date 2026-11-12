/* eslint-disable @typescript-eslint/no-require-imports -- Local browser integration runner. */
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),work=path.dirname(repo);process.chdir(work);
require(path.join(repo,'scripts/local-sandbox/verify.cjs')).verify();
const {chromium}=require(path.join(work,'browser-tools/node_modules/playwright-core'));
let runningBrowser;
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});runningBrowser=browser;
 async function context(viewport){const c=await browser.newContext({viewport,serviceWorkers:'block'});await c.route('**/*',r=>{const u=new URL(r.request().url());return ['http:','https:'].includes(u.protocol)&&!['127.0.0.1','localhost'].includes(u.hostname)?r.abort():r.continue();});return c;}
 async function login(page,file){const account=JSON.parse(fs.readFileSync(file));await page.goto('http://127.0.0.1:3100/local-test');await page.getByLabel('테스트 이메일').fill(account.email);await page.getByLabel('테스트 비밀번호').fill(account.password);await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('status').filter({hasText:'로컬 로그인 완료'}).waitFor();}
 const ctx=await context({width:1360,height:1000});const page=await ctx.newPage();page.setDefaultTimeout(25000);const errors=[];page.on('pageerror',()=>errors.push('page-error'));
 await login(page,'webtoon-admin-account.json');await page.goto('http://127.0.0.1:3100/admin/webtoons');await page.getByRole('heading',{name:'웹툰 작품·회차 관리',exact:true}).waitFor();
 const title='브라우저 합성 웹툰 '+Date.now();await page.getByLabel('새 작품 제목',{exact:true}).fill(title);await page.getByRole('button',{name:'작품 만들기',exact:true}).click();await page.getByLabel('작품 제목',{exact:true}).waitFor();const workId=await page.getByLabel('작품 선택',{exact:true}).inputValue();
 await page.getByLabel('작품 소개',{exact:true}).fill('합성 이미지로만 검증하는 로컬 웹툰입니다. 실제 작품이나 운영 데이터가 아닙니다.');
 await page.getByLabel('표지 이미지 선택',{exact:true}).setInputFiles('webtoon-fixtures/cover.png');await page.getByRole('button',{name:'표지 업로드',exact:true}).click();await page.getByAltText('작품 표지 미리보기',{exact:true}).waitFor();await page.getByRole('button',{name:'작품 저장',exact:true}).click();await page.getByRole('status').filter({hasText:'작품을 저장했습니다.'}).waitFor();
 await page.getByLabel('새 회차 제목',{exact:true}).fill('브라우저 업로드 검증 회차');await page.getByRole('button',{name:'회차 만들기',exact:true}).click();await page.getByLabel('회차 제목',{exact:true}).waitFor();const episodeId=await page.getByLabel('회차 선택',{exact:true}).inputValue();
 let injected=false;await page.route('**/api/admin/webtoons/upload',async r=>{if(!injected){injected=true;return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'검증용 일시 오류: 다시 시도해주세요.'})});}return r.continue();});
 await page.getByLabel('회차 이미지 선택',{exact:true}).setInputFiles(['webtoon-fixtures/page-1.png','webtoon-fixtures/page-2.png','webtoon-fixtures/page-3.png']);await page.getByRole('button',{name:'이미지 업로드',exact:true}).click();await page.getByRole('button',{name:'실패 파일 재시도',exact:true}).waitFor();await page.getByRole('button',{name:'실패 파일 재시도',exact:true}).click();
 const list=page.getByRole('list',{name:'회차 이미지 순서'});await list.locator('li').nth(2).waitFor();assert.equal(await list.locator('li').count(),3);console.log('PASS admin UI multi-upload failure/retry preserves successful files and input order');
 const original=await list.locator('li').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-asset-id')));
 await page.getByRole('button',{name:'3번째 이미지 위로',exact:true}).click();await page.getByRole('button',{name:'2번째 이미지 위로',exact:true}).click();
 await page.getByRole('button',{name:'2번째 이미지 제거',exact:true}).click();assert.equal(await list.locator('li').count(),2);
 await page.getByText('기존 이미지 재사용',{exact:true}).click();await page.locator(`[data-library-asset-id="${original[0]}"]`).getByRole('button',{name:'회차에 추가',exact:true}).click();
 const expected=[original[2],original[1],original[0]];assert.deepEqual(await list.locator('li').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-asset-id'))),expected);
 await page.getByRole('button',{name:'임시저장',exact:true}).click();await page.getByRole('status').filter({hasText:'회차를 비공개 임시저장했습니다.'}).waitFor();
 await page.getByLabel('회차 선택',{exact:true}).selectOption('');await page.getByLabel('회차 선택',{exact:true}).selectOption(episodeId);assert.deepEqual(await list.locator('li').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-asset-id'))),expected);console.log('PASS reorder, individual removal, reuse and saved order after reselection');
 await page.getByLabel('작품 제목',{exact:true}).fill(title+' 수정');await page.getByLabel('작품 공개',{exact:true}).check();await page.getByRole('button',{name:'작품 저장',exact:true}).click();await page.getByRole('status').filter({hasText:'작품을 저장했습니다.'}).waitFor();
 await page.getByLabel('회차 제목',{exact:true}).fill('공개된 합성 회차');await page.getByRole('button',{name:'회차 공개',exact:true}).click();await page.getByRole('status').filter({hasText:'회차를 공개했습니다.'}).waitFor();console.log('PASS work/episode editing and draft-to-public publishing');
 const userCtx=await context({width:1280,height:900});const user=await userCtx.newPage();await login(user,'local-test-account.json');await user.goto('http://127.0.0.1:3100/admin/webtoons');await user.getByRole('heading',{name:'관리자 권한이 필요합니다.',exact:true}).waitFor();console.log('PASS ordinary-user admin screen blocked');
 const mobileCtx=await context({width:375,height:812});const mobile=await mobileCtx.newPage();mobile.setDefaultTimeout(25000);mobile.on('pageerror',()=>errors.push('mobile-error'));
 await mobile.goto('http://127.0.0.1:3100/webtoons');await mobile.getByRole('link',{name:title+' 수정'}).click();await mobile.getByRole('link',{name:'1화 · 공개된 합성 회차',exact:true}).click();
 const viewer=mobile.getByRole('region',{name:'웹툰 세로 뷰어'});await viewer.locator('img').nth(2).waitFor();
 assert.deepEqual(await viewer.locator('img').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src').split('/').pop())),expected);
 for(const img of await viewer.locator('img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(n=>n.complete?Promise.resolve():new Promise((res,rej)=>{n.onload=res;n.onerror=rej;}));assert(await img.evaluate(n=>n.naturalWidth>0));}
 assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 fs.mkdirSync('screenshots-webtoons',{recursive:true});await mobile.screenshot({path:'screenshots-webtoons/mobile-reader.png',fullPage:true});console.log('PASS anonymous list → episodes → viewer, ordered images loaded at 375px without horizontal overflow');
 const prior=JSON.parse(fs.readFileSync('webtoon-test-state.json'));await mobile.goto(`http://127.0.0.1:3100/webtoons/${prior.workId}/episodes/${prior.episode1}`);await mobile.getByRole('link',{name:'다음 회차 →',exact:true}).click();await mobile.waitForURL('**/'+prior.episode2);await mobile.getByRole('link',{name:'← 이전 회차',exact:true}).click();await mobile.waitForURL('**/'+prior.episode1);console.log('PASS previous/next episode navigation');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'screenshots-webtoons/admin-upload.png',fullPage:true});assert.equal(errors.length,0);console.log('PASS zero page JavaScript errors');
 fs.writeFileSync('webtoon-browser-state.json',JSON.stringify({workId,episodeId,title:title+' 수정',order:expected}),{mode:0o600});await browser.close();
})().catch(async e=>{console.error('FAILED webtoon browser:',e.name,e.message?.split('\n')[0]);await runningBrowser?.close();process.exitCode=1});
