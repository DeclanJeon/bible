# 신앙 질문 지도 및 AI 질문 도우미 설계

작성일: 2026-06-24  
대상 서비스: `bible.ponslink.com`  
권장 신규 경로: `/ko/faith-questions`, `/en/faith-questions`

## 1. 배경

사용자가 처음 제기한 질문은 다음 범위였다.

- 천국이 무엇인가? 죽어서 가는 곳인가?
- 하나님은 누구신가? 하나님은 신이신가?
- 왜 세상에는 여러 신들이 있는가?
- 신앙 없이도 살 수 있는 것처럼 보이는 이유는 무엇인가?
- 왜 사람들은 신을 믿는가?
- 천국과 지옥은 무엇인가?
- 성경은 그냥 신화가 아닌가?
- 새신자만이 아니라 기존 신자도 이런 질문을 모를 수 있지 않은가?

조사 과정에서 GotQuestions 한국어 사이트가 방대한 주제별 Q&A를 이미 제공하고 있음을 확인했다. 다만 외부 사이트의 글은 가독성, 탐색성, 모바일 UX, 질문별 진입 경로 면에서 사용자가 바로 읽기 어렵다고 느낄 수 있다.

따라서 `bible.ponslink.com`이 해야 할 일은 외부 자료를 복제하는 것이 아니라, 성경 본문 중심의 질문 지도와 AI 기반 읽기 도우미를 제공하는 것이다.

## 2. 핵심 결론

`bible.ponslink.com`은 자체 Q&A 백과사전이 아니라 다음 역할을 맡는다.

> 성경 본문을 중심으로 핵심 신앙 질문을 분류하고, 선별된 외부 자료로 연결하며, AI가 사용자의 질문을 읽기 쉬운 방향으로 정리해 주는 신앙 질문 라우터.

권장 구조는 다음과 같다.

```txt
사용자 질문
↓
질문 의도/주제 분류
↓
관련 성경 본문 추천
↓
관련 외부 자료 링크 추천
↓
AI가 짧고 읽기 쉬운 안내 답변 생성
↓
원문 링크와 성경 본문으로 이동
```

## 3. 하지 말아야 할 것

### 3.1 GotQuestions 전체 본문 저장 금지

GotQuestions의 방대한 글을 전부 크롤링해서 로컬 DB에 저장하는 방식은 권장하지 않는다.

문제점:

- 저작권 및 이용약관 리스크
- 콘텐츠 최신성 유지 어려움
- 크롤링 및 색인 비용 증가
- 서버비용 증가
- 외부 원문 트래픽과 출처 존중 문제
- 개발 및 검수 시간이 과도하게 증가

### 3.2 AI가 출처 없이 신앙 답변 생성 금지

AI가 일반 지식만으로 “기독교 답변”을 생성하면 환각과 교리적 오류 위험이 있다. 반드시 성경 본문과 선별된 링크 메타데이터를 함께 제시해야 한다.

### 3.3 외부 자료 전문을 무단 요약 저장 금지

외부 글 전문을 장기 저장하거나 재배포하는 구조는 피한다. 필요할 경우 2단계 기능으로 URL별 짧은 요약 캐시만 검토하되, 원문 전문 저장은 하지 않는다.

## 4. 페이지 컨셉

### 4.1 페이지명

권장 이름:

```txt
신앙 질문 지도
```

영문:

```txt
Faith Questions Map
```

권장 경로:

```txt
/ko/faith-questions
/en/faith-questions
```

### 4.2 상단 설명문

권장 문구:

> 처음 믿는 사람만이 아니라, 오래 믿었지만 다시 묻고 싶은 사람을 위한 질문 지도입니다. 하나님, 예수, 성령, 구원, 성경, 천국과 지옥, 여러 종교, 신앙의 이유를 성경 본문과 검증 가능한 외부 자료로 연결합니다.

AI 기능을 포함할 경우:

> 질문을 입력하면 성경 본문과 선별된 외부 자료로 연결합니다. AI 답변은 최종 권위가 아니라 읽기 쉬운 안내이며, 핵심 판단은 성경 본문과 원문 자료에서 확인하세요.

## 5. 대상 사용자

이 페이지는 “새신자 전용”이 아니다.

대상:

1. 기독교를 처음 접하는 사람
2. 오래 믿었지만 핵심 교리를 다시 정리하고 싶은 신자
3. 의심과 회의가 있는 사람
4. 누군가에게 신앙을 설명해야 하는 사람
5. 성경 본문과 외부 자료를 함께 탐색하려는 사람

따라서 “새신자 질문”이라는 이름보다 “신앙 질문 지도”가 적절하다.

## 6. 정보 구조

```txt
신앙 질문 지도
├─ 상단: 페이지 목적 및 AI 질문 입력
├─ 핵심 질문 카드
│  ├─ 하나님은 누구신가?
│  ├─ 예수는 누구신가?
│  ├─ 성령은 누구신가?
│  ├─ 구원이란 무엇인가?
│  ├─ 천국은 무엇인가?
│  ├─ 지옥은 무엇인가?
│  ├─ 성경은 믿을 만한가?
│  ├─ 왜 여러 종교가 있는가?
│  ├─ 왜 신앙 없이도 살 수 있는 것처럼 보이는가?
│  └─ 인간은 어떤 존재인가?
├─ 읽기 경로
│  ├─ 처음 묻는 사람
│  ├─ 다시 정리하는 신자
│  ├─ 회의적인 사람
│  └─ 설명해야 하는 사람
├─ GotQuestions 전체 Q&A 카테고리
│  ├─ 핵심 입문
│  ├─ 하나님과 삼위일체
│  ├─ 구원과 신앙생활
│  ├─ 성경과 신학
│  ├─ 교회와 종말
│  ├─ 인간, 세계관, 변증
│  ├─ 종교, 이단, 거짓교리
│  └─ 삶의 문제
└─ 외부 추천 자료
   ├─ BibleProject
   ├─ GotQuestions
   ├─ Reasonable Faith
   ├─ 잘잘법
   └─ 생각하는 기독교
```

## 7. 핵심 질문 카드 설계

각 질문 카드는 다음 정보를 가진다.

- 질문 제목
- 짧은 방향성
- 관련 성경 본문
- 관련 외부 링크
- 난이도 배지: `입문`, `성경개관`, `변증`, `깊이읽기`, `영상`, `영어`

### 7.1 하나님은 누구신가?

짧은 방향:

> 성경의 하나님은 막연한 신적 힘이 아니라 창조주, 인격적 하나님, 사랑과 거룩과 정의의 하나님으로 계시됩니다.

성경 본문:

- Genesis 1:1
- Exodus 3:14
- John 1:1–18
- Acts 17:24–31
- 1 John 4:7–12

자료:

- BibleProject — God  
  https://bibleproject.com/videos/god-video/
- GotQuestions — 하나님은 누구신가?  
  https://www.gotquestions.org/Korean/Korean-who-is-God.html
- GotQuestions — 하나님은 영이신가?  
  https://www.gotquestions.org/Korean/Korean-God-is-spirit.html
- GotQuestions — 하나님은 실제로 존재하시는가?  
  https://www.gotquestions.org/Korean/Korean-Is-God-Real.html
- GotQuestions — 하나님은 존재하시는가?  
  https://www.gotquestions.org/Korean/Korean-Does-God-Exist.html

### 7.2 천국은 죽어서 가는 곳인가?

짧은 방향:

> 성경의 소망은 단순히 육체를 떠난 영혼의 탈출이 아니라, 하나님 나라, 그리스도와 함께 있음, 부활, 새 하늘과 새 땅으로 이어집니다.

성경 본문:

- Matthew 6:10
- Luke 23:43
- John 14:1–3
- 1 Corinthians 15
- Revelation 21:1–5

자료:

- BibleProject — Heaven and Earth  
  https://bibleproject.com/videos/heaven-and-earth/
- BibleProject — Heaven & Hell Podcast  
  https://bibleproject.com/podcasts/series/heaven-hell/
- BibleProject — Gospel of the Kingdom  
  https://bibleproject.com/explore/video/gospel-kingdom/
- GotQuestions — 천국과 지옥에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-eternity.html

### 7.3 지옥은 무엇인가?

짧은 방향:

> 지옥은 단순한 공포 이미지가 아니라 죄, 심판, 하나님과의 분리, 새 창조 밖에 남는 상태와 연결해 다루어야 합니다.

성경 본문:

- Matthew 10:28
- Matthew 25:31–46
- Mark 9:43–48
- Revelation 20:11–15

자료:

- GotQuestions — 천국과 지옥에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-eternity.html
- BibleProject — Heaven & Hell Podcast  
  https://bibleproject.com/podcasts/series/heaven-hell/
- 잘잘법 — Is Hell Really Real? / 김학철 교수  
  https://www.youtube.com/watch?v=MkI_5im80Lg
- 잘잘법 — 기독교인이 꼭 알아야 할 천국·부활·지옥  
  https://www.youtube.com/watch?v=QppRHVKBPP0

### 7.4 왜 사람들은 신을 믿는가?

짧은 방향:

> 사람은 의미, 도덕, 죽음, 고통, 아름다움, 존재의 이유를 묻습니다. 기독교는 이 질문들을 창조주 하나님, 하나님의 형상, 죄와 구속, 부활 소망 안에서 다룹니다.

성경 본문:

- Ecclesiastes 3:11
- Psalm 19:1–4
- Romans 1:19–20
- Acts 17:22–31

자료:

- GotQuestions — 하나님 존재 논증  
  https://www.gotquestions.org/Korean/Korean-argument-existence-God.html
- GotQuestions — 하나님이 존재하는지 왜 중요한가?  
  https://www.gotquestions.org/Korean/Korean-care-God-exists.html
- Reasonable Faith — Existence and Nature of God  
  https://www.reasonablefaith.org/writings/popular-writings/existence-nature-of-god/
- 잘잘법 — 보이지도 않는 신을 왜 믿는 거지?  
  https://www.youtube.com/watch?v=PFrtA9TUmZY

### 7.5 왜 세상에는 여러 신들과 종교가 있는가?

짧은 방향:

> 성경은 인간의 종교적 갈망을 인정하면서도 우상과 참 하나님을 구분합니다. 기독교의 주장은 여러 신들 중 하나를 고르는 문제가 아니라 창조주 하나님과 그리스도의 계시를 어떻게 이해할 것인가의 문제입니다.

성경 본문:

- Exodus 20:1–6
- Deuteronomy 6:4
- Isaiah 44
- Acts 17:22–31
- 1 Corinthians 8:4–6

자료:

- GotQuestions — 유일신론  
  https://www.gotquestions.org/Korean/Korean-monotheism.html
- GotQuestions — 이단과 종교에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-religions.html
- Reasonable Faith — Christianity and Other Faiths  
  https://www.reasonablefaith.org/writings/popular-writings/christianity-other-faiths/

### 7.6 성경은 그냥 신화가 아닌가?

짧은 방향:

> 성경에는 시, 비유, 묵시, 역사 서술, 복음서, 서신 등 다양한 장르가 있습니다. “신화인가 역사인가”는 단순히 한 단어로 끝낼 문제가 아니라 장르, 사본, 역사성, 부활 증언을 함께 검토해야 합니다.

성경 본문:

- Luke 1:1–4
- John 20:30–31
- 1 Corinthians 15:3–8
- 2 Timothy 3:16–17
- 2 Peter 1:16

자료:

- GotQuestions — 성경은 신화인가?  
  https://www.gotquestions.org/Korean/Korean-Bible-mythology.html
- GotQuestions — 성경은 믿을 만한가?  
  https://www.gotquestions.org/Korean/Korean-Bible-reliable.html
- GotQuestions — 성경은 동화인가?  
  https://www.gotquestions.org/Korean/Korean-Bible-fairy-tale.html
- GotQuestions — 왜 성경을 믿어야 하는가?  
  https://www.gotquestions.org/Korean/Korean-why-should-I-believe-the-Bible.html
- 생각하는 기독교 — 성경, 신화인가 역사인가?  
  https://www.youtube.com/watch?v=WJK74j0jPG0
- 생각하는 기독교 — 성경, 왜 믿을 수 있는가?  
  https://www.youtube.com/watch?v=JwYPaCe6ZcI

### 7.7 굳이 신앙 없이도 살 수 있지 않은가?

짧은 방향:

> 사람은 신앙 없이도 일상생활을 할 수 있습니다. 하지만 기독교가 묻는 질문은 단순 생존이 아니라 존재의 근거, 선악의 기준, 죽음 이후의 소망, 하나님과의 관계입니다.

성경 본문:

- Mark 8:36
- John 10:10
- Acts 17:24–31
- Romans 2:14–16
- Ecclesiastes 12:13

자료:

- GotQuestions — 신앙은 나약한 사람의 버팀목인가?  
  https://www.gotquestions.org/Korean/Korean-faith-God-crutch.html
- GotQuestions — 하나님이 존재하는지 왜 중요한가?  
  https://www.gotquestions.org/Korean/Korean-care-God-exists.html
- Reasonable Faith — Non-belief and Disbelief  
  https://www.reasonablefaith.org/writings/question-answer/non-belief-and-disbelief/

### 7.8 인간은 어떤 존재인가? 몸만 있는가?

짧은 방향:

> 성경은 인간을 몸, 생명, 마음, 영, 혼 같은 다양한 언어로 설명합니다. 영·혼·육 구분은 유익한 지도일 수 있지만, 사람을 기계적 부품처럼 쪼개는 방식은 피해야 합니다.

성경 본문:

- Genesis 1:26–27
- 1 Thessalonians 5:23
- Hebrews 4:12
- Romans 12:1–2
- 1 Corinthians 6:19–20

자료:

- 내부 페이지 — 영혼육 입체 성경 지도  
  `/ko/spirit-soul-body`
- GotQuestions — 인간은 두 부분인가, 세 부분인가?  
  https://www.gotquestions.org/Korean/Korean-body-soul-spirit.html
- GotQuestions — 인간의 영과 혼의 다른 점은?  
  https://www.gotquestions.org/Korean/Korean-soul-spirit.html
- GotQuestions — 인간 영혼은 무엇인가?  
  https://www.gotquestions.org/Korean/Korean-human-soul.html
- BibleProject — Nephesh / Soul  
  https://bibleproject.com/videos/nephesh-soul/
- BibleProject — Holy Spirit / Ruakh  
  https://bibleproject.com/videos/holy-spirit/
- BibleProject — Nephesh Q+R  
  https://bibleproject.com/podcasts/nepheshsoul-qr/

## 8. 읽기 경로 설계

### 8.1 처음 기독교를 접하는 사람

```txt
1. 하나님은 누구신가?
2. 예수는 누구신가?
3. 복음은 무엇인가?
4. 하나님 나라는 무엇인가?
5. 천국과 지옥은 무엇인가?
6. 성경은 어떤 책인가?
```

### 8.2 믿지만 정리가 안 된 사람

```txt
1. 하나님 나라와 천국
2. 복음과 구원
3. 성령과 새 생명
4. 성경의 큰 이야기
5. 부활과 새 창조
6. 인간, 영혼, 몸의 이해
```

### 8.3 의심과 회의가 많은 사람

```txt
1. 하나님이 존재하는가?
2. 왜 여러 종교가 있는가?
3. 성경은 신화인가?
4. 예수의 부활은 믿을 만한가?
5. 악과 고통은 왜 있는가?
```

### 8.4 누군가에게 설명해야 하는 사람

```txt
1. 질문을 공격으로 받지 않기
2. 짧은 답과 긴 답을 구분하기
3. 성경 본문으로 연결하기
4. 변증 자료로 보완하기
5. 모르는 것은 모른다고 말하기
```

## 9. GotQuestions 한국어 카테고리 링크

GotQuestions 한국어 메인:

- https://www.gotquestions.org/Korean/

검색:

- https://www.gotquestions.org/Korean/Korean-search.html

### 9.1 핵심 입문

- 복음제시  
  https://www.gotquestions.org/Korean/Korean-good-news.html
- 핵심적인 질문들  
  https://www.gotquestions.org/Korean/Korean-crucial.html
- 대중적인 질문들  
  https://www.gotquestions.org/Korean/Korean-FAQ.html

### 9.2 하나님과 삼위일체

- 하나님에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-God.html
- 예수 그리스도에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-Jesus.html
- 성령에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-Spirit.html

### 9.3 구원과 신앙생활

- 구원에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-salvation.html
- 신앙생활에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-Christian.html
- 기도에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-prayer.html
- 죄에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-sin.html

### 9.4 성경과 신학

- 성경에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-Bible.html
- 성경 개관 / 요약  
  https://www.gotquestions.org/Korean/Korean-Q-Bible-Survey.html
- 성경에 나오는 사람들에 대한 질문  
  https://www.gotquestions.org/Korean/Korean-Q-Bible-people.html
- 신학에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-theology.html

### 9.5 교회와 종말

- 교회에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-church.html
- 종말에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-end-times.html
- 천국과 지옥에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-eternity.html
- 천사와 악마에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-angels.html

### 9.6 인간, 세계관, 변증

- 인간에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-humanity.html
- 세계관에 대한 질문  
  https://www.gotquestions.org/Korean/Korean-Q-Apologetics-Worldview.html
- 창조에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-creation.html

### 9.7 종교, 이단, 거짓교리

- 이단과 종교에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-religions.html
- 거짓교리에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-false.html

### 9.8 삶의 문제

- 결혼에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-marriage.html
- 연애에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-relationships.html
- 가족과 자녀양육에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-family.html
- 인생결정에 관한 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-life.html
- 시사적인 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-topical.html
- 기타 질문들  
  https://www.gotquestions.org/Korean/Korean-Q-miscellaneous.html

## 10. 조사된 주요 외부 자료

### 10.1 BibleProject

- Korean landing  
  https://bibleproject.com/korean/
- God  
  https://bibleproject.com/videos/god-video/
- Heaven and Earth  
  https://bibleproject.com/videos/heaven-and-earth/
- Heaven & Hell Podcast  
  https://bibleproject.com/podcasts/series/heaven-hell/
- Gospel of the Kingdom  
  https://bibleproject.com/explore/video/gospel-kingdom/
- How To Read Gospel  
  https://bibleproject.com/videos/how-to-read-gospel/
- What Are the Gospels?  
  https://bibleproject.com/articles/what-are-the-gospels/
- Image of God  
  https://bibleproject.com/explore/video/image-of-god
- New Testament guides  
  https://bibleproject.com/guides/categories/new-testament/
- Themes  
  https://bibleproject.com/guides/categories/themes
- Nephesh / Soul  
  https://bibleproject.com/videos/nephesh-soul/
- Holy Spirit / Ruakh  
  https://bibleproject.com/videos/holy-spirit/
- Who Is the Holy Spirit?  
  https://bibleproject.com/guides/holy-spirit/
- Nephesh / Soul E1: You Are a Soul  
  https://bibleproject.com/podcasts/you-are-soul/
- Nephesh / Soul E2: Let’s Get Physical  
  https://bibleproject.com/podcasts/lets-get-physical/
- Nephesh / Soul E3: What Happens After We Die?  
  https://bibleproject.com/podcasts/what-happens-after-we-die/
- Nephesh / Soul E4 Q+R  
  https://bibleproject.com/podcasts/nepheshsoul-qr/

### 10.2 GotQuestions 한국어 직접 링크

하나님:

- https://www.gotquestions.org/Korean/Korean-Trinity.html
- https://www.gotquestions.org/Korean/Korean-Does-God-Exist.html
- https://www.gotquestions.org/Korean/Korean-Is-God-Real.html
- https://www.gotquestions.org/Korean/Korean-Attributes-God.html
- https://www.gotquestions.org/Korean/Korean-who-created-God.html
- https://www.gotquestions.org/Korean/Korean-God-is-love.html
- https://www.gotquestions.org/Korean/Korean-monotheism.html
- https://www.gotquestions.org/Korean/Korean-who-is-God.html
- https://www.gotquestions.org/Korean/Korean-God-is-spirit.html
- https://www.gotquestions.org/Korean/Korean-God-require-faith.html
- https://www.gotquestions.org/Korean/Korean-argument-existence-God.html
- https://www.gotquestions.org/Korean/Korean-God-hidden.html
- https://www.gotquestions.org/Korean/Korean-is-God-a-person.html
- https://www.gotquestions.org/Korean/Korean-what-is-God.html
- https://www.gotquestions.org/Korean/Korean-care-God-exists.html

성경:

- https://www.gotquestions.org/Korean/Korean-Bible-Word.html
- https://www.gotquestions.org/Korean/Korean-Bible-errors.html
- https://www.gotquestions.org/Korean/Korean-canon-Bible.html
- https://www.gotquestions.org/Korean/Korean-study-Bible.html
- https://www.gotquestions.org/Korean/Korean-why-read-Bible.html
- https://www.gotquestions.org/Korean/Korean-bible-corrupted.html
- https://www.gotquestions.org/Korean/Korean-what-is-the-bible.html
- https://www.gotquestions.org/Korean/Korean-proof-inspiration-Bible.html
- https://www.gotquestions.org/Korean/Korean-which-book.html
- https://www.gotquestions.org/Korean/Korean-Bible-mythology.html
- https://www.gotquestions.org/Korean/Korean-Bible-reliable.html
- https://www.gotquestions.org/Korean/Korean-dead-sea-scrolls.html
- https://www.gotquestions.org/Korean/Korean-Bible-fairy-tale.html
- https://www.gotquestions.org/Korean/Korean-why-should-I-believe-the-Bible.html

영·혼·육 / 인간론:

- https://www.gotquestions.org/Korean/Korean-body-soul-spirit.html
- https://www.gotquestions.org/Korean/Korean-soul-spirit.html
- https://www.gotquestions.org/Korean/Korean-human-soul.html

세계관/변증:

- https://www.gotquestions.org/Korean/Korean-faith-God-crutch.html
- https://www.gotquestions.org/Korean/Korean-proof-of-God.html
- https://www.gotquestions.org/Korean/Korean-what-is-truth.html

### 10.3 Reasonable Faith

- Q&A category  
  https://www.reasonablefaith.org/writings/question-answer
- Existence and Nature of God  
  https://www.reasonablefaith.org/writings/popular-writings/existence-nature-of-god/
- Apologetics  
  https://www.reasonablefaith.org/writings/popular-writings/apologetics/
- Jesus of Nazareth  
  https://www.reasonablefaith.org/writings/popular-writings/jesus-of-nazareth/
- Christianity and Other Faiths  
  https://www.reasonablefaith.org/writings/popular-writings/christianity-other-faiths/
- Non-belief and Disbelief  
  https://www.reasonablefaith.org/writings/question-answer/non-belief-and-disbelief/
- A Moral But Unbelieving Son  
  https://www.reasonablefaith.org/writings/question-answer/a-moral-but-unbelieving-son/

### 10.4 기타 영어 변증/입문 자료

- Alpha  
  https://alpha.org/
- Christianity Explored  
  https://www.christianityexplored.org/
- Stand to Reason  
  https://www.str.org/
- Cold Case Christianity  
  https://coldcasechristianity.com/
- BeThinking  
  https://www.bethinking.org/
- Cross Examined  
  https://crossexamined.org/

### 10.5 조사된 YouTube 자료

새신자/기초:

- 두란노 — 새신자들을 위한 복음 수업  
  https://www.youtube.com/watch?v=04JPVvM5z8c
- 잘잘법 — 기독교 핵심 단어의 뜻  
  https://www.youtube.com/watch?v=lBI8OU5z4PI
- 매일청종 — [새신자 시리즈 01] 하나님은 누구이신가 (1) / 이재철 목사  
  https://www.youtube.com/watch?v=zhS8fkOmYk0
- 매일청종 — [New Believer Series 02] Who Is God? (2) / Pastor Jae-cheol Lee  
  https://www.youtube.com/watch?v=fOuN7bSUqkw

천국/지옥:

- 김동호 목사 아카이브 — 크리스천 베이직 #40 죽음 이후, 천국과 지옥  
  https://www.youtube.com/watch?v=DEPR2k6fDyE
- 잘잘법 — Is Hell Really Real? / 김학철 교수  
  https://www.youtube.com/watch?v=MkI_5im80Lg
- 잘잘법 — 기독교인이 꼭 알아야 할 천국·부활·지옥  
  https://www.youtube.com/watch?v=QppRHVKBPP0

왜 믿는가 / 신 존재:

- 잘잘법 — 보이지도 않는 신을 왜 믿는 거지?  
  https://www.youtube.com/watch?v=PFrtA9TUmZY
- 최재천의 아마존 — 인간이 신을 믿는 이유는 알고보면 과학적이다?  
  https://www.youtube.com/watch?v=Cwrh2J9gpI8
- tvN Joy — 김상욱 종교 관련 클립  
  https://www.youtube.com/watch?v=asGKOTRTobE
- 충코 철학 — 옥스포드 과학자가 깨달은 인간이 신을 믿는 이유  
  https://www.youtube.com/watch?v=fvwAEI8F_ys

성경/신화/역사:

- 생각하는 기독교 — 2025 기독교변증컨퍼런스 | 성경, 신화인가 역사인가?  
  https://www.youtube.com/watch?v=WJK74j0jPG0
- 청주서문교회 — 2025 기독교변증컨퍼런스 | 성경, 신화인가 역사인가?  
  https://www.youtube.com/watch?v=j4dWKQuWOIg
- 오늘의 신학공부 — Is the Bible a patchwork of myths?  
  https://www.youtube.com/watch?v=KJartzmzZiM
- 생각하는 기독교 — 창세기, 고대 메소포타미아 신화에서 베낀 것인가?  
  https://www.youtube.com/watch?v=LZHa9IACS8Y
- 생각하는 기독교 — 성경, 왜 믿을 수 있는가?  
  https://www.youtube.com/watch?v=JwYPaCe6ZcI

주의:

- YouTube 검색 중 신천지 계열 결과가 섞여 나왔다. 예: `신천지인천티비`. 메인 추천 자료에서는 제외해야 한다.

## 11. AI 기능 설계

### 11.1 AI의 역할

AI는 최종 교리 권위자가 아니다. 역할은 다음으로 제한한다.

1. 사용자의 질문을 쉬운 언어로 정리
2. 질문 주제 분류
3. 관련 성경 본문 추천
4. 관련 외부 자료 링크 추천
5. 읽기 쉬운 짧은 답변 제공
6. 추가로 생각할 질문 제안

AI가 해야 할 말:

> 이 주제는 다음 성경 본문과 외부 자료에서 더 깊게 확인할 수 있습니다.

AI가 피해야 할 말:

> GotQuestions는 이렇게 말합니다.

단, 실제로 해당 URL 본문을 실시간으로 읽은 경우에만 “해당 글은…”이라고 표현할 수 있다.

### 11.2 답변 형식

권장 답변 구조:

```txt
짧은 답
성경으로 확인하기
더 깊게 보기
주의할 점
다음 질문
```

예시:

```txt
짧은 답:
성경에서 천국은 단순히 “죽어서 영혼이 가는 장소”만은 아닙니다. 하나님의 다스림, 그리스도와 함께 있음, 부활, 새 하늘과 새 땅의 소망이 함께 들어 있습니다.

성경으로 확인하기:
- Matthew 6:10
- Luke 23:43
- John 14:1–3
- 1 Corinthians 15
- Revelation 21:1–5

더 깊게 보기:
- BibleProject — Heaven and Earth
- GotQuestions — 천국과 지옥에 관한 질문들
```

### 11.3 시스템 프롬프트 방향

```txt
너는 신앙 질문 도우미다.
답변은 제공된 성경 본문과 제공된 링크 메타데이터를 근거로 작성한다.
외부 자료 전문을 읽지 않은 경우, 그 글의 세부 내용을 본 것처럼 말하지 않는다.
출처 링크를 반드시 표시한다.
확실하지 않은 내용은 확정하지 않는다.
교파 차이가 있을 수 있는 주제는 차이를 명시한다.
답변은 사용자가 원문으로 이동할 수 있게 안내한다.
```

## 12. 구현 옵션

### 12.1 옵션 A: 링크 메타데이터 기반 MVP

권장 1단계.

특징:

- 외부 링크 전문 저장 없음
- 링크 제목, URL, 짧은 설명, 태그, 난이도만 정적 데이터로 보관
- 질문을 태그와 성경 본문에 매칭
- AI가 짧은 안내 답변 생성
- 관련 원문 링크 제공

장점:

- 서버비용 낮음
- 구현 빠름
- 저작권 리스크 낮음
- 응답 빠름
- 유지보수 쉬움

단점:

- 외부 글의 세부 문장에 근거한 답변은 불가
- “해당 글에 따르면” 같은 강한 인용은 피해야 함

### 12.2 옵션 B: 실시간 링크 읽기 요약

2단계 후보.

특징:

- 사용자가 특정 링크 요약을 요청하면 서버가 해당 URL을 실시간으로 읽음
- 본문 일부를 추출해 AI가 읽기 쉽게 요약
- 원문 전문은 저장하지 않음
- URL별 짧은 요약 캐시만 제한적으로 사용 가능

장점:

- 가독성 문제를 직접 해결
- 원문 내용을 바탕으로 더 구체적 답변 가능

단점:

- 느림
- 외부 사이트 장애에 의존
- 캐싱 정책 필요
- 이용약관 및 저작권 검토 필요
- 서버비용 증가

권장 캐시 정책:

- URL별 요약만 저장
- 원문 전문 저장 금지
- 7일 또는 30일 만료
- 원문 링크 항상 표시

### 12.3 옵션 C: 자료 비교 모드

3단계 후보.

예시 질문:

> 천국에 대해 GotQuestions와 BibleProject가 어떻게 다르게 설명해?

응답 방향:

- 공통점
- 강조 차이
- 먼저 읽을 자료
- 성경 본문

## 13. 데이터 모델 초안

### 13.1 외부 자료

```ts
type FaithResource = {
  id: string;
  title: string;
  href: string;
  source: "GotQuestions" | "BibleProject" | "ReasonableFaith" | "YouTube" | "Other";
  language: "ko" | "en";
  kind: "article" | "video" | "podcast" | "course" | "category";
  level: "intro" | "middle" | "deep";
  topics: string[];
  questions: string[];
  summary: string;
};
```

### 13.2 질문 노드

```ts
type QuestionNode = {
  id: string;
  title: Record<AppLocale, string>;
  shortAnswer: Record<AppLocale, string>;
  audience: ("beginner" | "believer" | "skeptic" | "teacher")[];
  themes: string[];
  passages: PassageLink[];
  resources: string[];
};
```

### 13.3 질문 결과

```ts
type FaithQuestionAnswer = {
  summary: string;
  caveat: string;
  passages: PassageLink[];
  resources: FaithResource[];
  nextQuestions: string[];
};
```

## 14. 코드 적용 계획

기존 프로젝트에는 이미 AI/RAG 관련 코드가 있다.

관련 파일:

- `lib/hermes.ts`
- `lib/retrieval.ts`
- `lib/embeddings.ts`
- `lib/passage-response.ts`

권장 추가 파일:

```txt
lib/faith-resources.ts
lib/faith-question-router.ts
app/[locale]/faith-questions/page.tsx
app/api/faith-questions/route.ts
```

### 14.1 `lib/faith-resources.ts`

역할:

- 외부 자료 메타데이터 보관
- GotQuestions 카테고리 링크 보관
- 핵심 질문별 추천 자료 보관

### 14.2 `lib/faith-question-router.ts`

역할:

- 사용자 질문의 키워드/태그 매칭
- 관련 질문 노드 반환
- 관련 성경 본문 반환
- 관련 외부 링크 반환

초기에는 규칙 기반으로 충분하다.

예:

```ts
const TOPIC_KEYWORDS = {
  heaven: ["천국", "하늘나라", "죽어서", "죽으면", "afterlife", "heaven"],
  hell: ["지옥", "심판", "hell"],
  god: ["하나님", "신", "창조주", "god"],
  bible: ["성경", "신화", "역사", "믿을만", "bible", "myth"],
};
```

### 14.3 `app/[locale]/faith-questions/page.tsx`

역할:

- 정적 질문 지도 렌더링
- 질문 입력 폼 제공
- 핵심 질문 카드
- GotQuestions 전체 카테고리 링크
- 외부 추천 자료

### 14.4 `app/api/faith-questions/route.ts`

역할:

- 사용자 질문 수신
- `faith-question-router`로 자료 후보 추출
- Hermes/AI 답변 생성
- 관련 성경 본문 및 외부 링크 반환

## 15. UX 설계

### 15.1 상단

```txt
신앙 질문 지도
처음 묻는 사람과 다시 정리하려는 신자를 위한 성경 중심 질문 지도입니다.
질문을 입력하면 성경 본문과 검증 가능한 외부 자료로 연결합니다.
```

입력 예시:

- 천국은 죽어서 가는 곳인가요?
- 성경은 신화인가요?
- 왜 하나님을 믿어야 하나요?
- 왜 여러 종교가 있나요?
- 예수는 누구인가요?

### 15.2 결과 카드

```txt
답변 요약
성경으로 확인하기
관련 자료
더 깊은 질문
```

### 15.3 GotQuestions 전체 Q&A 섹션

제목:

```txt
더 많은 질문은 GotQuestions 한국어에서 찾기
```

설명:

> 아래 링크들은 GotQuestions 한국어의 주제별 Q&A 모음입니다. 이 사이트는 핵심 질문의 방향과 성경 본문을 연결하고, 세부 질문은 원문 Q&A로 이동해 확인하도록 설계했습니다.

버튼:

- GotQuestions 한국어 전체 Q&A 보기
- GotQuestions 검색하기

### 15.4 주의 문구

답변 상단 또는 하단에 표시:

> 이 답변은 성경 본문과 선별된 외부 자료로 이동하기 위한 안내입니다. 교리적 판단은 성경 본문, 신뢰할 수 있는 공동체, 원문 자료와 함께 확인하세요.

## 16. 영혼육 페이지와의 관계

`/ko/spirit-soul-body`는 별도 독립 주제 페이지로 유지한다.

`/ko/faith-questions`에서는 다음 질문 카드에서 내부 링크로 연결한다.

```txt
인간은 어떤 존재인가? 몸만 있는가?
```

연결 자료:

- `/ko/spirit-soul-body`
- 1 Thessalonians 5:23
- Hebrews 4:12
- Romans 12:1–2
- BibleProject — Nephesh / Soul
- GotQuestions — 인간은 두 부분인가, 세 부분인가?

## 17. 네비게이션 제안

현재 nav에 `신앙의 기본`이 있다.

선택지:

### 안 A: nav에 직접 추가

```txt
신앙 질문
성경
공부 레인
영혼육
리뷰
```

장점: 새 기능 노출이 좋다.  
단점: nav 항목 증가.

### 안 B: `신앙의 기본` 내부에서 크게 연결

```txt
신앙의 기본 → 신앙 질문 지도 CTA
```

장점: nav 간결.  
단점: 핵심 기능 노출이 약하다.

권장: AI 질문 도우미가 핵심 기능이 될 경우 안 A.

## 18. 검증 기준

MVP 구현 후 확인할 것:

1. `/ko/faith-questions`가 정상 렌더링된다.
2. 핵심 질문 카드에서 내부 성경 링크가 `/ko/bible`로 이동한다.
3. 외부 링크는 새 탭으로 열리고 `rel="noreferrer"`를 사용한다.
4. AI 답변은 출처 없이 단정하지 않는다.
5. GotQuestions 글 전문을 저장하지 않는다.
6. 질문 입력 예시 5개가 예상 주제로 라우팅된다.
7. 모바일에서 카드와 결과가 읽기 좋다.

테스트 질문:

- 천국은 죽어서 가는 곳인가요?
- 성경은 신화인가요?
- 하나님은 누구신가요?
- 왜 여러 종교가 있나요?
- 신앙 없이도 살 수 있지 않나요?
- 사람은 영혼육으로 되어 있나요?

## 19. 단계별 실행 계획

### 1단계: 정적 허브

- `/ko/faith-questions` 페이지 생성
- 핵심 질문 카드 추가
- GotQuestions 카테고리 링크 추가
- BibleProject/ReasonableFaith/YouTube 추천 자료 추가
- 내부 성경 본문 링크 연결

### 2단계: 규칙 기반 질문 라우터

- `lib/faith-resources.ts`
- `lib/faith-question-router.ts`
- 질문 입력 시 관련 카드/본문/자료 추천
- AI 없이도 동작 가능하게 설계

### 3단계: AI 안내 답변

- `/api/faith-questions` 추가
- Hermes 기반 짧은 답변 생성
- 답변은 제공된 본문/링크 메타데이터로 제한
- 출처 링크 필수 표시

### 4단계: 실시간 링크 요약

- 사용자가 명시적으로 요청한 URL만 읽기
- 원문 전문 저장 금지
- 짧은 요약 캐시만 제한적으로 사용
- 원문 링크 항상 표시

### 5단계: 자료 비교 모드

- GotQuestions / BibleProject / ReasonableFaith 강조점 비교
- 공통점과 차이점 분리
- 교파 차이 가능성 표시

## 20. 최종 판단

이 기능은 넣을 가치가 있다.

단, 핵심은 “AI가 신앙 답변을 대신 생성한다”가 아니다.

올바른 방향은 다음이다.

> AI는 읽기 쉬운 안내자이고, 성경 본문과 외부 원문이 실제 근거다.

`bible.ponslink.com`은 다음 세 가지를 결합해야 한다.

1. 성경 본문 중심성
2. 선별된 외부 자료 링크
3. AI 기반 질문 라우팅 및 쉬운 요약

이렇게 설계하면 GotQuestions의 방대한 자료를 활용하면서도 서버비용, 저작권, 유지보수 부담을 낮추고, 사용자는 낡은 UI의 긴 글에 바로 던져지지 않고 읽기 쉬운 길을 먼저 얻을 수 있다.
