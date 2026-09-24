# ponslink Bible 배포 제거 보고서 — 2026-07-27

## 최종 상태

- 작업 대상: `ssh ponslink` 운영 호스트 (`vmi3261315`, user `declan`)
- 목적: 배포된 bible 프로젝트, DB(런타임 sqlite), 관련 설정/프로세스/리버스 프록시 전량 제거
- 결과: **완료**
- 로컬 저장소 코드 변경: 없음 (원격 운영 자산만 정리)
- 보고서 위치: `reports/ponslink-bible-teardown-report-2026-07-27.md`

## 요약

ponslink에 올라가 있던 Bible Hyperlink Companion 운영 배포를 종료하고, 프로세스·설정·로그·nginx vhost를 제거했다.

제거 시점에 앱 디렉터리(`/home/declan/bible`)와 데이터 디렉터리(`/home/declan/bible-data`)는 이미 파일시스템에서 삭제된 상태였다. 그러나 PM2 cluster worker 2개와 orphan next-server 1개가 **deleted inode** 위에서 계속 실행 중이었고, nginx `bible.ponslink.com` vhost와 `~/.config/bible.env`도 남아 있었다. 이번 작업으로 잔여 런타임과 설정을 모두 정리했다.

## 제거 전 상태 (인벤토리)

### 프로세스

| 항목 | 값 |
| --- | --- |
| PM2 app | `bible` × 2 (cluster, online, uptime ~19D) |
| PM2 id | 31, 32 |
| script path | `/home/declan/bible/node_modules/next/dist/bin/next` |
| exec cwd | `/home/declan/bible` (**deleted**) |
| live port | `*:3100` (PM2 God process) |
| orphan next-server | pid `1766867`, `next-server (v15.5.19)`, cwd `/home/declan/bible.prev` (**deleted**), port `*:3110` |
| runtime probe | `http://127.0.0.1:3100/api/runtime` 응답 정상 (sqlite runtimeSource 유지) |

### 파일/디렉터리

| 경로 | 제거 전 |
| --- | --- |
| `/home/declan/bible` | 없음 (deleted, 프로세스가 open fd로 sqlite 유지) |
| `/home/declan/bible.shadow` | 없음 |
| `/home/declan/bible.prev` | 없음 (orphan cwd만 deleted 참조) |
| `/home/declan/bible.failed` | 없음 |
| `/home/declan/bible-data` | 없음 (`LETTERS_DATA_FILE`이 가리키던 경로) |
| `/home/declan/.config/bible.env` | 존재 (1270 bytes, 2026-07-06) |
| PM2 logs | `~/.pm2/logs/bible-*.log` 다수 |
| PM2 pids | `~/.pm2/pids/bible-31.pid`, `bible-32.pid` |

### open FD로 유지되던 DB (deleted)

프로세스 종료 전 `/proc/<pid>/fd`에서 확인:

- `/home/declan/bible/data/bible/bible.sqlite` (deleted)
- `/home/declan/bible/data/knowledge/crossrefs.sqlite` (+ wal/shm, deleted)
- `/home/declan/bible/data/passage-index/passage-index.sqlite` (deleted)

파일 경로 자체는 이미 없었고, 살아 있는 프로세스가 deleted inode를 붙잡고 있던 상태였다. 프로세스 종료와 함께 해제된다.

### nginx

| 항목 | 경로 |
| --- | --- |
| enabled | `/etc/nginx/sites-enabled/bible.ponslink.com` |
| enabled bak | `/etc/nginx/sites-enabled/bible.ponslink.com.adsense-bak` |
| available | `/etc/nginx/sites-available/bible.ponslink.com` |
| available bak | `/etc/nginx/sites-available/bible.ponslink.com.adsense-bak` |
| upstream | `proxy_pass http://127.0.0.1:3100` |
| TLS | `/etc/ssl/ponslink/ponslink.crt` (공유 인증서, bible 전용 LE cert 아님) |
| access/error logs | `/var/log/nginx/bible.ponslink.com.*.log*` |

### 환경 변수 키 (`bible.env` / PM2 env에 존재했던 키)

값 본문은 보고서에 기록하지 않는다. 키 목록만 남긴다.

- `ADMIN_DEBUG_TOKEN`
- `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`, `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `LETTERS_DATA_FILE`, `LETTERS_EMAIL_ENCRYPTION_KEY`
- `LETTERS_ENABLE_CODEX_IMAGEN`, `LETTERS_CODEX_IMAGEN_*`
- `LETTERS_CARD_IMAGE_DRIVE_FOLDER_ID`, `LETTERS_N8N_IMAGE_UPLOAD_URL`
- `PONSLINK_ADMIN_EMAILS`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- runtime: `NODE_ENV=production`, `PORT=3100`, `NODE_OPTIONS=--max-old-space-size=2048`

> 참고: 제거 과정에서 PM2 env dump에 시크릿 plaintext가 노출될 수 있다. 운영 시크릿(SMTP/OAuth/encryption key 등)은 재사용 예정이 없다면 회전(rotate)을 권장한다.

## 수행한 제거 작업

순서대로 실행:

1. `pm2 delete bible`
2. `pm2 save --force` (dump에서 bible 제거 반영)
3. orphan `next-server` pid `1766867` terminate (`kill` → `kill -9`)
4. `rm -f /home/declan/.config/bible.env`
5. `rm -rf /home/declan/bible /home/declan/bible.shadow /home/declan/bible.prev /home/declan/bible.failed /home/declan/bible-data` (이미 없어도 안전 삭제)
6. PM2 bible 로그/pid 삭제  
   - `~/.pm2/logs/bible-*.log`, `bible-out.log`, `bible-error.log`  
   - `~/.pm2/pids/bible-*.pid`
7. nginx site 제거  
   - sites-enabled / sites-available 의 `bible.ponslink.com` 및 `.adsense-bak`
8. `sudo nginx -t` 후 `sudo systemctl reload nginx`
9. nginx bible access/error 로그 삭제 (`/var/log/nginx/bible.ponslink.com.*`)

## 제거 후 검증

| 검사 | 결과 |
| --- | --- |
| `pm2 list` | `bible` 없음 (`pdf-master-api` stopped만 잔존 — 본 작업 범위 외) |
| `~/.pm2/dump.pm2` | bible 문자열 없음 |
| ports `3100` / `3110` | free |
| `next-server (v15.5.19)` 프로세스 | 없음 |
| `/home/declan/.config/bible.env` | 없음 |
| `/home/declan/bible*` / `bible-data` | 없음 |
| nginx sites-enabled bible | 없음 |
| nginx sites-available bible | 없음 |
| `/var/log/nginx/bible.*` | 없음 |
| `~/.pm2/logs/bible-*` | 없음 |
| `curl http://127.0.0.1:3100/api/runtime` | 실패/연결 불가 (기대 동작) |

### Host 헤더 동작 (의도된 residual)

`bible.ponslink.com` Host로 로컬 80/443에 요청하면 nginx **default** vhost가 응답할 수 있다 (관측: HTTP 200).  
이는 bible 앱이 살아있는 것이 아니라, 전용 server_name vhost 제거 후 default server로 fall-through 된 결과다.

## 범위 밖 / 후속 권장

로컬 git 저장소와 DNS/시크릿은 이번 제거 범위에 넣지 않았다.

| 항목 | 상태 | 권장 |
| --- | --- | --- |
| 로컬 코드베이스 (`~/Documents/Develop/Project/bible`) | 유지 | 저장소 자체 삭제가 필요하면 별도 지시 |
| `scripts/deploy-ponslink.sh`, `ecosystem.config.cjs` | 로컬에 유지 | 재배포 방지 목적이면 스크립트 비활성/삭제 검토 |
| DNS `bible.ponslink.com` | 미변경 | 서버를 더 이상 가리키지 않게 레코드 제거 또는 안내용 페이지로 전환 |
| 공유 TLS cert (`/etc/ssl/ponslink/*`) | 유지 | 다른 ponslink 사이트와 공유 — 삭제하지 않음 |
| SMTP/OAuth/encryption 시크릿 | 파일 삭제됨, 외부 provider 쪽 자격은 유효할 수 있음 | 폐기 시 키 회전 |
| Google Drive letter card folder / n8n webhook | 원격 설정만 제거 | 외부 리소스 정리 필요 시 별도 |
| `cardnews-assets` 등 타 서비스 디렉터리 | 유지 | bible 전용 아님 |

## 결론

ponslink 상의 bible production 배포는 프로세스·포트·env·nginx·로그 기준으로 제거 완료됐다.  
앱 디렉터리/DB 파일은 작업 전에 이미 삭제돼 있었고, deleted inode를 붙잡던 PM2/orphan 런타임까지 종료해 서비스 surface를 닫았다.

DNS와 외부 시크릿/스토리지는 운영 정책에 따라 추가 정리하면 된다.
