# 로컬 개발 소스 보존과 운영 전용 artifact

개발 브랜치의 local-test/lib/local/도구·설정은 유지한다. 운영에는 이 checkout을
통째로 rsync하거나 로컬 .next를 복사하지 않는다. 준비한 CLI는 clean pin checkout의
tracked 소스 allowlist만 새 외부 디렉터리로 내보내며 기존 디렉터리를 덮어쓰지 않는다.

```sh
node scripts/release/prepare-production.cjs /new/clean-production-source
# 승인된 Linux 빌드 환경, Node22.23.0, 필요한 환경은 프로세스/서버 전용으로 설정:
cd /new/clean-production-source
npm ci
npm run build
# 원래 clean checkout에서:
node scripts/release/stage-standalone.cjs /new/clean-production-source
node scripts/release/verify-artifact.cjs /new/clean-production-source/.next/standalone
```

스크립트/출력 경로에 비밀값은 전달하지 않는다. 환경 검증은 그대로 실행한다.
내보내기 제외: app/local-test, lib/local, 테스트 runner/seed/SQL fixture, 로컬 관리
설정·Windows/Mac wrappers, env/계정/state/실제 PDF·개인키·인증서·Git/browser data.
일반 차량번호 입력 예시는 기존 서비스 UI이며 합성 API 응답 fixture와 구분한다.

실제 운영용 사본의 결정적 변환은 prepare-production.cjs에서 검토할 수 있다:
layout의 테스트 banner/import 제거, KOTSA의 local handler/import 제거,
GA/IndexNow의 로컬 비활성 분기 제거, 관리자 로그인은 기존 /login만 사용,
홍보 제외 경로에서 local-test 제거. local 코드에 대한 stub나 실행 플래그조차 남기지
않는다. 정해진 소스 경계가 바뀌면 변환은 fail closed한다. 원본 개발 소스는 수정하지 않는다.
운영용 next.config에만 output=standalone을 추가한다. PDF 검증 worker 및 동일6.5.438의
worker/fonts/cmaps/wasm는 tracing으로 포함하며 public/.next/static도 staging한다.

source/release manifest에 원래 Git SHA, dirty 여부, 각 source SHA256, platform/arch,
Node/Next/Sharp 버전을 남긴다. 기본값은 dirty 소스 포장을 거부한다. 개발 검증에만
명시적인 --allow-dirty-for-verification을 쓸 수 있고 그 결과는 배포 금지다.
source manifest의 해시가 build 후 바뀌어도 staging을 거부한다.

이번 검증: 별도 운영 소스231파일, npm ci/일반 npm run build 성공. 실제 production
standalone loopback 임시 실행에서 home/static200, local-test404, 익명/위조 관리자404,
서버 local flags1·클라이언트 주입으로도 모의 API 비활성, 동일 버전 worker/font200 확인.
외부 운영 쓰기/유료 API는 테스트 preload로 차단했고 임시3101 서버는 종료했다.
public/static 포함 standalone4,209파일 및 static에서 local 실행 marker, env/private-key/service-role JWT,
알려진 로컬 anon/service 키·테스트 비밀번호가 없음을 검사했다. scanner의 marker/key/known-secret 거부와 overwrite 금지도 테스트했다.

테스트 자격증명은 운영 build 입력이 아니었다. 서버 서비스 역할 키는 build에 전달하지
않았고 실제 값은 운영 runtime에서만 주입한다. 공개 Supabase URL/anon 값은 웹 앱의
필수 공개 설정이며 비공개 service 키와 구분한다. 실제 회원정보/PDF는 포장하지 않는다.

이 맥의 standalone은 Darwin/arm64 검증물이다. **Ubuntu 서버로 복사해 실행하지 않는다.**
승인된 Linux 환경에서 같은 source/lockfile로 새로 build하고 Linux/arch manifest와
secret/artifact 검사를 확인한 결과만 배포한다. 기존 공개 sitemap SELECT와 Google Fonts가
필요하며 운영 DB 쓰기나 유료 차량 API는 빌드에 필요하지 않다.
