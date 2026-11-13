# 웹툰 릴리스 운영 의존성 6건: 영향 경로와 수정

2026-11-13 KST. '6건'은 npm audit --omit=dev의 취약 **패키지 수**이며 CVE/GHSA 수가 아니다.
감사 원문의 개별 제목·범위·URL·전후 설치 버전은 같은 디렉터리의
webtoon-dependency-audit-2026-11-13.json에 보존했다. 인증/운영 데이터는 없다.
실제 공격 재현이나 침해 여부 판정은 하지 않았다.

| 패키지/기존 버전 | 실제 경로·영향 | 수정 |
|---|---|---|
| next16.2.6 / critical | 직접 의존성. App Router/동적 관리자 서버/SSG·ISR·next/image·next/og를 사용한다. Middleware 우회, Server Actions DoS/SSRF, cache confusion/poisoning, Image Optimization 및 ImageResponse RCE 등20개 직접 GHSA가 보고됐다. Windows 전용 조건의 이슈도 있으나 Linux 이미지 경로 이슈가 있어 전체를 비해당으로 볼 수 없다. 모든 공격 전제의 도달 가능성을 입증한 것은 아니다. | 최소 patched16.4.1 고정, eslint-config-next도16.4.1로 일치 |
| sharp0.34.5 / high | 직접 의존성 및 Next의 이미지 의존성 공유. 관리자 업로드의 실제 decode/reencode와 공개 홍보 표지 축소에 사용된다. libvips/libheif/librsvg의3 GHSA. 관리자 권한/MIME·크기 검사만으로 디코더 취약점이 수정되지는 않는다. | 최소 stable0.35.5 고정; Next와 단일 버전 dedupe |
| postcss8.4.31 / high | next→postcss, CSS 빌드 처리. 별도 Tailwind의8.5.14도 있었음. sourceMappingURL로 파일 읽기/path traversal 및 stringify XSS의4 GHSA. 공개 API가 임의 CSS를 빌드하도록 제공되지는 않지만 소스/의존 CSS 처리 경로는 존재한다. | Next16.4.1이 요구하는8.5.23으로 통합 |
| nanoid3.3.12 / high | postcss→nanoid. non-secure 음수 크기/custom generator0 크기의 무한루프2 GHSA. 앱 자체가 임의 요청 크기로 해당 generator를 호출하는 경로는 찾지 못했다. | 새 PostCSS 해석으로3.3.20 |
| source-map-js1.2.1 / high | PostCSS 및 @tailwindcss/node→source-map-js. 악성 indexed source-map offset의 event-loop DoS. 주로 빌드 입력/소스맵 처리 경로다. | 호환 범위 targeted update로1.2.2 |
| baseline-browser-mapping2.10.30 / moderate | next 직접 및 browserslist 공용 의존성. invalid input에 따른 process 종료 DoS, 브라우저 타깃 계산 경로. 앱에서 임의 입력을 받는 별도 공개 endpoint는 찾지 못했다. | 호환 범위 targeted update로2.11.37 |

첫 설치 후 남은 두 패키지만 `npm update baseline-browser-mapping source-map-js`했다.
npm audit fix 및 --force는 사용하지 않았다. React/PDF.js/pdf-lib 버전은 바꾸지 않았다.
Next/Sharp 네이티브 바이너리와 필요한 전이 의존성이 lockfile에서 함께 갱신됐다.
공식 공지의 <=16.4.0 범위에 대한16.4.1, Sharp<0.35.5에 대한0.35.5를 선택했다.

공식 근거:

- https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw
- https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r
- https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr
- https://github.com/lovell/sharp/security/advisories/GHSA-f88m-g3jw-g9cj
- https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w

결과: 운영 감사 critical/high/moderate 모두0, 총0. 전체 dev 포함 감사는13개
(low1/moderate8/high4)로 별도 남는다. ESLint/Babel/TypeScript lint 의존성 경로이며
root의 해당 패키지 복사본은 standalone에 추적되지 않았다. 다만 Next의
`dist/compiled/zod`는 버전 없는 vendored bundle로 포함된다. root zod4.4.3/dev 감사
결과를 이 vendored 코드의 판정으로 대체할 수 없다. npm audit는 vendored 코드 전체의
SBOM/무취약 인증이 아니므로 이 범위를 따로 기록한다. 이번에 모든 의존성의 모든
취약점이 해소됐다고 주장하지 않는다. 추가 dev/vendored 검토는 별도 추적한다.

재검증: npm ci(운영 소스 별도 설치), 전체 lint0 errors/21 warnings(기존20+
새 Next lint의 기존 window.location.assign 경고1), TypeScript, 일반 build 성공.
이미지/PDF API·UI·GC/동시성·관리자 Origin/권한/쿠키·메인 카드·선택형 홍보 전부 통과.
실제 휴대폰/복잡한 실제 스캔 PDF 최대 부하는 이번 재검증에 포함하지 않았다.
