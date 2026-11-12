# 2026-11-13 KST 운영 배포 준비 인수 검토

**운영 변경·트래픽 전환 미실행. 이 문서는 배포 승인 완료를 뜻하지 않는다.**
기존 webtoons-release.md의 이미지/PDF 설명에 홍보 migration과 이번 실제 상태를
합쳐 읽는다. 이 문서의 최신 범위가 앞선 '한 개/두 개 migration' 안내보다 우선한다.
기존 deployment-checklist.md의 dirty 운영 디렉터리 git pull/npm install/restart,
포괄 db push, 실차 유료API 테스트는 이번 배포 절차로 사용하지 않는다.

## 소스 상태와 후보

최신 GitHub를 ls-remote 및 fetch로 다시 확인했다:

- main: c9a126794ff6fac49fc3355b1612348e18ba3cd8.
- 기존 개발: dev/carfact-2026-11-12 = dd6e2665034a0ead891165181ecca7b04b9358e7.
- 노트북: dev/carfact-windows-2026-11-12 = f989cadc3a9750ad2e354ec66eaca805b5d5835d.

맥 기존 repo는 dd6e266, 미커밋0/기존 원격 대비 미푸시0이었다. pull/reset/덮어쓰기 없이
유지했다. 노트북 HEAD는 기존 개발 HEAD의 후손이며 추가2커밋(643a4ac, f989cad)이다.
맥에 별도 worktree `carfact-work/release-review-2026-11-13`,
브랜치 `release/webtoon-review-2026-11-13`을 만들었다. 해당 브랜치 완료 보고의 SHA가
이번 **검토용 후보**이며, 보안 수정 후에는 검증하고 후보 SHA를 다시 pin해야 한다.

노트북에만 남았다고 전달받은 변경은 원격에서 없음을 확인해 재현했다:
PdfUpload 안내를 'PDF 최대 50MB · 최대 200페이지 · 암호화 PDF 미지원'으로 간소화하고
기술 설명은 webtoons-pdf.md에 집중했다. 실제 파일 한도50MiB/200페이지는 그대로다.
노트북 파일 시스템을 직접 읽거나 해당 미커밋 파일이 바이트 단위로 같다고 확인한 것은 아니다.
노트북 WORKLOG의 실제 PDF10.8MiB/30페이지 확인은 사용자 인계 결과로 구분한다.
그 파일을 맥/운영으로 가져오지 않았고, 이번에 실제 파일 검증을 재실행하지 않았다.

## 운영 읽기 전용 재확인

- SSH 성공. `/root/carfact` main@2e1444349af3b43cdee03f1253621b3aaef6f6ee,
  저장된 origin/main 대비 ahead1, package-lock.json만0추가/108삭제.
- lockfile SHA256 `23c582784d3956932e3c2a41c6c1cbede2edcc8a43aac95e604d72c40ae6b50c`:
  기존 preserve/production-2026-11-12-2e14443의 파일과 일치.
  기존 보존 패치/bundle4개의 SHA256 및 bundle verify 성공. 이 증분 bundle은
  기준 c9a1267이 필요하며 환경·바이너리·DB·Storage 전체 백업은 아니다.
- 운영 BUILD_ID `W9b_KtP3rykVMZYQ9Ed7n`, 실제 Node22.23.0, Next16.2.6, Sharp0.34.5.
- root PM2 carfact online, cwd /root/carfact, /usr/bin/npm start, fork1,
  autorestart=true, 누적 restart_time135. 누적 횟수만 확인했으며 재시작 원인은 미분석.
  pm2-root systemd unit not-found/inactive. 부팅 복구 작업은 별도 범위다.
- Nginx -T 성공, carfact.kr/www.carfact.kr HTTPS →127.0.0.1:3000,
  현재 client_max_body_size 설정 없음. 설정/프로세스를 변경하지 않았다.
- 메모리 총3814MiB/관측 available2202MiB, swap0. 디스크75G 중66G 여유.
  일시 측정이며 최대 PDF/이미지 동시 부하 성능 검증은 아니다.
- Supabase는 운영 서버 안의 기존 키로 GET만 수행. 키를 복사/출력하지 않았다.
  user_profiles role/is_suspended 열 조회(limit0)는200. 웹툰5테이블(limit0)은
  모두404/PGRST205, OpenAPI에 웹툰 table/RPC 없음. private bucket 목록 GET200,
  webtoon-private 없음. 공개 REST 카탈로그 기준 웹툰 미적용 상태로 관측된다.
  migration 이력 스키마는406/PGRST106(미노출), 직접 DB 연결 설정도 없어
  **SQL catalog/이력 자체는 미확인**이다. 스키마 캐시 부재만으로 DDL 부재를 단정하지 않는다.
  적용 전에 docs/sql/webtoon-preflight-readonly.sql과 migration 이력 SELECT를
  안전한 승인 DB 접속에서 실행해 부분 적용·중복·충돌을 판별한다. 진단 RPC는 만들지 않는다.

현재 Nginx 무변경 대조 기준 SHA256:

- /etc/nginx/nginx.conf: 48c6a4ec1e1fd28ccf968490f07e34a1d7f755793b2108a3ed8670b1ee2a0aa2
- /etc/nginx/sites-enabled/carfact: 951e8ad10f2efb6a2e7944b52b11a2e365fd6962cf74c1ce3bd2092a52936017
- /etc/nginx/sites-enabled/default: ce0901350a021608139b5639cf4ccd7717bef8c3a9e4f79031eb46386b67b03f

파일 해시는 복구 가능한 설정 백업을 확보했다는 뜻이 아니다. 실제 파일·symlink·권한과
PM2 정의·현재 .next/서버 환경 복구 자료는 암호화 백업 및 격리 복구 확인이 필요하다.
개인 SSH 키는 복사하지 않는다. 기존 운영 소스/설정/프로세스는 그대로 보존했다.

## 승인받을 정확한 배포 범위

코드: 이미지/PDF 작품·회차 관리자, 서버 페이지/API 권한 검사, 내부 뷰어,
메인 CARFACT ORIGINAL/최신 공개 웹툰 카드, 기본 비활성 선택형 홍보 팝업.
회원·차량·후기 스키마 및 OAuth 공급자/설정 변경은 없다.
운영2e14443의 차량 모델 후보 수정이 후보 이력에 보존됐음을 확인했다.
단, 기존 local-sandbox 경계용 변경도 소스 차이에 있으므로 이를 '웹툰만의 diff'라
축약하지 않는다. 운영에서는 local 기능이 활성화되지 않아야 한다.

DB/Storage는 다음3개만 이 순서로, 실제 적용 이력과 catalog 대조 후 적용한다.
로컬 bootstrap/다른 누적 migration/seed를 일괄 db push 하지 않는다.

| 파일 | 정확한 범위 | SHA256 |
|---|---|---|
| 20261112090000_add_webtoon_publishing.sql | 4테이블(works/episodes/assets/episode_pages), read RLS, 관리자 helper, service-only save/GC RPC, private bucket와 restrictive server-only Storage 정책 | 17c6ad845d574b2491484caef938e5e100cf88c6be289c5a6b1e5f945935dfe9 |
| 20261112100000_add_webtoon_pdf.sql | episode 콘텐츠 방식·PDF 참조, assets 페이지 메타데이터/CHECK, PDF 공개 RLS,8인자 save RPC·GC/표지 검증, bucket50MiB+WebP/PDF | 2b3f22411bb9e369490fbfacbb566de10f9e66b0f9f5ff1452b1c3a63ca7e20d |
| 20261112110000_add_webtoon_promotion.sql | published_at 열/날짜index/공개시각trigger, singleton promotion 테이블·disabled seed1행, 공개요약2 RPC, 작품/회차 비공개·삭제 시 홍보정지2 trigger | 3d0e6b31dea6f1f54ec167cd1769d706fa284e685677f63ebc26ce725301c7ec |

합계 신규 테이블5개. promotion 테이블은 RLS, anon/authenticated 권한 없음,
service_role ALL. promotion_card(uuid)는 service_role만,
promotion_payload()는 anon/authenticated/service_role에 공개 요약 읽기만 허용한다.
공개 취소 시 열린 화면 반영은 polling15초+요청 지연이며 받은 파일은 회수할 수 없다.
세부 SQL/RPC/RLS 목록은 원문3개와 webtoons-release.md/webtoons-promotion.md가 기준이다.

Nginx는 정확한 두 경로만 제한 확대: 이미지 /api/admin/webtoons/upload=12m,
PDF /api/admin/webtoons/pdf-upload=52m. 50MiB+multipart64KiB=52,494,336bytes보다
52m=54,525,952bytes가 크다. 기존 Host/proxy/forwarded/upgrade 설정을 유지하고
두 업로드 경로도 새 release upstream으로 전환해야 한다. media private/no-store는 유지.
설정 원본 백업 → nginx -t → 승인된 reload/전환 → 프록시 경계값 검증이 필요하다.

## 보안·백업·artifact 미완료 조건

이번 package/lockfile은 dd6e266부터 변경 없음. npm audit --omit=dev 재조회 결과는
취약 패키지6개(critical1/high4/moderate1)다. 이는 예전 전체 dev 포함19개와 다른 범위다.
PDF.js/pdf-lib는 보고 목록에 없다. Next16.2.6/Sharp0.34.5는 보고 범위에 해당한다.
공식 Next 공지는 glibc Linux Image Optimization의 RCE 위험과 Sharp≥0.35.5 대응을
설명한다. 앱에는 next/image와 next/og 경로가 있고 웹툰에서도 Sharp로 파일을 처리하므로
단순히 Windows 전용 이슈라 무시할 수 없다. 실제 악용 여부는 검사하지 않았다.
이번에는 npm audit fix/버전 변경을 하지 않았다. 별도 개발 변경에서 Next/Sharp 및
실제 중복 설치 버전을 수정·검증하고 이미지/PDF/Auth/홍보와 일반 빌드를 영향 범위에
맞춰 재검증한 뒤 새 후보 SHA를 확정해야 한다. 현재 후보를 배포 준비 완료로 승인하지 않는다.

공식 근거(2026-11-13 확인):
https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw
https://github.com/lovell/sharp/security/advisories/GHSA-f88m-g3jw-g9cj
https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w

실제 운영 DB/PITR·Storage bytes·서버 백업 확보와 격리 복구는 미완료다. 기존
webtoons-release.md의 백업 manifest/checksum/DB와 object key 일관성/복구시간/권한
검증 절차를 완료해야 한다. 운영 실회원 자료를 현재 개발 DB에 넣지 않는다.
Hetzner 자동백업 off/스냅샷 없음은 이전 인계 결과로 이번 제어판 재확인은 못했다.

배포는 개발 디렉터리 전체 rsync나 로컬 .next 복사가 아닌 승인 SHA의 새 clean release다.
로컬 env·private account/state·browser profile·PDF·fixture·seed·테스트 runner·Windows/
Mac 개발 toolchain은 반입하지 않는다. Git tracked PDF/개인키/인증서 없음, 환경파일은
예제만 추적됨을 확인했다. 노트북 실제 PDF는 자동 반입하지 않는다.
**남은 artifact 검토:** 현재 소스는 runtime에서 lib/local/vehicleFixture와 local-test를
정적 참조한다. production 게이트 비활성 검증은 통과했으나 이것이 번들에서 테스트 코드가
물리적으로 제외됐다는 증거는 아니다. 단순 파일 삭제는 import를 깨뜨린다. 운영용
artifact에서 해당 코드/합성 fixture 배제를 확인하거나 최소 격리 변경·일반 빌드를 한 후
승인한다. 소스에서 테스트 도구를 무작정 제거해 기존 로컬 작업을 손상시키지 않는다.
실제 서버 전용 worker.cjs 및 같은 버전 PDF.js worker/fonts/cmaps/wasm은 필수 반입한다.

## 실행 순서·롤백 기준

1. 보안 수정/검증, artifact 제외 확인, DB catalog/이력 확인 및 실제 백업 복구 증빙 완료.
2. 정확한 후보 SHA·3 SQL 해시·Nginx diff·일시/관찰/롤백 담당 범위를 제시해 최종 승인.
3. 승인된 별도 release 디렉터리에서 Node22.23.0/npm ci/실제 운영용 일반 build.
   로컬 테스트 주소 매핑 build artifact와 local .env는 사용하지 않는다.
4. 승인 범위의3 SQL+Storage 적용/검증, 별도 loopback process smoke 후 Nginx 전환.
   운영 main dirty 디렉터리에서는 pull/reset/install/build/restart 하지 않는다.
5. 실패하면 authoring/GC/홍보를 중지하고 기록된 원래 process/3000 upstream으로 복귀.
   원래2e14443+dirty lockfile/.next BUILD_ID 및 설정을 보존한다. DB/Storage는 삭제하지 않는다.
   PDF 미지원 코드로 되돌리기 전 PDF 공개/관리자 작성 중지 계획도 승인 범위에 포함한다.
   데이터 복구가 필요한 경우 검증한 같은 시점 DB+Storage bytes를 함께 복구한다.

이번 검증은 변경한 PdfUpload 안내의 targeted ESLint와 diff check/비밀값 검사,
SQL 해시/운영 보존물 무결성 및 읽기 전용 상태 확인이다. 기존 업로드/PDF/홍보/Auth
통과 검사를 무변경 상태에서 반복하지 않았고 새 일반 build도 실행하지 않았다.
