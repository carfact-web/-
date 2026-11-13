# 운영 백업 확보·격리 복구 결과 — 2026-11-13 KST

운영 파일·DB·Storage·프로세스·설정은 변경하지 않았다. 기존 SSH/서버 내부 API
권한의 읽기만 사용했다. Storage 목록의 POST는 조회 API이며 객체 쓰기는 없다.
새 유료 백업 활성화나 새 외부 보관소 전송은 하지 않았다.
백업은 저장소 밖 맥 `carfact-work/private-backup-2026-11-13/`, 키는 별도
`carfact-work/backup-keys-2026-11-13/`에 있다. 디렉터리0700, 파일0600.
SSH 스트림을 로컬 Node AES-256-GCM으로 즉시 암호화했고 토큰·비밀번호·응답 데이터는
화면/로그/Git에 출력하지 않았다. 개인 SSH 키는 복사하지 않았다.

| 산출물 | bytes | SHA256 |
|---|---:|---|
| source.aes256gcm | 72,120,320 | 70c168eb39ebbe40657efee04d09b9e4067f74b0660e7bc5c766a5115dfe87be |
| api.aes256gcm | 15,572,548 | ba0029dadee8ef3049e329eb2932d666f9dcc603ef7440b1a8cd476bf3912e8f |

## 소스·현재 빌드·설정

첫 산출물은 운영 tracked working files(미커밋 lockfile 포함), Git 객체/refs,
현재 .next(cache 제외), 활성 환경파일, Nginx 설정/symlink, PM2 dump 및 현재
running-processes JSON을 포함한다. 환경/PM2 자료는 비밀값이 있어 암호화 파일로만
보관한다. node_modules, 개인 SSH 키, 별도 KOTSA 인증서/개인키 디렉터리와 TLS
인증서·개인키 파일은 포함하지 않았다. 별도 키 복구 준비는 여전히 필요하다.

운영과 연결되지 않은 임시 로컬 파일시스템에 복호화/복원하여 regular file3,106개의
크기/SHA256을 archive manifest와 전부 대조했다. Git fsck 성공,
HEAD2e1444349af3b43cdee03f1253621b3aaef6f6ee 및
BUILD_ID W9b_KtP3rykVMZYQ9Ed7n 확인. 환경파일·Nginx·PM2 정의 복원 확인.
symlink는 활성화하지 않았고, 복원된 앱/PM2/Nginx를 실행하지 않았다.
검사 후 임시 plaintext 및 추출 디렉터리를 제거했다. 운영 바이너리의 실제 부팅
복구까지 검증한 결과는 아니며 재해 복구에는 Linux Node/의존성/인증서도 필요하다.

## DB·Auth·Storage: 제한된 API 스냅샷

두 번째 산출물은 REST OpenAPI와 노출된 테이블/뷰 리소스31개,24,431행,
Auth admin API 사용자14개, Storage bucket/object metadata 및 객체43개/3,451,064bytes다.
이들은 실제 운영 데이터이므로 기존 개발 DB/Auth/Storage에 복제하지 않았다.
읽기 중 작성 중지/DB snapshot transaction을 사용하지 않아 시점 일관성은 보장하지 않는다.

격리 임시 디렉터리에서 JSON을 복원/파싱하고 기록된 리소스·행·사용자 수를 대조했다.
객체43개를 복원해 개별 bytes/SHA256 전부 일치했다. 양쪽 암호화 파일의 원본
SHA256/GCM 인증 성공과 잘못된 인증 tag 거부도 확인했다. 이후 plaintext를 제거했다.
이는 **파일/객체 수준 복구 검증**이다. 운영 데이터를 개발 서비스에 넣거나 사용자로
로그인하지 않았으며 DB에 restore한 것처럼 보고하지 않는다.

API 스냅샷은 pg_dump/PITR 전체 백업이 아니다. catalog·함수·RLS·grant·sequence·
관리 스키마·Auth password hash/session 등 전체를 포함하지 않아 PostgreSQL 복구,
FK/정책/Auth 로그인/Storage 권한의 통합 복구는 미검증이다. 완전한 DB 복구 승인을
위해서는 아래 연결 수단과 정식 schema/data/roles/managed customization 백업,
격리 PostgreSQL/Supabase 복원 리허설이 추가로 필요하다.

## 직접 DB 조회/정식 백업에 필요한 항목

기존 pooler 주소 파일은 있으나 usable DB password가 없다. 활성/backup/example
환경파일에 DB URL/password/management token 설정이 없고 .pgpass/.pg_service.conf,
Supabase access-token 파일도 없었다. 운영에 psql도 설치하지 않았다. service-role
API 키는 PostgreSQL 비밀번호나 management API 토큰을 대체하지 않는다.

필요한 수단은 다음 중 하나다. 비밀값을 대화/Git/명령줄에 보내지 않고 보안 파일이나
이미 인증된 관리 세션으로 제공해야 한다.

- 기존 pooler/direct host·port·database·DB user·sslmode와 **유효한 DB password**.
  catalog, supabase_migrations, storage 정책 조회 및 정식 dump에 필요한 권한을 구분한다.
  0600 PGSERVICEFILE/.pgpass 등을 사용할 수 있다. 연결 허용 IP/네트워크도 확인한다.
- 또는 해당 프로젝트의 읽기 전용 database query 권한이 있는 인증된 Supabase 관리
  세션/API access token. SQL 조회 권한만으로 정식 dump/전체 복원이 가능하다고 보지는 않는다.

인증이 없으므로 준비한 docs/sql/webtoon-preflight-readonly.sql과 migration ledger
SELECT를 운영에서 실행하지 못했다. 카탈로그를 추측해 SQL/진단 RPC를 적용하지 않았다.
REST5테이블/RPC 미노출·private bucket 없음은 앞선 관측이며 직접 catalog 검증을 대체하지 않는다.

키와 백업이 같은 맥에 있으므로 장비 전체 손실 대비 offsite 복제는 아직 없다.
암호화 키 보관·복구 수단과 별도 보관소 전송은 사용자에게 항목/비용/목적지를 제시한
뒤 승인받아야 한다. Hetzner 유료 백업/스냅샷은 활성화하지 않았다.
