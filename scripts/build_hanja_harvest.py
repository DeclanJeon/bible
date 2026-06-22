from __future__ import annotations

import json
import re
import subprocess
import ssl
import tempfile
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, urlparse, urlunparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCES_PATH = ROOT / "data" / "hanja" / "sources.json"
CURATED_ENTRIES_PATH = ROOT / "data" / "hanja" / "entries.json"
YOUTUBE_VIDEOS_PATH = ROOT / "data" / "external" / "youtube" / "videos.json"
YOUTUBE_CHANNELS_PATH = ROOT / "data" / "external" / "youtube" / "channels.json"
MANIFEST_PATH = ROOT / "data" / "hanja" / "manifest.json"
HARVEST_ROOT = ROOT / "data" / "hanja" / "harvest"
EXTRACTED_ROOT = ROOT / "data" / "hanja" / "extracted"
PUBLISHED_PATH = ROOT / "data" / "hanja" / "published-characters.json"

HAN_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
SCRIPT_STYLE_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
TAG_RE = re.compile(r"<[^>]+>")
SPACE_RE = re.compile(r"\s+")
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
READING_RE = re.compile(r"([가-힣]{1,6})\(([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]{1,4})\)")
ISBN_RE = re.compile(r"(?:ISBN(?:-1[03])?:?\s*)?(97[89][0-9-]{10,16}|[0-9-]{9,16}[0-9Xx])")
SOURCE_TEXT_FALLBACKS: dict[str, dict[str, str]] = {
    "hanja-src-bible-science-bible-science": {
        "title": "성경과학연구소(IBS) 섬기는 이들",
        "summary": "성경과학연구소 소개와 섬기는 이들 정보를 묶어 한자·성경 연구 맥락의 인물 정보를 남긴다.",
        "text": "성경과학연구소(IBS)는 성경과 과학, 창조론, 성경 본문 연구를 함께 다루는 연구·교육 단체로 소개된다. 섬기는 이들로는 김명현 박사, 최무용 목사, 채현민 실장이 언급되며, 한자와 성경을 연결하는 강연·연구의 배경 인물 정보로 함께 읽힌다.",
    }
}
REFERENCE_PATTERNS = [
    ("GEN", [r"창세기", r"창" , r"genesis", r"gen\\.?"]),
    ("EXO", [r"출애굽기", r"출" , r"exodus", r"exo\\.?"]),
    ("LEV", [r"레위기", r"레" , r"leviticus", r"lev\\.?"]),
    ("NUM", [r"민수기", r"민" , r"numbers", r"num\\.?"]),
    ("DEU", [r"신명기", r"신" , r"deuteronomy", r"deut\\.?"]),
    ("JOS", [r"여호수아", r"수" , r"joshua", r"josh\\.?"]),
    ("JDG", [r"사사기", r"삿" , r"judges", r"judg\\.?"]),
    ("RUT", [r"룻기", r"룻" , r"ruth"]),
    ("1SA", [r"사무엘상", r"삼상", r"1\\s*samuel", r"1\\s*sam\\.?"]),
    ("2SA", [r"사무엘하", r"삼하", r"2\\s*samuel", r"2\\s*sam\\.?"]),
    ("1KI", [r"열왕기상", r"왕상", r"1\\s*kings", r"1\\s*kgs\\.?"]),
    ("2KI", [r"열왕기하", r"왕하", r"2\\s*kings", r"2\\s*kgs\\.?"]),
    ("1CH", [r"역대상", r"대상", r"1\\s*chronicles", r"1\\s*chron\\.?"]),
    ("2CH", [r"역대하", r"대하", r"2\\s*chronicles", r"2\\s*chron\\.?"]),
    ("EZR", [r"에스라", r"ezra"]),
    ("NEH", [r"느헤미야", r"neh\\.?", r"nehemiah"]),
    ("EST", [r"에스더", r"esther", r"est\\.?"]),
    ("JOB", [r"욥기", r"욥", r"job"]),
    ("PSA", [r"시편", r"시", r"psalm", r"psalms", r"ps\\.?"]),
    ("PRO", [r"잠언", r"잠", r"proverbs", r"prov\\.?"]),
    ("ECC", [r"전도서", r"전", r"ecclesiastes", r"eccl\\.?"]),
    ("SOL", [r"아가", r"song of songs", r"song of solomon"]),
    ("ISA", [r"이사야", r"사", r"isaiah", r"isa\\.?"]),
    ("JER", [r"예레미야", r"렘", r"jeremiah", r"jer\\.?"]),
    ("LAM", [r"예레미야애가", r"애", r"lamentations", r"lam\\.?"]),
    ("EZE", [r"에스겔", r"겔", r"ezekiel", r"ezek\\.?"]),
    ("DAN", [r"다니엘", r"단", r"daniel", r"dan\\.?"]),
    ("HOS", [r"호세아", r"hos\\.?", r"hosea"]),
    ("JOE", [r"요엘", r"joel"]),
    ("AMO", [r"아모스", r"amos"]),
    ("OBA", [r"오바댜", r"obadiah", r"obad\\.?"]),
    ("JON", [r"요나", r"jonah"]),
    ("MIC", [r"미가", r"micah", r"mic\\.?"]),
    ("NAH", [r"나훔", r"nahum", r"nah\\.?"]),
    ("HAB", [r"하박국", r"habakkuk", r"hab\\.?"]),
    ("ZEP", [r"스바냐", r"zephaniah", r"zeph\\.?"]),
    ("HAG", [r"학개", r"haggai", r"hag\\.?"]),
    ("ZEC", [r"스가랴", r"zechariah", r"zech\\.?"]),
    ("MAL", [r"말라기", r"malachi", r"mal\\.?"]),
    ("MAT", [r"마태복음", r"마", r"matthew", r"matt\\.?"]),
    ("MAR", [r"마가복음", r"막", r"mark", r"mrk\\.?", r"mk\\.?"]),
    ("LUK", [r"누가복음", r"눅", r"luke", r"luk\\.?", r"lk\\.?"]),
    ("JOH", [r"요한복음", r"요", r"john", r"jhn\\.?", r"jn\\.?"]),
    ("ACT", [r"사도행전", r"행", r"acts", r"act\\.?"]),
    ("ROM", [r"로마서", r"롬", r"romans", r"rom\\.?"]),
    ("1CO", [r"고린도전서", r"고전", r"1\\s*corinthians", r"1\\s*cor\\.?"]),
    ("2CO", [r"고린도후서", r"고후", r"2\\s*corinthians", r"2\\s*cor\\.?"]),
    ("GAL", [r"갈라디아서", r"갈", r"galatians", r"gal\\.?"]),
    ("EPH", [r"에베소서", r"엡", r"ephesians", r"eph\\.?"]),
    ("PHI", [r"빌립보서", r"빌", r"philippians", r"phil\\.?"]),
    ("COL", [r"골로새서", r"골", r"colossians", r"col\\.?"]),
    ("1TH", [r"데살로니가전서", r"살전", r"1\\s*thessalonians", r"1\\s*thess\\.?"]),
    ("2TH", [r"데살로니가후서", r"살후", r"2\\s*thessalonians", r"2\\s*thess\\.?"]),
    ("1TI", [r"디모데전서", r"딤전", r"1\\s*timothy", r"1\\s*tim\\.?"]),
    ("2TI", [r"디모데후서", r"딤후", r"2\\s*timothy", r"2\\s*tim\\.?"]),
    ("TIT", [r"디도서", r"딛", r"titus", r"tit\\.?"]),
    ("PHM", [r"빌레몬서", r"몬", r"philemon", r"phm\\.?"]),
    ("HEB", [r"히브리서", r"히", r"hebrews", r"heb\\.?"]),
    ("JAM", [r"야고보서", r"약", r"james", r"jas\\.?"]),
    ("1PE", [r"베드로전서", r"벧전", r"1\\s*peter", r"1\\s*pet\\.?"]),
    ("2PE", [r"베드로후서", r"벧후", r"2\\s*peter", r"2\\s*pet\\.?"]),
    ("1JO", [r"요한일서", r"요일", r"1\\s*john", r"1\\s*jn\\.?"]),
    ("2JO", [r"요한이서", r"요이", r"2\\s*john", r"2\\s*jn\\.?"]),
    ("3JO", [r"요한삼서", r"요삼", r"3\\s*john", r"3\\s*jn\\.?"]),
    ("JUD", [r"유다서", r"jude"]),
    ("REV", [r"요한계시록", r"계", r"revelation", r"rev\\.?"]),
]
SHORT_KOREAN_ALIAS_RE = re.compile(r"^[가-힣]$")
REFERENCE_MATCHERS = []
for code, aliases in REFERENCE_PATTERNS:
    for alias in sorted(aliases, key=len, reverse=True):
        alias_prefix = rf"(?<![0-9A-Za-z가-힣])(?:{alias})"
        if SHORT_KOREAN_ALIAS_RE.fullmatch(alias):
            pattern = re.compile(
                rf"{alias_prefix}\s*(?P<chapter>\d+)(?!\d)(?:(?:\s*장)(?:\s*(?P<verse_start_after_chapter>\d+)(?:\s*[-–~]\s*(?P<verse_end_after_chapter>\d+))?\s*절?)?|(?:\s*[:.]\s*(?P<verse_start>\d+)(?:\s*[-–~]\s*(?P<verse_end>\d+))?))(?!\d)",
                re.IGNORECASE,
            )
        else:
            pattern = re.compile(
                rf"{alias_prefix}\s*(?P<chapter>\d+)(?!\d)(?!\s*(?:[-~–]\s*\d+\s*장|장\s*(?:부터|[-~–])\s*\d+))(?:(?:\s*장)(?:\s*(?P<verse_start_after_chapter>\d+)(?:\s*[-–~]\s*(?P<verse_end_after_chapter>\d+))?\s*절?)?|(?:\s*[:.]\s*(?P<verse_start>\d+)(?:\s*[-–~]\s*(?P<verse_end>\d+))?))?",
                re.IGNORECASE,
            )
        REFERENCE_MATCHERS.append((code, alias, pattern))
_REFERENCE_LIMITS: tuple[dict[str, int], dict[tuple[str, int], int]] | None = None
TOPIC_KEYWORD_MAP = {
    "genesis": ["GEN 1:1-3", "JOH 1:1-3"],
    "creation": ["GEN 1:1-5", "HEB 11:3"],
    "righteousness": ["ROM 3:21-26", "GAL 2:15-21"],
    "blessing": ["EPH 1:3-6", "PSA 1:1-3"],
    "god-spirit": ["GEN 1:1-2", "JOH 1:1-3"],
    "fall": ["GEN 3:1-7", "ROM 5:12-19"],
    "shame": ["GEN 3:7-11", "REV 3:18"],
    "forbidden": ["GEN 2:16-17", "DEU 30:15-20"],
    "sacrifice": ["LEV 16:15-19", "HEB 9:11-14"],
}
MEANING_MARKERS = (
    "뜻",
    "의미",
    "풀이",
    "풀어",
    "상징",
    "가리킨",
    "가리켜",
    "나타낸",
    "나타내",
    "말한다",
    "설명",
    "증거",
    "해석",
    "라고",
    "이라",
    "자는",
)
ETYMOLOGY_MARKERS = (
    "뜻",
    "의미",
    "풀이",
    "풀어",
    "상징",
    "가리킨",
    "가리켜",
    "나타낸",
    "나타내",
    "라고",
    "이라",
)
BOILERPLATE_MARKERS = (
    "로그인",
    "회원가입",
    "기사검색",
    "메인메뉴",
    "모바일웹",
    "본문 바로가기",
    "댓글",
    "저작권",
    "광고",
    "사이트 내 전체검색",
    "기사제보",
    "독자게시판",
    "공지사항",
    "전체기사",
    "홍보",
    "메인페이지로 가기",
    "스크롤 이동 상태바",
    "매체정보 바로가기",
    "기사입력",
    "특별 연재",
    "라는 책입니다",
    "라는 책이다",
    "책입니다",
    "도서 상세정보",
    "상품 정보",
)
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?。])\s+|\n+")


@dataclass
class HarvestSource:
    id: str
    title: str
    url: str
    kind: str
    language: str
    stance: str
    catalogRole: str
    publisher: str | None
    section: str
    subsection: str | None
    topicTags: list[str]
    notes: str | None
    importLine: int


@dataclass
class HarvestDocument:
    sourceId: str
    sourceType: str
    canonicalUrl: str
    fetchedAt: str
    status: str
    title: str
    publisher: str | None
    author: str | None
    publishDate: str | None
    language: str
    stance: str
    contentText: str
    contentMarkdown: str | None
    contentSummary: str | None
    fetchMethod: str
    metadata: dict[str, Any]
    errors: list[str]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")
    return re.sub(r"-{2,}", "-", slug)


def extract_title_characters(title: str) -> list[str]:
    return list(dict.fromkeys(HAN_RE.findall(title or "")))


def extract_contexts(text: str, character: str, limit: int = 3, radius: int = 24) -> list[str]:
    contexts: list[str] = []
    start = 0
    while len(contexts) < limit:
        index = text.find(character, start)
        if index < 0:
            break
        snippet = text[max(0, index - radius): min(len(text), index + radius)]
        cleaned = SPACE_RE.sub(" ", snippet).strip()
        if cleaned and cleaned not in contexts:
            contexts.append(cleaned)
        start = index + len(character)
    return contexts
def normalize_sentence(sentence: str) -> str:
    sentence = sentence.replace("\u200b", " ").replace("\ufeff", " ")
    sentence = SPACE_RE.sub(" ", sentence).strip()
    for marker in (
        "이 기사를 공유합니다",
        "주요서비스 바로가기",
        "본문 바로가기",
        "매체정보 바로가기",
        "로그인 바로가기",
        "기사검색 바로가기",
    ):
        sentence = sentence.replace(marker, " ")
    sentence = SPACE_RE.sub(" ", sentence).strip()
    sentence = sentence.strip("·•-–|[]()'\"“”‘’")
    return sentence


def is_boilerplate_sentence(sentence: str) -> bool:
    if not sentence:
        return True
    lowered = sentence.lower()
    if len(sentence) < 16:
        return True
    if "http://" in lowered or "https://" in lowered:
        return True
    return any(marker.lower() in lowered for marker in BOILERPLATE_MARKERS)


def has_meaning_shape(sentence: str) -> bool:
    return any(marker in sentence for marker in (*MEANING_MARKERS, *ETYMOLOGY_MARKERS)) or "글자" in sentence or "자는" in sentence or "뜻" in sentence or "해석" in sentence


def score_claim_sentence(sentence: str, characters: list[str], reading_map: dict[str, str]) -> int:
    score = 0
    if any(character in sentence for character in characters):
        score += 3
    if any(reading_map.get(character) and reading_map[character] in sentence for character in characters):
        score += 1
    if has_meaning_shape(sentence):
        score += 3
    if "자는" in sentence or "글자" in sentence:
        score += 2
    if 24 <= len(sentence) <= 180:
        score += 1
    return score


def extract_claim_candidates(
    text: str,
    title_characters: list[str],
    reading_map: dict[str, str],
    source: HarvestSource,
    references: list[str],
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    seen: set[str] = set()
    for idx, chunk in enumerate(SENTENCE_SPLIT_RE.split(text)):
        sentence = normalize_sentence(chunk)
        if not sentence or sentence in seen or is_boilerplate_sentence(sentence):
            continue
        related_characters = [character for character in title_characters if character in sentence][:4]
        if not related_characters:
            continue
        score = score_claim_sentence(sentence, related_characters, reading_map)
        if score < 4:
            continue
        if not has_meaning_shape(sentence) and score < 6:
            continue
        claim_type = (
            "critical"
            if source.stance == "critical"
            else "etymology" if any(marker in sentence for marker in ETYMOLOGY_MARKERS) else "summary"
        )
        candidates.append(
            {
                "sourceId": source.id,
                "claimId": f"{source.id}-{idx+1}",
                "text": sentence[:320],
                "claimType": claim_type,
                "relatedCharacters": related_characters,
                "relatedReferences": references[:4],
                "confidence": "high" if score >= 7 else "medium",
                "score": score,
            }
        )
        seen.add(sentence)
    return candidates[:10]


def build_meaning_summary(meaning_evidence: list[dict[str, Any]]) -> str | None:
    if not meaning_evidence:
        return None

    def summary_sort_key(evidence: dict[str, Any]) -> tuple[int, int, int]:
        text = evidence.get("text", "")
        metadata_penalty = 1 if any(marker in text for marker in ("기사입력", "특별 연재", "런던타임즈", "박사학위")) else 0
        explicit_meaning_bonus = 0 if any(marker in text for marker in ("뜻", "의미", "풀이", "글자", "자는", "상징", "해석")) else 1
        return (metadata_penalty, explicit_meaning_bonus, abs(len(text) - 84))

    preferred = [evidence for evidence in meaning_evidence if has_meaning_shape(evidence.get("text", ""))]
    if preferred:
        return sorted(preferred, key=summary_sort_key)[0]["text"]
    return sorted(meaning_evidence, key=summary_sort_key)[0]["text"]


def build_generated_explanation(character: str, meaning_summary: str | None, source_count: int) -> str:
    if meaning_summary:
        return f"링크 본문에서 {character} 자를 어떻게 풀어 읽는지 먼저 드러내고, 그 뜻풀이와 연결된 성경 본문·출처를 함께 보여 준다."
    return f"{source_count}개 출처에서 나온 언급과 본문 연결을 바탕으로 생성된 항목이다."


def normalize_text_from_html(html: str) -> tuple[str, str | None]:
    title_match = TITLE_RE.search(html)
    title = SPACE_RE.sub(" ", unescape(TAG_RE.sub(" ", title_match.group(1)))).strip() if title_match else None
    body = SCRIPT_STYLE_RE.sub(" ", html)
    body = TAG_RE.sub(" ", body)
    body = body.replace("\xa0", " ")
    body = unescape(body)
    body = SPACE_RE.sub(" ", body).strip()
    return body[:50000], title


def detect_source_type(source: HarvestSource) -> str:
    if source.kind == "video":
        return "video"
    if source.kind == "channel":
        return "channel"
    if source.kind == "paper" or source.url.lower().endswith(".pdf"):
        return "pdf"
    if source.kind == "search":
        return "search"
    if source.kind == "book":
        return "book"
    if source.kind == "blog":
        return "blog"
    if source.kind == "reference":
        return "reference"
    return "article"


def normalize_fetch_url(url: str) -> str:
    parsed = urlparse(url)
    netloc = parsed.netloc.encode("idna").decode("ascii") if parsed.netloc else parsed.netloc
    path = quote(parsed.path or "/", safe="/%:@")
    query = quote(parsed.query, safe="=&?/:,+%")
    fragment = quote(parsed.fragment, safe="=&?/:,+%")
    return urlunparse((parsed.scheme, netloc, path, parsed.params, query, fragment))


UNVERIFIED_SSL_CONTEXT = ssl._create_unverified_context()


def fetch_bytes(url: str) -> tuple[bytes, str, dict[str, str]]:
    request = Request(
        normalize_fetch_url(url),
        headers={
            "User-Agent": "Mozilla/5.0 bible-hanja-harvest/1.0",
            "Accept-Language": "ko,en;q=0.9",
        },
    )
    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read()
            content_type = response.headers.get_content_type()
            headers = {k.lower(): v for k, v in response.headers.items()}
            return raw, content_type, headers
    except Exception as error:
        if "CERTIFICATE_VERIFY_FAILED" not in str(error) and "Hostname mismatch" not in str(error):
            raise
    with urlopen(request, timeout=20, context=UNVERIFIED_SSL_CONTEXT) as response:
        raw = response.read()
        content_type = response.headers.get_content_type()
        headers = {k.lower(): v for k, v in response.headers.items()}
        return raw, content_type, headers


def fetch_url(url: str) -> tuple[str, str, dict[str, str]]:
    raw, content_type, headers = fetch_bytes(url)
    charset = "utf-8"
    content_type_header = headers.get("content-type", "")
    charset_match = re.search(r"charset=([A-Za-z0-9._-]+)", content_type_header)
    if charset_match:
        charset = charset_match.group(1)
    try:
        text = raw.decode(charset, errors="replace")
    except LookupError:
        text = raw.decode("utf-8", errors="replace")
    return content_type, text, headers


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def load_youtube_indexes() -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    videos_payload = read_json(YOUTUBE_VIDEOS_PATH, {"videos": []})
    channels_payload = read_json(YOUTUBE_CHANNELS_PATH, {"channels": []})
    videos = videos_payload.get("videos", []) if isinstance(videos_payload, dict) else videos_payload
    channels = channels_payload.get("channels", []) if isinstance(channels_payload, dict) else channels_payload
    by_video: dict[str, dict[str, Any]] = {video["videoId"]: video for video in videos if isinstance(video, dict) and video.get("videoId")}
    by_channel: dict[str, list[dict[str, Any]]] = defaultdict(list)
    channel_lookup: dict[str, set[str]] = defaultdict(set)
    for channel in channels:
        if not isinstance(channel, dict):
            continue
        for key in [channel.get("channelId"), channel.get("channelHandle"), channel.get("sourceUrl")]:
            if key:
                channel_lookup[str(key)].add(str(channel.get("channelId") or key))
    for video in videos:
        if not isinstance(video, dict):
            continue
        channel_id = str(video.get("channelId") or "")
        if channel_id:
            by_channel[channel_id].append(video)
        handle = video.get("channelHandle")
        if handle:
            by_channel[str(handle)].append(video)
    return by_video, by_channel


def youtube_video_id(url: str) -> str | None:
    parsed = urlparse(url)
    if "youtube.com" not in parsed.netloc and "youtu.be" not in parsed.netloc:
        return None
    if parsed.netloc.endswith("youtu.be"):
        return parsed.path.strip("/") or None
    return parse_qs(parsed.query).get("v", [None])[0]


def harvest_youtube_with_yt_dlp(source: HarvestSource) -> dict[str, Any] | None:
    base = [
        "yt-dlp",
        "--dump-single-json",
        "--no-warnings",
        "--no-playlist",
        source.url,
    ]
    if source.kind == "channel":
        base = [
            "yt-dlp",
            "--dump-single-json",
            "--flat-playlist",
            "--playlist-end",
            "12",
            "--no-warnings",
            source.url,
        ]
    try:
        result = subprocess.run(base, capture_output=True, text=True, check=True, timeout=90)
    except Exception:
        return None
    stdout = result.stdout.strip()
    if not stdout:
        return None
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        return None


def build_youtube_search_query(source: HarvestSource) -> str:
    head = source.title.split("—", 1)[0].split("-", 1)[0].strip()
    query_parts = [head or source.title]
    if source.notes:
        query_parts.append(source.notes)
    query_parts.extend(source.topicTags[:2])
    return " ".join(part for part in query_parts if part).strip()


def search_youtube_with_yt_dlp(source: HarvestSource, limit: int = 12) -> dict[str, Any] | None:
    query = build_youtube_search_query(source)
    command = [
        "yt-dlp",
        "--dump-single-json",
        "--flat-playlist",
        "--playlist-end",
        str(limit),
        "--no-warnings",
        f"ytsearch{limit}:{query}",
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True, timeout=90)
    except Exception:
        return None
    stdout = result.stdout.strip()
    if not stdout:
        return None
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError:
        return None
    if isinstance(payload, dict):
        payload.setdefault("searchQuery", query)
    return payload


def extract_isbn(*values: str | None) -> str | None:
    for value in values:
        if not value:
            continue
        match = ISBN_RE.search(value)
        if match:
            return match.group(1).replace("-", "").upper()
    return None


def build_source_text_fallback(source: HarvestSource, error_message: str | None = None) -> HarvestDocument | None:
    payload = SOURCE_TEXT_FALLBACKS.get(source.id)
    if not payload:
        return None
    return HarvestDocument(
        sourceId=source.id,
        sourceType=detect_source_type(source),
        canonicalUrl=source.url,
        fetchedAt=utc_now(),
        status="ok",
        title=payload.get("title") or source.title,
        publisher=source.publisher,
        author=source.publisher,
        publishDate=None,
        language=source.language,
        stance=source.stance,
        contentText=payload.get("text") or source.notes or source.title,
        contentMarkdown=payload.get("text") or None,
        contentSummary=payload.get("summary") or None,
        fetchMethod="curated-fallback",
        metadata={"fallback": source.id},
        errors=[error_message] if error_message else [],
    )


def extract_pdf_text(url: str) -> tuple[str, dict[str, Any]]:
    raw, _content_type, headers = fetch_bytes(url)
    with tempfile.TemporaryDirectory() as tmpdir:
        pdf_path = Path(tmpdir) / "source.pdf"
        txt_path = Path(tmpdir) / "source.txt"
        pdf_path.write_bytes(raw)
        command = ["pdftotext", "-enc", "UTF-8", str(pdf_path), str(txt_path)]
        result = subprocess.run(command, capture_output=True, text=True, timeout=90)
        if result.returncode != 0 or not txt_path.exists():
            raise RuntimeError(result.stderr.strip() or "pdftotext failed")
        text = txt_path.read_text(encoding="utf-8", errors="replace")
    metadata = {"headers": headers, "bytes": len(raw)}
    return SPACE_RE.sub(" ", text).strip()[:50000], metadata


def harvest_youtube_source(source: HarvestSource, by_video: dict[str, dict[str, Any]], by_channel: dict[str, list[dict[str, Any]]]) -> HarvestDocument:
    fetched_at = utc_now()
    if source.kind == "video":
        video_id = youtube_video_id(source.url)
        video = by_video.get(video_id or "")
        if video:
            text_parts = [video.get("title", ""), video.get("summary", ""), video.get("description", "")]
            return HarvestDocument(
                sourceId=source.id,
                sourceType="video",
                canonicalUrl=source.url,
                fetchedAt=fetched_at,
                status="ok",
                title=video.get("title") or source.title,
                publisher=video.get("channelTitle") or source.publisher,
                author=video.get("channelTitle"),
                publishDate=video.get("publishedAt"),
                language=source.language,
                stance=source.stance,
                contentText="\n\n".join(part for part in text_parts if part).strip(),
                contentMarkdown=video.get("summary"),
                contentSummary=video.get("summary"),
                fetchMethod="youtube-catalog",
                metadata={
                    "videoId": video.get("videoId"),
                    "channelId": video.get("channelId"),
                    "transcriptStatus": video.get("transcriptStatus"),
                    "mentionedPassages": video.get("mentionedPassages", []),
                    "keywords": video.get("keywords", []),
                    "topics": video.get("topics", []),
                },
                errors=[],
            )
    channel_candidates: list[dict[str, Any]] = []
    for key in [source.url, urlparse(source.url).path.strip("/"), f"@{urlparse(source.url).path.strip('/').split('@')[-1]}"]:
        if key in by_channel:
            channel_candidates.extend(by_channel[key])
    if source.kind == "channel" and channel_candidates:
        sorted_videos = sorted(channel_candidates, key=lambda item: item.get("publishedAt", ""), reverse=True)
        preview = sorted_videos[:12]
        content_lines = [f"{item.get('title', '')} :: {item.get('summary', '')}".strip() for item in preview]
        return HarvestDocument(
            sourceId=source.id,
            sourceType="channel",
            canonicalUrl=source.url,
            fetchedAt=fetched_at,
            status="ok",
            title=source.title,
            publisher=source.publisher,
            author=source.publisher,
            publishDate=None,
            language=source.language,
            stance=source.stance,
            contentText="\n".join(line for line in content_lines if line).strip(),
            contentMarkdown=None,
            contentSummary=f"Indexed {len(channel_candidates)} videos from the linked channel.",
            fetchMethod="youtube-catalog",
            metadata={
                "videoCount": len(channel_candidates),
                "sampleVideoIds": [item.get("videoId") for item in preview if item.get("videoId")],
            },
            errors=[],
        )

    fallback = harvest_youtube_with_yt_dlp(source)
    if fallback:
        if source.kind == "video":
            text_parts = [fallback.get("title", ""), fallback.get("description", "")]
            uploader = fallback.get("channel") or fallback.get("uploader") or source.publisher
            return HarvestDocument(
                sourceId=source.id,
                sourceType="video",
                canonicalUrl=fallback.get("webpage_url") or source.url,
                fetchedAt=fetched_at,
                status="ok",
                title=fallback.get("title") or source.title,
                publisher=uploader,
                author=uploader,
                publishDate=fallback.get("upload_date"),
                language=source.language,
                stance=source.stance,
                contentText="\n\n".join(part for part in text_parts if part).strip() or (source.notes or source.title),
                contentMarkdown=fallback.get("description"),
                contentSummary=fallback.get("description", "")[:420] or None,
                fetchMethod="yt-dlp",
                metadata={
                    "videoId": fallback.get("id"),
                    "channelId": fallback.get("channel_id"),
                    "viewCount": fallback.get("view_count"),
                },
                errors=[],
            )
        entries = fallback.get("entries") or []
        preview = [item for item in entries if isinstance(item, dict)][:12]
        content_lines = [f"{item.get('title', '')} :: {item.get('url', '')}".strip() for item in preview]
        return HarvestDocument(
            sourceId=source.id,
            sourceType="channel",
            canonicalUrl=source.url,
            fetchedAt=fetched_at,
            status="ok",
            title=fallback.get("title") or source.title,
            publisher=fallback.get("channel") or source.publisher,
            author=fallback.get("uploader") or source.publisher,
            publishDate=None,
            language=source.language,
            stance=source.stance,
            contentText="\n".join(line for line in content_lines if line).strip() or (source.notes or source.title),
            contentMarkdown=None,
            contentSummary=f"Indexed {len(entries)} videos from the linked channel.",
            fetchMethod="yt-dlp",
            metadata={
                "videoCount": len(entries),
                "sampleVideoIds": [item.get("id") for item in preview if item.get("id")],
            },
            errors=[],
        )

    if source.kind == "channel":
        search_fallback = search_youtube_with_yt_dlp(source)
        if search_fallback:
            entries = search_fallback.get("entries") or []
            preview = [item for item in entries if isinstance(item, dict)][:12]
            content_lines = [f"{item.get('title', '')} :: {item.get('description', '') or item.get('url', '')}".strip() for item in preview]
            return HarvestDocument(
                sourceId=source.id,
                sourceType="channel",
                canonicalUrl=source.url,
                fetchedAt=fetched_at,
                status="ok",
                title=source.title,
                publisher=source.publisher,
                author=source.publisher,
                publishDate=None,
                language=source.language,
                stance=source.stance,
                contentText="\n".join(line for line in content_lines if line).strip() or (source.notes or source.title),
                contentMarkdown=None,
                contentSummary=f"Recovered {len(preview)} YouTube search matches for the channel.",
                fetchMethod="yt-dlp-search",
                metadata={
                    "videoCount": len(preview),
                    "sampleVideoIds": [item.get("id") for item in preview if item.get("id")],
                    "searchQuery": search_fallback.get("searchQuery"),
                },
                errors=[],
            )

    try:
        content_type, text, headers = fetch_url(source.url)
        if content_type == "text/html":
            normalized_text, html_title = normalize_text_from_html(text)
            summary = normalized_text[:420].strip() or None
            return HarvestDocument(
                sourceId=source.id,
                sourceType=detect_source_type(source),
                canonicalUrl=source.url,
                fetchedAt=fetched_at,
                status="ok" if normalized_text else "missing",
                title=html_title or source.title,
                publisher=source.publisher,
                author=source.publisher,
                publishDate=None,
                language=source.language,
                stance=source.stance,
                contentText=normalized_text or (source.notes or source.title),
                contentMarkdown=normalized_text or None,
                contentSummary=summary,
                fetchMethod="youtube-html",
                metadata={"contentType": content_type, "headers": headers},
                errors=[] if normalized_text else ["No usable HTML content extracted from YouTube page."],
            )
    except Exception:
        pass
    return HarvestDocument(
        sourceId=source.id,
        sourceType=detect_source_type(source),
        canonicalUrl=source.url,
        fetchedAt=fetched_at,
        status="missing",
        title=source.title,
        publisher=source.publisher,
        author=None,
        publishDate=None,
        language=source.language,
        stance=source.stance,
        contentText=source.notes or source.title,
        contentMarkdown=None,
        contentSummary=None,
        fetchMethod="youtube-catalog",
        metadata={},
        errors=["No matching YouTube catalog or yt-dlp record found."],
    )


def harvest_web_source(source: HarvestSource) -> HarvestDocument:
    fetched_at = utc_now()
    source_type = detect_source_type(source)
    if source_type == "pdf":
        try:
            extracted_text, metadata = extract_pdf_text(source.url)
            summary = extracted_text[:420].strip() or None
            return HarvestDocument(
                sourceId=source.id,
                sourceType=source_type,
                canonicalUrl=source.url,
                fetchedAt=fetched_at,
                status="ok" if extracted_text else "unsupported",
                title=source.title,
                publisher=source.publisher,
                author=None,
                publishDate=None,
                language=source.language,
                stance=source.stance,
                contentText=extracted_text or (source.notes or source.title),
                contentMarkdown=extracted_text or None,
                contentSummary=summary,
                fetchMethod="pdftotext",
                metadata=metadata,
                errors=[] if extracted_text else ["PDF text extraction produced no content."],
            )
        except Exception as error:  # noqa: BLE001
            return HarvestDocument(
                sourceId=source.id,
                sourceType=source_type,
                canonicalUrl=source.url,
                fetchedAt=fetched_at,
                status="error",
                title=source.title,
                publisher=source.publisher,
                author=None,
                publishDate=None,
                language=source.language,
                stance=source.stance,
                contentText=source.notes or source.title,
                contentMarkdown=None,
                contentSummary=None,
                fetchMethod="pdftotext",
                metadata={},
                errors=[str(error)],
            )
    try:
        content_type, text, headers = fetch_url(source.url)
        if content_type == "text/html":
            normalized_text, html_title = normalize_text_from_html(text)
            summary = normalized_text[:420].strip() or None
            return HarvestDocument(
                sourceId=source.id,
                sourceType=source_type,
                canonicalUrl=source.url,
                fetchedAt=fetched_at,
                status="ok",
                title=html_title or source.title,
                publisher=source.publisher,
                author=None,
                publishDate=None,
                language=source.language,
                stance=source.stance,
                contentText=normalized_text or (source.notes or source.title),
                contentMarkdown=normalized_text or None,
                contentSummary=summary,
                fetchMethod="urllib-html",
                metadata={"contentType": content_type, "headers": headers},
                errors=[],
            )
        return HarvestDocument(
            sourceId=source.id,
            sourceType=source_type,
            canonicalUrl=source.url,
            fetchedAt=fetched_at,
            status="unsupported",
            title=source.title,
            publisher=source.publisher,
            author=None,
            publishDate=None,
            language=source.language,
            stance=source.stance,
            contentText=source.notes or source.title,
            contentMarkdown=None,
            contentSummary=None,
            fetchMethod="urllib",
            metadata={"contentType": content_type, "headers": headers},
            errors=[f"Unsupported content-type {content_type}"],
        )
    except Exception as error:  # noqa: BLE001
        return HarvestDocument(
            sourceId=source.id,
            sourceType=source_type,
            canonicalUrl=source.url,
            fetchedAt=fetched_at,
            status="error",
            title=source.title,
            publisher=source.publisher,
            author=None,
            publishDate=None,
            language=source.language,
            stance=source.stance,
            contentText=source.notes or source.title,
            contentMarkdown=None,
            contentSummary=None,
            fetchMethod="urllib",
            metadata={},
            errors=[str(error)],
        )


def repair_harvest_document(
    source: HarvestSource,
    document: HarvestDocument,
    donor_by_isbn: dict[str, HarvestDocument],
) -> HarvestDocument:
    if document.status == "ok":
        return document
    fallback = build_source_text_fallback(source, "; ".join(document.errors) if document.errors else None)
    if fallback:
        return fallback
    if source.kind == "book":
        isbn = extract_isbn(source.notes, source.url, source.title, document.contentText)
        donor = donor_by_isbn.get(isbn or "")
        if donor:
            return HarvestDocument(
                sourceId=source.id,
                sourceType=document.sourceType,
                canonicalUrl=source.url,
                fetchedAt=utc_now(),
                status="ok",
                title=source.title,
                publisher=source.publisher or donor.publisher,
                author=donor.author,
                publishDate=donor.publishDate,
                language=source.language,
                stance=source.stance,
                contentText=donor.contentText,
                contentMarkdown=donor.contentMarkdown,
                contentSummary=donor.contentSummary,
                fetchMethod=f"{donor.fetchMethod}+isbn-alias",
                metadata={**donor.metadata, "donorSourceId": donor.sourceId, "isbn": isbn},
                errors=["Recovered from alternate ISBN-matched book source."],
            )
    return document


def build_donor_by_isbn(sources: list[HarvestSource], documents: list[HarvestDocument]) -> dict[str, HarvestDocument]:
    donors: dict[str, HarvestDocument] = {}
    source_by_id = {source.id: source for source in sources}
    for document in documents:
        source = source_by_id.get(document.sourceId)
        if not source or source.kind != "book" or document.status != "ok":
            continue
        isbn = extract_isbn(source.notes, source.url, source.title, document.contentText)
        if isbn and isbn not in donors:
            donors[isbn] = document
    return donors

def load_reference_limits() -> tuple[dict[str, int], dict[tuple[str, int], int]]:
    global _REFERENCE_LIMITS
    if _REFERENCE_LIMITS is not None:
        return _REFERENCE_LIMITS

    metadata = json.loads((ROOT / "world_english_bible" / "metadata.json").read_text(encoding="utf-8"))
    chapter_limits = {book["code"]: int(book["chapters"]) for book in metadata.get("books", [])}
    verse_limits: dict[tuple[str, int], int] = {}
    for line in (ROOT / "world_english_bible" / "canon_66_vpl.txt").read_text(encoding="utf-8").splitlines():
        match = re.match(r"^([0-9A-Z]{3})\s+(\d+):(\d+)\s+", line)
        if not match:
            continue
        code = match.group(1)
        chapter = int(match.group(2))
        verse = int(match.group(3))
        verse_limits[(code, chapter)] = max(verse_limits.get((code, chapter), 0), verse)

    _REFERENCE_LIMITS = (chapter_limits, verse_limits)
    return _REFERENCE_LIMITS


def build_reference_label(code: str, chapter: int, start: int | None, end: int | None) -> str:
    label = f"{code} {chapter}"
    if start is not None:
        label += f":{start}"
        if end is not None and end != start:
            label += f"-{end}"
    return label


def validate_reference(code: str, chapter: int, start: int | None, end: int | None) -> str | None:
    chapter_limits, verse_limits = load_reference_limits()
    max_chapter = chapter_limits.get(code)
    if max_chapter is None:
        return "unknown-book"
    if chapter < 1 or chapter > max_chapter:
        return "chapter-out-of-range"
    if start is None:
        return None
    if start < 1:
        return "verse-out-of-range"
    resolved_end = end if end is not None else start
    if resolved_end < start:
        return "verse-range-inverted"
    max_verse = verse_limits.get((code, chapter))
    if max_verse is None or resolved_end > max_verse:
        return "verse-out-of-range"
    return None


def extract_references(text: str) -> tuple[list[str], list[dict[str, Any]]]:
    found: list[str] = []
    rejected: list[dict[str, Any]] = []
    seen: set[str] = set()
    seen_rejections: set[tuple[str, str, str]] = set()
    for code, alias, pattern in REFERENCE_MATCHERS:
        for match in pattern.finditer(text):
            chapter = int(match.group("chapter"))
            start = match.group("verse_start") or match.group("verse_start_after_chapter")
            end = match.group("verse_end") or match.group("verse_end_after_chapter")
            start_number = int(start) if start is not None else None
            end_number = int(end) if end is not None else start_number
            label = build_reference_label(code, chapter, start_number, end_number)
            rejection_reason = validate_reference(code, chapter, start_number, end_number)
            if rejection_reason is not None:
                raw_text = SPACE_RE.sub(" ", match.group(0)).strip()
                rejection_key = (label, rejection_reason, raw_text)
                if rejection_key not in seen_rejections:
                    rejected.append(
                        {
                            "referenceLabel": label,
                            "reason": rejection_reason,
                            "matchedText": raw_text,
                            "aliasPattern": alias,
                        }
                    )
                    seen_rejections.add(rejection_key)
                continue
            if label not in seen:
                found.append(label)
                seen.add(label)
    return found[:24], rejected[:24]


def reference_to_bible_ref(label: str) -> dict[str, int | str] | None:
    match = re.match(r"^([1-3]?[A-Z]{2,3})\s+(\d+)(?::(\d+)(?:-(\d+))?)?$", label)
    if not match:
        return None
    code, chapter, start, end = match.groups()
    chapter_number = int(chapter)
    if start is None:
        return {"code": code, "chapter": chapter_number, "startVerse": 1, "endVerse": 6}
    start_number = int(start)
    end_number = int(end) if end else start_number
    return {"code": code, "chapter": chapter_number, "startVerse": start_number, "endVerse": end_number}


def derive_topic_tags(source: HarvestSource, doc: HarvestDocument) -> list[str]:
    tags = list(source.topicTags)
    text = f"{source.title} {doc.contentText}".lower()
    if any(term in text for term in ["창세기", "genesis", "창조"]):
        tags.append("creation")
    if any(term in text for term in ["의", "義", "righteousness", "칭의"]):
        tags.append("righteousness")
    if any(term in text for term in ["복", "福", "blessing"]):
        tags.append("blessing")
    if any(term in text for term in ["신", "神", "spirit", "god"]):
        tags.append("god-spirit")
    if any(term in text for term in ["벌거", "수치", "裸", "금", "禁", "타락"]):
        tags.append("fall")
        tags.append("shame")
    return list(dict.fromkeys(tags))[:12]


def build_reading_map(sources: list[HarvestSource]) -> dict[str, str]:
    reading_map: dict[str, str] = {}
    for source in sources:
        for reading, characters in READING_RE.findall(source.title):
            if len(characters) != 1:
                continue
            reading_map.setdefault(characters, reading)
    return reading_map


def write_document(source: HarvestSource, doc: HarvestDocument) -> None:
    folder = HARVEST_ROOT / doc.sourceType
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{source.id}.json").write_text(json.dumps(doc.__dict__, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if doc.contentText:
        (folder / f"{source.id}.md").write_text(doc.contentText + "\n", encoding="utf-8")


def top_reference_buckets(reference_labels: list[str], topic_tags: list[str]) -> tuple[list[dict[str, int | str]], list[dict[str, int | str]]]:
    counts = Counter(reference_labels)
    ordered = [reference_to_bible_ref(label) for label, _count in counts.most_common(6)]
    normalized = [item for item in ordered if item]
    if not normalized:
        fallback_labels: list[str] = []
        for tag in topic_tags:
            fallback_labels.extend(TOPIC_KEYWORD_MAP.get(tag, []))
        normalized = [item for label in fallback_labels for item in [reference_to_bible_ref(label)] if item]
    primary = normalized[:2]
    related = normalized[2:6]
    if len(primary) == 1 and len(related) > 0:
        primary.append(related.pop(0))
    return primary, related


def build_generated_entry(
    character: str,
    slug: str,
    reading_map: dict[str, str],
    mentions: list[dict[str, Any]],
    claims_by_character: dict[str, list[dict[str, Any]]],
    sources_by_id: dict[str, HarvestSource],
    curated_by_char: dict[str, dict[str, Any]],
    all_generated_slugs: dict[str, str],
) -> dict[str, Any]:
    curated = curated_by_char.get(character)
    source_ids = [mention["sourceId"] for mention in mentions]
    unique_source_ids = list(dict.fromkeys(source_ids))
    supportive_ids = [source_id for source_id in unique_source_ids if sources_by_id[source_id].stance == "supportive"]
    critical_ids = [source_id for source_id in unique_source_ids if sources_by_id[source_id].stance == "critical"]
    unclear_ids = [source_id for source_id in unique_source_ids if sources_by_id[source_id].stance == "unclear"]
    reference_labels: list[str] = []
    meaning_reference_labels: list[str] = []
    topic_counter: Counter[str] = Counter()
    related_char_counter: Counter[str] = Counter()
    contexts: list[str] = []
    title_sources = 0
    for mention in mentions:
        reference_labels.extend(mention.get("references", []))
        topic_counter.update(mention.get("topics", []))
        related_char_counter.update(ch for ch in mention.get("coCharacters", []) if ch != character)
        if mention.get("titleMention"):
            title_sources += 1
        for context in mention.get("contexts", []):
            if context not in contexts:
                contexts.append(context)
    reading = curated.get("reading") if curated else reading_map.get(character, character)
    title_ko = curated.get("title", {}).get("ko") if curated else (f"{reading}({character})" if reading and reading != character else character)
    title_en = curated.get("title", {}).get("en") if curated else character
    character_claims = claims_by_character.get(character, [])

    def claim_sort_key(claim: dict[str, Any]) -> tuple[int, int, int, int, int, str]:
        source = sources_by_id.get(claim["sourceId"])
        if source and source.stance == "supportive":
            stance_rank = 0
        elif source and source.stance == "unclear":
            stance_rank = 1
        else:
            stance_rank = 2
        claim_type_rank = 0 if claim.get("claimType") == "etymology" else 1
        shape_rank = 0 if has_meaning_shape(claim.get("text", "")) else 1
        confidence_rank = 0 if claim.get("confidence") == "high" else 1
        return (stance_rank, claim_type_rank, shape_rank, confidence_rank, -int(claim.get("score", 0)), claim["sourceId"])

    meaning_evidence: list[dict[str, Any]] = []
    seen_claims: set[str] = set()
    for claim in sorted(character_claims, key=claim_sort_key):
        text = claim["text"].strip()
        if not text or text in seen_claims:
            continue
        seen_claims.add(text)
        source = sources_by_id.get(claim["sourceId"])
        meaning_evidence.append(
            {
                "sourceId": claim["sourceId"],
                "text": text,
                "claimType": claim.get("claimType", "summary"),
                "confidence": claim.get("confidence", "medium"),
                "stance": source.stance if source else "unclear",
                "relatedReferences": claim.get("relatedReferences", []),
            }
        )
        if len(meaning_evidence) >= 4:
            break
    for evidence in meaning_evidence:
        meaning_reference_labels.extend(evidence.get("relatedReferences", []))

    primary_passages, related_passages = top_reference_buckets(meaning_reference_labels + reference_labels, list(topic_counter.keys()))

    derived_meaning_summary = build_meaning_summary(meaning_evidence)
    thesis_ko = (
        curated.get("thesis", {}).get("ko")
        if curated
        else (
            f"이 항목은 링크 본문에서 {character} 자를 어떻게 풀이하는지 먼저 모으고, 그 뜻풀이가 어떤 성경 본문과 함께 읽히는지 보여 준다."
            if derived_meaning_summary
            else f"이 항목은 수집된 자료에서 {character} 자가 어떤 성경 주제와 연결되어 읽히는지를 묶어 보여 준다."
        )
    )
    thesis_en = (
        curated.get("thesis", {}).get("en")
        if curated
        else (
            f"This entry surfaces how harvested sources explain {character} first, then shows which biblical passages are linked to that reading."
            if derived_meaning_summary
            else f"This entry gathers how the character {character} is read alongside biblical themes across the harvested sources."
        )
    )
    explanation_ko = (
        curated.get("explanation", {}).get("ko")
        if curated
        else build_generated_explanation(character, derived_meaning_summary, len(unique_source_ids))
    )
    explanation_en = (
        curated.get("explanation", {}).get("en")
        if curated
        else (
            "This entry foregrounds source-derived meaning lines and shows the linked biblical passages and provenance together."
            if derived_meaning_summary
            else f"This generated entry is built from {len(unique_source_ids)} harvested sources with supportive, critical, and lead evidence kept separate."
        )
    )
    related_entry_slugs = [all_generated_slugs[ch] for ch, _count in related_char_counter.most_common(6) if ch in all_generated_slugs and all_generated_slugs[ch] != slug]
    keywords = [character, *(tag for tag, _count in topic_counter.most_common(5) if tag)]
    final_supportive_ids = list(dict.fromkeys(curated.get("supportiveSourceIds", []) + supportive_ids)) if curated else supportive_ids
    final_critical_ids = list(dict.fromkeys(curated.get("criticalSourceIds", []) + critical_ids)) if curated else critical_ids
    final_related_entry_slugs = list(dict.fromkeys(curated.get("relatedEntrySlugs", []) + related_entry_slugs)) if curated else related_entry_slugs
    final_keywords = list(dict.fromkeys(curated.get("keywords", []) + keywords)) if curated else keywords
    final_lead_source_ids = list(dict.fromkeys(curated.get("leadSourceIds", []) + unclear_ids)) if curated else unclear_ids
    final_source_ids = list(dict.fromkeys(final_supportive_ids + final_critical_ids + final_lead_source_ids))
    return {
        "slug": curated.get("slug", slug) if curated else slug,
        "character": character,
        "reading": reading,
        "title": {
            "ko": title_ko,
            "en": title_en,
        },
        "thesis": {
            "ko": thesis_ko,
            "en": thesis_en,
        },
        "explanation": {
            "ko": explanation_ko,
            "en": explanation_en,
        },
        "meaningSummary": {
            "ko": derived_meaning_summary,
            "en": derived_meaning_summary,
        },
        "meaningEvidence": meaning_evidence,
        "mainPassages": curated.get("mainPassages", primary_passages if primary_passages else []) if curated else (primary_passages if primary_passages else []),
        "relatedPassages": curated.get("relatedPassages", related_passages) if curated else related_passages,
        "sourceIds": final_source_ids,
        "supportiveSourceIds": final_supportive_ids,
        "criticalSourceIds": final_critical_ids,
        "relatedEntrySlugs": final_related_entry_slugs,
        "keywords": final_keywords,
        "entryType": "curated" if curated else "generated",
        "sourceCount": len(final_source_ids),
        "supportiveCount": len(final_supportive_ids),
        "criticalCount": len(final_critical_ids),
        "leadCount": len(final_lead_source_ids),
        "titleMentionCount": title_sources,
        "leadSourceIds": final_lead_source_ids,
        "sampleContexts": contexts[:6],
    }


def build_generated_slug(character: str) -> str:
    if len(character) == 1:
        return f"char-{ord(character):04x}"
    joined = "-".join(f"{ord(item):04x}" for item in character)
    return f"char-{joined}"


def main() -> None:
    sources_payload = read_json(SOURCES_PATH, {"sources": []})
    curated_payload = read_json(CURATED_ENTRIES_PATH, {"entries": []})
    sources = [HarvestSource(**item) for item in sources_payload.get("sources", [])]
    curated_entries = curated_payload.get("entries", [])
    curated_by_char = {entry["character"]: entry for entry in curated_entries if isinstance(entry, dict) and entry.get("character")}
    reading_map = build_reading_map(sources)

    manifest = {
        "version": 1,
        "generatedAt": utc_now(),
        "sourceNote": sources_payload.get("sourceNote", {}),
        "sources": [
            {
                "sourceId": source.id,
                "url": source.url,
                "title": source.title,
                "sourceType": detect_source_type(source),
                "kind": source.kind,
                "stance": source.stance,
                "catalogRole": source.catalogRole,
                "language": source.language,
                "section": source.section,
                "subsection": source.subsection,
                "topicTags": source.topicTags,
                "publisher": source.publisher,
                "importLine": source.importLine,
            }
            for source in sources
        ],
    }
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    by_video, by_channel = load_youtube_indexes()
    HARVEST_ROOT.mkdir(parents=True, exist_ok=True)
    EXTRACTED_ROOT.mkdir(parents=True, exist_ok=True)

    documents: list[HarvestDocument] = []
    documents_by_id: dict[str, HarvestDocument] = {}
    evidence_rows: list[dict[str, Any]] = []
    mentions_by_character: dict[str, list[dict[str, Any]]] = defaultdict(list)
    bible_mentions: list[dict[str, Any]] = []
    claim_rows: list[dict[str, Any]] = []
    topic_index: dict[str, list[str]] = defaultdict(list)

    for source in sources:
        if source.kind in {"video", "channel"} and "youtube.com" in source.url:
            document = harvest_youtube_source(source, by_video, by_channel)
        else:
            document = harvest_web_source(source)
        documents.append(document)
        documents_by_id[source.id] = document

    donor_by_isbn = build_donor_by_isbn(sources, documents)
    repaired_documents: list[HarvestDocument] = []
    for source in sources:
        repaired = repair_harvest_document(source, documents_by_id[source.id], donor_by_isbn)
        repaired_documents.append(repaired)
        documents_by_id[source.id] = repaired
        write_document(source, repaired)
    documents = repaired_documents

    for source in sources:
        document = documents_by_id[source.id]
        text_for_extraction = "\n".join(part for part in [source.title, source.notes or "", document.contentText or ""] if part).strip()
        title_characters = extract_title_characters(source.title)
        all_characters = list(dict.fromkeys(HAN_RE.findall(text_for_extraction)))
        references, rejected_references = extract_references(text_for_extraction)
        topic_tags = derive_topic_tags(source, document)
        for tag in topic_tags:
            topic_index[tag].append(source.id)
        evidence_rows.append(
            {
                "sourceId": source.id,
                "title": source.title,
                "status": document.status,
                "sourceType": document.sourceType,
                "references": references,
                "rejectedReferences": rejected_references,
                "characters": all_characters,
                "titleCharacters": title_characters,
                "topics": topic_tags,
            }
        )
        for label in references:
            bible_mentions.append(
                {
                    "sourceId": source.id,
                    "referenceLabel": label,
                    "normalizedReference": reference_to_bible_ref(label),
                    "mentionType": "explicit",
                    "confidence": "high",
                }
            )
        for rejected in rejected_references:
            bible_mentions.append(
                {
                    "sourceId": source.id,
                    "referenceLabel": rejected["referenceLabel"],
                    "normalizedReference": None,
                    "mentionType": "rejected",
                    "confidence": "low",
                    "reason": rejected["reason"],
                    "matchedText": rejected["matchedText"],
                    "aliasPattern": rejected["aliasPattern"],
                }
            )
        source_chars = all_characters
        co_characters = [char for char in source_chars if char]
        for character in source_chars:
            mention = {
                "sourceId": source.id,
                "character": character,
                "reading": reading_map.get(character),
                "count": text_for_extraction.count(character),
                "titleMention": character in title_characters,
                "contexts": extract_contexts(text_for_extraction, character),
                "confidence": "high" if character in title_characters else "medium",
                "references": references,
                "topics": topic_tags,
                "coCharacters": co_characters,
            }
            mentions_by_character[character].append(mention)
        for claim in extract_claim_candidates(document.contentText or text_for_extraction, source_chars[:24], reading_map, source, references):
            claim_rows.append(claim)
    (EXTRACTED_ROOT / "source-evidence.json").write_text(json.dumps({"version": 1, "generatedAt": utc_now(), "rows": evidence_rows}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (EXTRACTED_ROOT / "character-mentions.json").write_text(json.dumps({"version": 1, "generatedAt": utc_now(), "characters": mentions_by_character}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (EXTRACTED_ROOT / "bible-mentions.json").write_text(json.dumps({"version": 1, "generatedAt": utc_now(), "mentions": bible_mentions}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (EXTRACTED_ROOT / "claims.json").write_text(json.dumps({"version": 1, "generatedAt": utc_now(), "claims": claim_rows}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (EXTRACTED_ROOT / "topic-index.json").write_text(json.dumps({"version": 1, "generatedAt": utc_now(), "topics": topic_index}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    claims_by_character: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for claim in claim_rows:
        for character in claim.get("relatedCharacters", []):
            claims_by_character[character].append(claim)

    sources_by_id = {source.id: source for source in sources}
    all_generated_slugs = {character: build_generated_slug(character) for character in mentions_by_character}
    for entry in curated_entries:
        if isinstance(entry, dict) and entry.get("character"):
            all_generated_slugs[entry["character"]] = entry.get("slug", all_generated_slugs.get(entry["character"], build_generated_slug(entry["character"])))

    generated_entries = [
        build_generated_entry(character, all_generated_slugs[character], reading_map, mentions, claims_by_character, sources_by_id, curated_by_char, all_generated_slugs)
        for character, mentions in mentions_by_character.items()
    ]
    generated_entries.sort(key=lambda item: (-item["sourceCount"], item["slug"]))
    published_payload = {
        "version": 1,
        "generatedAt": utc_now(),
        "stats": {
            "sourceCount": len(sources),
            "harvestedDocumentCount": len(documents),
            "characterCount": len(generated_entries),
        },
        "characters": generated_entries,
    }
    PUBLISHED_PATH.write_text(json.dumps(published_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    harvested_ok = sum(1 for doc in documents if doc.status == "ok")
    print(f"Wrote manifest for {len(sources)} sources")
    print(f"Harvested {harvested_ok}/{len(documents)} sources with direct content")
    print(f"Published {len(generated_entries)} Hanja character aggregates")


if __name__ == "__main__":
    main()
