# 웹툰 운영 배포 준비 결과 — 2026-11-13 KST

이 문서가 webtoons-preflight-2026-11-13.md의 이전 미완료 상태를 갱신한다.
**운영 마이그레이션·설정 변경·재시작·트래픽 전환은 실행하지 않았다.**
코드 검토 기준은 release/webtoon-review-2026-11-13의 이번 완료 보고 SHA다.
DB 직접 인증/정식 전체 복구는 아직 준비되지 않아 운영 실행 승인을 요청하는 단계는 아니다.

## 완료한 코드/검사

- Next16.2.6→공식 최소 patched16.4.1, Sharp0.34.5→0.35.5,
  eslint-config-next16.4.1 일치. PostCSS8.5.23/nanoid3.3.20,
  source-map-js1.2.2/baseline-browser-mapping2.11.37로 취약 범위 해소.
  lockfile 갱신, npm audit fix --force 미사용. 운영 감사6→0.
- 개별 GHSA/영향 경로/판정 한계는 docs/security/webtoon-dependency-*.json/md.
  dev 포함 잔여13개 및 vendored-code 감사 한계도 분리 기록했다.
- Node22.23.0의 별도 운영 소스 npm ci, preview/validator 우회 없는 npm run build 성공.
  Google Fonts·기존 sitemap 공개 SELECT만 허용하고 운영 쓰기/유료API 차단 유지.
- 전체 lint0 errors/21 warnings, TypeScript 통과. 새 Next가 AGENTS의 자동 문서
  안내 블록을 갱신했으며 해당 생성 블록도 보존했다.
- 이미지 API/브라우저 업로드503 재시도·순서·개별제거·재사용·공개취소/비공개·
  RLS/Storage/권한 음성검사, GC와 동시성 통과.
- PDF30/40/60페이지, 손상/암호화/201페이지/크기초과 거부,30/40 한글·순서·최대5캔버스·
  모바일 확대/이어보기·관리자 preview/임시저장/공개 통과, JS 오류0.
- 서버 관리자 페이지/Origin/HttpOnly 쿠키/API 독립 검사·일반/위조/정지 계정 차단,
  메인 최신 이미지/PDF 카드·홍보 예약/만료/공개취소/재공개 자동재개금지·모바일/KST
  오늘숨김/ESC/포커스·관리자 저장 흐름 모두 통과.
- 운영 소스의 local-test/lib/local/fixture/실행 분기를 물리적으로 제외하는 결정적
  exporter와 standalone stager/scanner 추가. 개발 원본 로컬 구성은 그대로 유지.
  standalone/static에 로컬 실행 marker·테스트 자격증명·service-role JWT·env/privatekey
  없음 검사. 실제 production 모드 임시3101에서 flags/입력 주입으로도 모의 실행 불가,
  home/static/일치 PDF worker/font200, local-test 및 무권한 관리자404 확인 후 종료.
- 이 맥의 native standalone은 Darwin/arm64 검증물이며 Linux 배포 금지. 최종 clean
  SHA를 exporter로 내보내 승인된 Linux 빌드 환경에서 다시 build/scan한다.

## 운영 백업·직접 DB 접근 결과

자세한 범위·해시·복구 한계는 webtoons-backup-report-2026-11-13.md.
소스/현재 .next/환경/Nginx/PM2를72,120,320bytes AES-GCM 암호화 백업했다.
격리 파일 복구3,106개 checksum/Git fsck/BUILD_ID 확인. 원본 운영 소스·dirty lock은 보존했다.
REST 리소스31/24,431행 및 Auth14, Storage43객체/3,451,064bytes를 별도 암호화 스냅샷으로
확보했다. JSON 파일 복구·개수 및 모든 객체 checksum 확인, GCM 변조 거부도 통과.
실제 운영 자료는 개발 DB/Auth/Storage에 넣지 않았고 복구 plaintext는 검사 후 제거했다.
새 유료 서비스나 외부 저장소 전송은 없으며 개인 SSH 키는 복사하지 않았다.

이는 DB schema/roles/RLS/functions/Auth hash를 포함한 정식 pg_dump/PITR가 아니다.
시점 일관성이 없고 PostgreSQL/권한/Auth 통합 복구도 미검증이므로 완전한 재해 복구
준비 완료라고 판단하지 않는다. 기존 pooler 주소에는 비밀번호가 없고 환경/서비스/
access-token 파일에도 직접 인증이 없다. catalog/ledger 직접 대조는 미실행이다.
필요한 인증 항목은 백업 보고 문서의 DB password+접속/권한 또는 read-only SQL 관리
세션이다. 대화/명령줄/Git으로 비밀값을 전달하지 않는다. SQL이나 진단 RPC를 추측 적용하지 않는다.

## 승인 후 적용할 정확한 SQL/Storage 목록

실제 catalog/migration 이력을 READ ONLY SQL로 확인한 뒤 아래 세 개만 순서대로 적용한다.
부분 적용/동명 객체 충돌이면 중단하고 실제 정의를 대조한다. 포괄 db push/로컬 bootstrap/
합성 seed는 적용하지 않는다. 원문 파일과 해시가 정확한 변경의 기준이다.

| migration | SHA256 |
|---|---|
| 20261112090000_add_webtoon_publishing.sql | 17c6ad845d574b2491484caef938e5e100cf88c6be289c5a6b1e5f945935dfe9 |
| 20261112100000_add_webtoon_pdf.sql | 2b3f22411bb9e369490fbfacbb566de10f9e66b0f9f5ff1452b1c3a63ca7e20d |
| 20261112110000_add_webtoon_promotion.sql | 3d0e6b31dea6f1f54ec167cd1769d706fa284e685677f63ebc26ce725301c7ec |

1. 신규5테이블: webtoon_works, webtoon_episodes, webtoon_assets,
   webtoon_episode_pages, webtoon_promotion. title/description/번호/정렬/관계/중복/상태/
   MIME/크기 CHECK와 FK/PK/unique/index. episodes에 content_type/pdf_asset_id와
   published_at, assets에 page_count/page_sizes 포함. 기존 공개일은 updated_at fallback.
2. base4테이블 read RLS 정책 이름: Published webtoon works/episodes/pages/assets.
   부모+회차 공개/ready 참조 또는 실제 비정지 관리자만 SELECT. anon/authenticated는
   SELECT만 grant, mutation deny. promotion singleton은 client 모든 권한 revoke,
   service_role ALL, 초기1행 enabled=false(운영 최소 설정이며 합성 콘텐츠 seed가 아님).
3. 최종 RPC: webtoon_is_admin();
   webtoon_save_work(uuid,integer,text,text,uuid,boolean);
   webtoon_save_episode(uuid,integer,text,integer,boolean,uuid[],text,uuid);
   webtoon_claim_orphans(uuid); webtoon_promotion_card(uuid);
   webtoon_promotion_payload(). 관리자 helper/payload만 필요한 공개 execute 허용,
   save/claim/card는 service_role만. 모든 보안 definer는 고정 search_path.
   trigger 함수 webtoon_stamp_publication()/webtoon_stop_promotion()도 추가한다.
4. trigger3개: webtoon_publication(episodes 공개 전환 날짜),
   webtoon_episode_promo_stop, webtoon_work_promo_stop(비공개/삭제 시 홍보 비활성화).
5. Storage: 신규 webtoon-private bucket **private**, 최종50MiB,
   allowed MIME image/webp+application/pdf. 이미지 API 자체10MiB 제한 유지.
   storage.objects의 Webtoon objects server only는 anon/authenticated FOR ALL
   AS RESTRICTIVE, USING/WITH CHECK bucket_id<>'webtoon-private'. 직접 읽기/서명/
   쓰기 차단, 권한 재검사한 서버 proxy만 bytes 제공. 다른 버킷 권한 확대 없음.

회원·차량·후기 테이블과 OAuth 설정은 변경하지 않는다. 서버 Auth/profile 조회와
웹툰 범위만 사용한다. 실제 작품 파일은 별도 관리자 업로드이며 노트북 PDF 자동 복사 없음.

## 정확한 Nginx 제안

ops/nginx/webtoon-upload-locations.conf.example는 검토용이며 운영에 미적용이다.
기존 TLS server 안의 정확 경로 두 개: image upload12m, pdf-upload52m.
50MiB+multipart64KiB보다 큰52m로 제한하고 다른 경로는 그대로 둔다.
새 release 포트3001 가정이며 기존 / 및 두 업로드 경로의 proxy_pass를 **동일 새 upstream**으로
전환해야 한다. Host/realIP/forwarded/upgrade/HTTP1.1 설정 보존. private/no-store 유지.
실제 포트·server block·location 충돌을 재확인하고 원본 백업/nginx -t/승인된 reload 후
경계 크기/공개취소 검증이 필요하다. 지금은 운영3000 연결을 바꾸지 않았다.

## 배포 및 롤백

선행 조건: DB 직접 catalog/이력 대조, 정식 DB+Storage 일관 백업 및 격리 통합 복구,
별도 키/인증서 복구 준비, 정확한 Linux artifact·환경·Nginx diff와 실행 계획 승인.
새 외부 보관소/유료 백업이 필요하면 먼저 목적지/비용만 제시한다.

승인 후에는 기존 /root/carfact와 root PM2를 유지한 채 별도 clean release와 임시
loopback process를 만든다. 같은 승인 SHA·lockfile·source manifest로 Linux 일반 build/
artifact 검사 → 승인된3 SQL+Storage → 공용/관리자/비공개 smoke → Nginx 전환 순서다.
실패하면 신규 작성/GC/홍보를 중단하고 원래3000 process와 Nginx 전체 설정으로 복귀한다.
업로드 exact location도 함께 원복해 옛/신규 upstream이 섞이지 않게 한다. 운영
2e14443+dirty lock+기존 BUILD_ID는 덮어쓰지 않는다. 새 DB/Storage 데이터·private정책은
보존하고 자동 DROP/delete/down migration은 실행하지 않는다. 실제 데이터 복구는 검증된
동일 시점 DB와 객체 bytes를 함께 복원해야 한다. 파일/제한 API 복구만으로 대신하지 않는다.

PM2 자동 기동은 docs/pm2-boot-change-proposal.md의 **별도 변경**이다. 이번 웹툰
배포에 startup/save/enable/reboot나 사용자 이전을 끼워 넣지 않는다.
