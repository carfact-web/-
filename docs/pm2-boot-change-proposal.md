# PM2 부팅 복구: 웹툰 배포와 별도 승인 변경

2026-11-13 read-only: root carfact PM2 online, cwd /root/carfact, npm start,
1 fork process/autorestart=true. pm2-root systemd unit은 not-found/inactive.
현재 실행과 재부팅 복구는 다르다. 부팅 복구가 등록됐다고 판단하지 않는다.
이번 웹툰 준비에서는 startup/save/enable/restart/reboot를 실행하지 않았다.

별도 변경 계획:

1. 현재 pm2 jlist/dump, Node/npm/PM2 절대경로, process owner, port/cwd/env/args,
   active BUILD_ID와 Nginx upstream을 대조하고 암호화 백업한다. 이번 원본 백업에는
   dump와 running-processes.json이 있으나 신규 릴리스 확정 후 다시 대조한다.
2. root 유지 또는 deploy 사용자 이전 중 하나를 별도 결정한다. deploy 사용자 전환은
   SSH/소유권/비밀파일 권한/포트 전환까지 포함하는 다른 변경이며 묶어서 실행하지 않는다.
3. 사용자·Node/PM2 경로를 고정한 systemd startup 명령/실제 unit diff와 저장할
   정확한 앱 목록을 제출해 승인받는다. pm2 startup이 출력하는 명령을 맹목 실행하지 않는다.
4. 승인 후에만 startup unit 등록 및 pm2 save, unit enable을 수행한다. 기존 앱에 대한
   강제 restart/reboot를 이 등록 과정에 끼워 넣지 않는다.
5. unit User/Environment/PATH/PIDFile/ExecStart, dump의 중복 앱/옛 포트/환경을 검사한다.
   부팅 테스트는 별도 점검 창·접속 복구 수단·롤백 승인 후 수행한다.

롤백은 추가한 unit을 승인 하에 disable/remove하고 보존한 dump/정의를 복구하는 것이다.
실행 중 정상 웹툰/기존 앱은 중단하지 않는다. 운영 재부팅으로 시험하지 않았다.
