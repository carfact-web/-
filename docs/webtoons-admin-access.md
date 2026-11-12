# 웹툰 관리자 메뉴와 서버 페이지 접근

운영 배포 전 소스 준비 및 로컬 합성 계정으로만 검증했다.

- 실제 `/admin`의 '관리자 메뉴'에 **웹툰 관리** 링크를 배치한다.
- 기존 useAuth의 isAdmin/준비 상태를 재사용하고 정지 계정에는 링크를 숨긴다.
- 일반 방문자·일반 회원에게 관리 메뉴/업로드 UI를 표시하지 않는다. 공개 카드의
  '웹툰 보러 가기'는 유지한다. 'CARFACT ORIGINAL' 영문 변경도 포함한다.
- 노란 안내와 테스트 링크는 기존 isLocalSandboxServer 조건 안에만 유지한다.
  그 안의 관리자 링크도 같은 권한 판정을 사용한다. 운영에서는 안내 전체가 없다.

## 서버 검사와 기존 로그인 재사용

기존 Supabase 로그인은 브라우저 저장소에 있다. 메뉴를 누르면 현재 사용자 토큰으로
POST `/api/admin/webtoons/session`을 호출한다. 기존 requireWebtoonAdmin이 실제 Auth
사용자, profiles.role(admin/super_admin), is_suspended를 검사한 경우에만 페이지용
HttpOnly·SameSite=Strict·path=/admin/webtoons·Max-Age=300 쿠키를 설정한다.
운영에서는 Secure도 켠다. 별도 비밀번호/사용자/인증 공급자/DB 세션을 만들지 않는다.
응답 본문에 토큰을 넣지 않는다. 동일 Origin 검사는 실제 Host와 프록시 프로토콜을
반영하며 외부 Origin이나 Origin 없는 세션 발급을 거부한다.

`/admin/webtoons`는 서버 페이지다. 쿠키 또는 명시적인 Bearer를 같은 기존 함수로
매 요청 검증한 뒤에만 분리된 WebtoonAdminEditor를 반환한다. 미인증·비관리자·위조·
정지 계정은404(관리자 권한 안내)이며 편집기 payload를 반환하지 않는다. 쿠키가 없는
관리자는 먼저 관리자 메뉴에서 진입한다. 5분 쿠키 만료 후도 메뉴로 재진입한다.
쿠키 만료를 연장해도 실제 Supabase 토큰 만료와 서버 역할 검사는 우회할 수 없다.

페이지용 쿠키는 웹툰 API 쓰기 권한으로 사용하지 않는다. 모든 기존 API는 계속
실제 Bearer 사용자 토큰과 최신 역할·정지 여부를 서버에서 독립 검사한다.
로그아웃은 DELETE 세션 경로로 페이지 쿠키를 지운 뒤 기존 Supabase 로그아웃을
수행한다. 로컬 테스트 로그인도 계정 전환 전에 같은 쿠키를 정리한다.

## 검증

로컬 앱을 실행하고 Node22 wrapper로 다음 스크립트를 실행한다.

- scripts/webtoons/admin-access-check.cjs: 익명/일반/관리자 메뉴 및 URL/API,
  위조 역할/서비스키/쿠키, 발급 Origin, HttpOnly/범위, 데스크톱·모바일,
  페이지 새로고침, 실제 정지 상태 반영, 로그아웃 후 쿠키 제거, JS 오류0.
- 기존 이미지/PDF 브라우저 테스트: 관리자 진입은 메뉴 링크를 통하도록 갱신.
- scripts/local-sandbox/safety-check.cjs: 운영 모드 로컬 기능 비활성화 게이트.
- 일반 build 후 scripts/local-sandbox/production-boundary-check.cjs:
  로컬3101에 임시 운영 모드 서버를 실행해 메인HTML에 노란 안내/테스트 링크가 없고,
  익명 관리자 페이지와 local-test가404인지 확인 후 서버를 종료한다.

추가 DB migration·Storage/Nginx 변경은 없다. 실제 운영 적용은 별도 승인 후다.

검증 결과: 관리자·일반 사용자 API/브라우저 및 이미지/PDF 회귀 통과, JS 오류0.
일반 build(컴파일·TypeScript·정적26페이지) 통과. 로컬 운영 모드 HTTP 검사도 통과해
노란 안내·테스트 링크·관리자 링크가 메인 HTML에 없고 무권한 관리자/local-test는404였다.
