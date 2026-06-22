# Hanja Full-Link Harvest Checklist

## 0. Source sync
- [ ] `/home/declan/Documents/Obsidian Vault/신학/관련링크.md` → `data/hanja/import/related-links.md` 동기화 절차 고정
- [ ] import timestamp 기록
- [ ] source line numbers 유지

## 1. Manifest
- [ ] 모든 링크를 `manifest.json`에 수집
- [ ] source type 분류
- [ ] stance / catalogRole 유지
- [ ] channel / search / book / article / pdf 구분

## 2. Harvest
- [ ] article/blog/church page raw text snapshot
- [ ] pdf/paper text extraction
- [ ] youtube video metadata + transcript
- [ ] youtube channel expansion
- [ ] RISS/Baidu search result snapshot
- [ ] bookstore metadata snapshot
- [ ] fetch failure state 저장

## 3. Extraction
- [ ] title/body 한자 전수 추출
- [ ] 한자 context window 저장
- [ ] 성구 추출/정규화
- [ ] claim segment 추출
- [ ] keyword/topic 추출

## 4. Publish layer
- [ ] `published-characters.json` 생성
- [ ] `/hanja`에서 harvested characters 노출
- [ ] generated detail page fallback 구현
- [ ] curated entry 우선 merge 규칙 구현

## 5. Provenance / quality
- [ ] original URL 유지
- [ ] fetchedAt 유지
- [ ] fetch method 유지
- [ ] low-confidence implicit mapping 비주요 노출
- [ ] supportive / critical 분리 유지

## 6. Verification
- [ ] manifest count == imported link count
- [ ] source type coverage 검증
- [ ] harvested source sample browser QA
- [ ] generated hanja list browser QA
- [ ] generated detail page browser QA
- [ ] extraction fixture QA
