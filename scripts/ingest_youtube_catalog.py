from __future__ import annotations

import argparse
import csv
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "external" / "youtube"
CHANNELS_PATH = DATA_DIR / "channels.json"
VIDEOS_PATH = DATA_DIR / "videos.json"
TRANSCRIPTS_DIR = DATA_DIR / "transcripts"
SUMMARIES_DIR = DATA_DIR / "summaries"
DEFAULT_TRANSCRIPT_API = os.environ.get("Y2MD_API_URL", "").strip()
TRANSCRIPT_TIMEOUT_SECONDS = 45
CATALOG_VERSION = 1
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "into", "about", "your", "have", "will", "were", "what", "when",
    "where", "who", "why", "how", "than", "then", "them", "they", "their", "there", "you", "are", "not", "but", "all", "can",
    "our", "out", "too", "was", "his", "her", "she", "him", "has", "had", "its", "let", "get", "got", "just", "also", "over",
    "more", "less", "unto", "unto", "thee", "thy", "unto", "and", "우리", "그것", "이것", "저것", "정말", "너무", "오늘", "이번",
    "설교", "강의", "말씀", "성경", "하나님", "예수님", "예수", "주님", "영상", "채널", "내용", "전체", "해설", "시리즈", "묵상",
    "입니다", "합니다", "있는", "하는", "대한", "관련", "에서", "으로", "까지", "그리고", "그러나", "또한", "because", "into", "through"
}

MUSIC_LIKE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bccm\b",
        r"worship",
        r"찬양",
        r"연속\s*듣기",
        r"플레이리스트",
        r"playlist",
        r"기도\s*찬양",
        r"찬양\s*모음",
        r"\d+곡",
    ]
]
BOOK_ALIASES = {
    "GEN": ["genesis", "gen", "ge", "창세기", "창"],
    "EXO": ["exodus", "exo", "ex", "출애굽기", "출"],
    "LEV": ["leviticus", "lev", "레위기", "레"],
    "NUM": ["numbers", "num", "민수기", "민"],
    "DEU": ["deuteronomy", "deut", "deu", "신명기", "신"],
    "JOS": ["joshua", "jos", "수", "여호수아"],
    "JDG": ["judges", "jdg", "삿", "사사기"],
    "RUT": ["ruth", "rut", "룻", "룻기"],
    "1SA": ["1 samuel", "1samuel", "1 sam", "1sam", "사무엘상", "삼상"],
    "2SA": ["2 samuel", "2samuel", "2 sam", "2sam", "사무엘하", "삼하"],
    "1KI": ["1 kings", "1kings", "1 ki", "1ki", "열왕기상", "왕상"],
    "2KI": ["2 kings", "2kings", "2 ki", "2ki", "열왕기하", "왕하"],
    "1CH": ["1 chronicles", "1chronicles", "1 ch", "1ch", "역대상", "대상"],
    "2CH": ["2 chronicles", "2chronicles", "2 ch", "2ch", "역대하", "대하"],
    "EZR": ["ezra", "ezr", "에스라", "스"],
    "NEH": ["nehemiah", "neh", "느헤미야", "느"],
    "EST": ["esther", "est", "에스더", "에"],
    "JOB": ["job", "욥기", "욥"],
    "PSA": ["psalms", "psalm", "ps", "psa", "시편", "시"],
    "PRO": ["proverbs", "proverb", "prov", "pro", "잠언", "잠"],
    "ECC": ["ecclesiastes", "eccl", "ecc", "전도서", "전"],
    "SNG": ["song of songs", "song of solomon", "songs", "song", "sng", "아가"],
    "ISA": ["isaiah", "isa", "이사야", "사"],
    "JER": ["jeremiah", "jer", "예레미야", "렘"],
    "LAM": ["lamentations", "lam", "예레미야애가", "애"],
    "EZK": ["ezekiel", "ezk", "에스겔", "겔"],
    "DAN": ["daniel", "dan", "다니엘", "단"],
    "HOS": ["hosea", "hos", "호세아", "호"],
    "JOL": ["joel", "jol", "joe", "요엘", "욜"],
    "AMO": ["amos", "amo", "아모스", "암"],
    "OBA": ["obadiah", "oba", "오바댜", "옵"],
    "JON": ["jonah", "jon", "요나"],
    "MIC": ["micah", "mic", "미가", "미"],
    "NAM": ["nahum", "nah", "나훔", "나"],
    "HAB": ["habakkuk", "hab", "하박국", "합"],
    "ZEP": ["zephaniah", "zep", "스바냐", "습"],
    "HAG": ["haggai", "hag", "학개", "학"],
    "ZEC": ["zechariah", "zec", "스가랴", "슥"],
    "MAL": ["malachi", "mal", "말라기", "말"],
    "MAT": ["matthew", "matt", "mat", "마태복음", "마"],
    "MAR": ["mark", "mar", "막", "마가복음"],
    "LUK": ["luke", "luk", "누가복음", "눅"],
    "JOH": ["john", "joh", "요한복음", "요"],
    "ACT": ["acts", "act", "사도행전"],
    "ROM": ["romans", "rom", "로마서"],
    "1CO": ["1 corinthians", "1corinthians", "1 cor", "1cor", "고린도전서", "고전"],
    "2CO": ["2 corinthians", "2corinthians", "2 cor", "2cor", "고린도후서", "고후"],
    "GAL": ["galatians", "gal", "갈라디아서", "갈"],
    "EPH": ["ephesians", "eph", "에베소서", "엡"],
    "PHI": ["philippians", "phi", "빌립보서", "빌"],
    "COL": ["colossians", "col", "골로새서", "골"],
    "1TH": ["1 thessalonians", "1thessalonians", "1 thess", "1thess", "데살로니가전서", "살전"],
    "2TH": ["2 thessalonians", "2thessalonians", "2 thess", "2thess", "데살로니가후서", "살후"],
    "1TI": ["1 timothy", "1timothy", "1 tim", "1tim", "디모데전서", "딤전"],
    "2TI": ["2 timothy", "2timothy", "2 tim", "2tim", "디모데후서", "딤후"],
    "TIT": ["titus", "tit", "디도서"],
    "PHM": ["philemon", "phm", "빌레몬서"],
    "HEB": ["hebrews", "heb", "히브리서", "히"],
    "JAM": ["james", "jam", "야고보서", "약"],
    "1PE": ["1 peter", "1peter", "1 pet", "1pet", "베드로전서", "벧전"],
    "2PE": ["2 peter", "2peter", "2 pet", "2pet", "베드로후서", "벧후"],
    "1JO": ["1 john", "1john", "요일", "요한일서"],
    "2JO": ["2 john", "2john", "요이", "요한이서"],
    "3JO": ["3 john", "3john", "요삼", "요한삼서"],
    "JUD": ["jude", "jud", "유다서"],
    "REV": ["revelation", "rev", "계시록", "요한계시록", "계"],
}

EXTRACTABLE_BOOK_ALIASES = {
    code: [alias for alias in aliases if not re.fullmatch(r"[가-힣]", alias)]
    for code, aliases in BOOK_ALIASES.items()
}

BOOK_PATTERN_PARTS = sorted(
    {
        re.escape(alias)
        for aliases in EXTRACTABLE_BOOK_ALIASES.values()
        for alias in aliases
    },
    key=len,
    reverse=True,
)
BOOK_PATTERN = "|".join(BOOK_PATTERN_PARTS)
EXPLICIT_REFERENCE_RE = re.compile(
    rf"(?P<book>{BOOK_PATTERN})(?:\s+)(?P<chapter>\d+)(?!\d)(?!\s*(?:[-~–]\s*\d+\s*장|장\s*(?:부터|[-~–])\s*\d+))(?:\s*(?:[:장])\s*(?P<verse_start>\d+)(?:\s*[-~–]\s*(?P<verse_end>\d+))?)?",
    re.IGNORECASE,
)


@dataclass
class ChannelRecord:
    channelId: str
    channelTitle: str
    sourceUrl: str
    videosUrl: str
    active: bool
    discoveredAt: str
    channelHandle: str | None = None
    notes: str | None = None
    refreshedAt: str | None = None

    def asdict(self) -> dict[str, Any]:
        data = {
            "channelId": self.channelId,
            "channelTitle": self.channelTitle,
            "sourceUrl": self.sourceUrl,
            "videosUrl": self.videosUrl,
            "active": self.active,
            "discoveredAt": self.discoveredAt,
        }
        if self.channelHandle:
            data["channelHandle"] = self.channelHandle
        if self.notes:
            data["notes"] = self.notes
        if self.refreshedAt:
            data["refreshedAt"] = self.refreshedAt
        return data


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def ensure_data_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    SUMMARIES_DIR.mkdir(parents=True, exist_ok=True)


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def load_channels(path: Path = CHANNELS_PATH) -> list[dict[str, Any]]:
    data = read_json(path, {"version": CATALOG_VERSION, "generatedAt": utc_now(), "channels": []})
    if isinstance(data, list):
        return data
    return list(data.get("channels", []))


def load_videos(path: Path = VIDEOS_PATH) -> list[dict[str, Any]]:
    data = read_json(path, {"version": CATALOG_VERSION, "generatedAt": utc_now(), "videos": []})
    if isinstance(data, list):
        return data
    return list(data.get("videos", []))

_REFERENCE_LIMITS: tuple[dict[str, int], dict[tuple[str, int], int]] | None = None


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


def is_valid_reference(code: str, chapter: int, verse_start: int | None, verse_end: int | None) -> bool:
    chapter_limits, verse_limits = load_reference_limits()
    max_chapter = chapter_limits.get(code)
    if max_chapter is None or chapter < 1 or chapter > max_chapter:
        return False
    if verse_start is None:
        return True
    if verse_start < 1:
        return False
    resolved_end = verse_end if verse_end is not None else verse_start
    if resolved_end < verse_start:
        return False
    max_verse = verse_limits.get((code, chapter))
    return max_verse is not None and resolved_end <= max_verse


def persist_channels(channels: list[dict[str, Any]], path: Path = CHANNELS_PATH) -> None:
    ordered = sorted(channels, key=lambda item: (item.get("channelTitle", ""), item.get("channelId", "")))
    write_json(path, {"version": CATALOG_VERSION, "generatedAt": utc_now(), "channels": ordered})


def persist_videos(videos: list[dict[str, Any]], path: Path = VIDEOS_PATH) -> None:
    ordered = sorted(videos, key=lambda item: (item.get("channelTitle", ""), item.get("publishedAt") or "", item.get("videoId", "")))
    write_json(path, {"version": CATALOG_VERSION, "generatedAt": utc_now(), "videos": ordered})


def canonical_channel_urls(channel_id: str, handle: str | None) -> tuple[str, str]:
    if handle:
        normalized_handle = handle if handle.startswith("@") else f"@{handle}"
        return (
            f"https://www.youtube.com/{normalized_handle}",
            f"https://www.youtube.com/{normalized_handle}/videos",
        )
    return (
        f"https://www.youtube.com/channel/{channel_id}",
        f"https://www.youtube.com/channel/{channel_id}/videos",
    )


def normalize_channel_record(raw: dict[str, Any], input_url: str | None = None, previous: dict[str, Any] | None = None) -> dict[str, Any]:
    channel_id = str(raw.get("channel_id") or raw.get("channelId") or raw.get("id") or "").strip()
    if not channel_id:
        raise ValueError(f"Missing channel_id in yt-dlp payload for {input_url or 'record'}")
    channel_title = str(raw.get("channel") or raw.get("channelTitle") or raw.get("uploader") or raw.get("title") or channel_id).strip()
    channel_handle = raw.get("channel_handle") or raw.get("channelHandle") or raw.get("uploader_id")
    if isinstance(channel_handle, str) and channel_handle.startswith("https://"):
        channel_handle = channel_handle.rstrip("/").split("/")[-1]
    if isinstance(channel_handle, str):
        channel_handle = channel_handle.strip() or None
    source_url, videos_url = canonical_channel_urls(channel_id, channel_handle)
    if previous and previous.get("sourceUrl") and previous.get("videosUrl"):
        source_url = str(previous["sourceUrl"])
        videos_url = str(previous["videosUrl"])
    elif isinstance(input_url, str) and "/videos" in input_url:
        parsed = urllib.parse.urlparse(input_url)
        if parsed.netloc in YOUTUBE_HOSTS and parsed.path.startswith("/@"):
            source_url = f"https://www.youtube.com{parsed.path[:-7]}"
            videos_url = f"{source_url}/videos"
        elif parsed.netloc in YOUTUBE_HOSTS and parsed.path.startswith("/channel/"):
            source_url = f"https://www.youtube.com{parsed.path[:-7]}"
            videos_url = f"{source_url}/videos"
    discovered_at = (previous or {}).get("discoveredAt") or utc_now()
    record = ChannelRecord(
        channelId=channel_id,
        channelTitle=channel_title,
        channelHandle=channel_handle,
        sourceUrl=source_url,
        videosUrl=videos_url,
        active=bool(raw.get("active", True) if previous is None else previous.get("active", raw.get("active", True))),
        notes=(previous or {}).get("notes") or raw.get("notes"),
        discoveredAt=discovered_at,
        refreshedAt=utc_now(),
    )
    return record.asdict()


def normalize_input_url(raw_url: str) -> str:
    value = raw_url.strip()
    parsed = urllib.parse.urlparse(value)
    if parsed.scheme not in {"http", "https"} or parsed.netloc not in YOUTUBE_HOSTS:
        raise ValueError(f"Unsupported YouTube input URL: {raw_url}")
    if parsed.netloc == "youtu.be":
        video_id = parsed.path.strip("/")
        return f"https://www.youtube.com/watch?v={video_id}"
    query = urllib.parse.parse_qs(parsed.query)
    if parsed.path == "/watch" and query.get("v"):
        return f"https://www.youtube.com/watch?v={query['v'][0]}"
    if parsed.path.startswith("/shorts/"):
        video_id = parsed.path.split("/", 2)[2]
        return f"https://www.youtube.com/watch?v={video_id}"
    return f"https://www.youtube.com{parsed.path.rstrip('/')}"


def is_video_url(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qs(parsed.query)
    return parsed.path == "/watch" and bool(query.get("v"))


def run_yt_dlp_json(url: str, *, flat_playlist: bool, playlist_end: int | None = None) -> dict[str, Any]:
    command = ["yt-dlp", "--dump-single-json", "--no-update"]
    if flat_playlist:
        command.append("--flat-playlist")
    if playlist_end is not None:
        command.extend(["--playlist-end", str(playlist_end)])
    command.append(url)
    try:
        completed = subprocess.run(command, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise RuntimeError("yt-dlp is required but was not found in PATH") from exc
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        raise RuntimeError(f"yt-dlp failed for {url}: {detail}") from exc
    try:
        return json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"yt-dlp returned invalid JSON for {url}") from exc


def resolve_channel_from_input(input_url: str, previous: dict[str, Any] | None = None) -> dict[str, Any]:
    normalized = normalize_input_url(input_url)
    if is_video_url(normalized):
        payload = run_yt_dlp_json(normalized, flat_playlist=False)
        return normalize_channel_record(payload, input_url=normalized, previous=previous)
    payload = run_yt_dlp_json(normalized, flat_playlist=True, playlist_end=1)
    return normalize_channel_record(payload, input_url=normalized, previous=previous)


def sanitize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def slugify(value: str) -> str:
    lowered = value.lower()
    lowered = re.sub(r"[^\w\s-]", " ", lowered, flags=re.UNICODE)
    lowered = re.sub(r"\s+", "-", lowered).strip("-")
    return lowered


def alias_to_code(alias: str) -> str | None:
    normalized = alias.lower().strip().replace(" ", " ")
    normalized = re.sub(r"\s+", " ", normalized)
    for code, aliases in EXTRACTABLE_BOOK_ALIASES.items():
        if normalized in aliases:
            return code
    return None


def normalize_reference(code: str, chapter: int, verse_start: int | None, verse_end: int | None) -> str:
    if verse_start is None:
        return f"{code} {chapter}"
    if verse_end is None or verse_end == verse_start:
        return f"{code} {chapter}:{verse_start}"
    return f"{code} {chapter}:{verse_start}-{verse_end}"


def extract_mentioned_passages(*parts: str) -> list[str]:
    seen: set[str] = set()
    combined = "\n".join(part for part in parts if part)
    for match in EXPLICIT_REFERENCE_RE.finditer(combined):
        code = alias_to_code(match.group("book"))
        if not code:
            continue
        chapter = int(match.group("chapter"))
        verse_start = match.group("verse_start")
        verse_end = match.group("verse_end")
        if not is_valid_reference(
            code,
            chapter,
            int(verse_start) if verse_start else None,
            int(verse_end) if verse_end else None,
        ):
            continue
        raw_match = match.group(0)
        if re.search(r"\d+\s*[-~–]\s*\d+\s*장", raw_match):
            continue
        normalized = normalize_reference(
            code,
            chapter,
            int(verse_start) if verse_start else None,
            int(verse_end) if verse_end else None,
        )
        seen.add(normalized)
    return sorted(seen)


def summarize_text(*parts: str, sentence_limit: int = 4) -> str | None:
    text = sanitize_text(" ".join(part for part in parts if part))
    if not text:
        return None
    sentences = re.split(r"(?<=[.!?다])\s+", text)
    cleaned = [segment.strip() for segment in sentences if segment.strip()]
    if not cleaned:
        return None
    return " ".join(cleaned[:sentence_limit])[:700].strip()


def extract_keywords(*parts: str, limit: int = 10) -> list[str]:
    text = " ".join(part for part in parts if part)
    if not text:
        return []
    hash_tags = [token[1:] for token in re.findall(r"#([\w가-힣-]{2,40})", text)]
    words = re.findall(r"[A-Za-z][A-Za-z'\-]{2,}|[가-힣]{2,}", text)
    counts: Counter[str] = Counter()
    ordered: list[str] = []
    for token in hash_tags + words:
        normalized = token.lower() if re.match(r"[A-Za-z]", token) else token
        normalized = normalized.strip("-'")
        if len(normalized) < 2 or normalized in STOPWORDS:
            continue
        counts[normalized] += 1
        if normalized not in ordered:
            ordered.append(normalized)
    ranked = sorted(ordered, key=lambda item: (-counts[item], ordered.index(item), item))
    return ranked[:limit]


def derive_topics(mentioned_passages: list[str], keywords: list[str], limit: int = 8) -> list[str]:
    topics: list[str] = []
    for label in mentioned_passages:
        book_code = label.split(" ", 1)[0]
        if book_code not in topics:
            topics.append(book_code)
    for keyword in keywords:
        if keyword not in topics:
            topics.append(keyword)
        if len(topics) >= limit:
            break
    return topics[:limit]


def cached_transcript_path(video_id: str) -> Path:
    return TRANSCRIPTS_DIR / f"{video_id}.md"


def cached_summary_path(video_id: str) -> Path:
    return SUMMARIES_DIR / f"{video_id}.json"


def fetch_transcript(video_url: str, *, language: str, api_url: str) -> dict[str, Any] | None:
    if not api_url:
        return None
    payload = json.dumps(
        {
            "url": video_url,
            "language": language,
            "include_timestamps": False,
            "include_metadata": True,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        api_url,
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=TRANSCRIPT_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace") if exc.fp else str(exc)
        raise RuntimeError(f"y2md HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"y2md request failed: {exc.reason}") from exc


def transcript_markdown_from_payload(payload: dict[str, Any]) -> str | None:
    for key in ("markdown", "transcript_markdown", "transcriptMarkdown", "content", "body"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    transcript = payload.get("transcript")
    if isinstance(transcript, str) and transcript.strip():
        return transcript.strip()
    return None


def transcript_status_from_cache_or_fetch(video_id: str, video_url: str, *, language: str, api_url: str, refresh: bool) -> tuple[str, str | None, str | None]:
    transcript_path = cached_transcript_path(video_id)
    if transcript_path.exists() and not refresh:
        return "ok", str(transcript_path.relative_to(ROOT)).replace("\\", "/"), transcript_path.read_text(encoding="utf-8")
    if not api_url:
        if transcript_path.exists():
            return "ok", str(transcript_path.relative_to(ROOT)).replace("\\", "/"), transcript_path.read_text(encoding="utf-8")
        return "missing", None, None
    try:
        payload = fetch_transcript(video_url, language=language, api_url=api_url)
    except RuntimeError:
        return "error", None, None
    if not payload:
        return "missing", None, None
    markdown = transcript_markdown_from_payload(payload)
    if not markdown:
        return "missing", None, None
    transcript_path.parent.mkdir(parents=True, exist_ok=True)
    transcript_path.write_text(markdown + "\n", encoding="utf-8")
    return "ok", str(transcript_path.relative_to(ROOT)).replace("\\", "/"), markdown


def classify_resource_kind(title: str, description: str | None, summary: str | None) -> str:
    title_text = title or ""
    summary_text = " ".join(part for part in [summary or "", description or ""] if part)
    teaching_signals = ["해설", "정리", "분석", "설명", "이야기", "비밀", "계보", "회심", "완벽", "누구", "이유"]
    if any(pattern.search(title_text) for pattern in MUSIC_LIKE_PATTERNS):
        return "music"
    if any(signal in title_text or signal in summary_text for signal in teaching_signals):
        return "teaching"
    return "teaching"
def persist_summary(video_id: str, summary: str | None, keywords: list[str], topics: list[str], mentioned_passages: list[str]) -> None:
    if not summary and not keywords and not topics and not mentioned_passages:
        return
    summary_path = cached_summary_path(video_id)
    write_json(
        summary_path,
        {
            "videoId": video_id,
            "summary": summary,
            "keywords": keywords,
            "topics": topics,
            "mentionedPassages": mentioned_passages,
            "generatedAt": utc_now(),
            "provenance": {
                "summary": "deterministic",
                "passageExtraction": "deterministic",
            },
        },
    )


def normalize_video_record(entry: dict[str, Any], channel: dict[str, Any], *, transcript_api: str, transcript_language: str, refresh_transcripts: bool) -> dict[str, Any]:
    video_id = str(entry.get("id") or entry.get("videoId") or "").strip()
    if not video_id:
        raise ValueError(f"Missing video id for channel {channel.get('channelId')}")
    url = str(entry.get("url") or entry.get("webpage_url") or f"https://www.youtube.com/watch?v={video_id}")
    if not url.startswith("http"):
        url = f"https://www.youtube.com/watch?v={video_id}"
    title = sanitize_text(str(entry.get("title") or video_id))
    description = sanitize_text(str(entry.get("description") or "")) or None
    transcript_status, transcript_path, transcript_markdown = transcript_status_from_cache_or_fetch(
        video_id,
        url,
        language=transcript_language,
        api_url=transcript_api,
        refresh=refresh_transcripts,
    )
    mentioned_passages = extract_mentioned_passages(title, description or "", transcript_markdown or "")
    keywords = extract_keywords(title, description or "", transcript_markdown or "")
    topics = derive_topics(mentioned_passages, keywords)
    summary = summarize_text(description or "", transcript_markdown or title)
    persist_summary(video_id, summary, keywords, topics, mentioned_passages)
    resource_kind = classify_resource_kind(title, description, summary)
    record: dict[str, Any] = {
        "videoId": video_id,
        "channelId": channel["channelId"],
        "channelTitle": channel["channelTitle"],
        "title": title,
        "url": url,
        "transcriptStatus": transcript_status,
        "mentionedPassages": mentioned_passages,
        "keywords": keywords,
        "topics": topics,
        "resourceKind": resource_kind,
        "sourceKind": "channel",
        "provenance": {
            "catalog": "yt-dlp",
            "summary": "deterministic",
            "passageExtraction": "deterministic",
        },
        "crawledAt": utc_now(),
    }
    if channel.get("channelHandle"):
        record["channelHandle"] = channel["channelHandle"]
    if transcript_path:
        record["transcriptPath"] = transcript_path
    if summary:
        record["summary"] = summary
    published = entry.get("upload_date") or entry.get("release_date") or entry.get("timestamp")
    if isinstance(published, str) and re.fullmatch(r"\d{8}", published):
        record["publishedAt"] = f"{published[:4]}-{published[4:6]}-{published[6:]}"
    elif isinstance(published, (int, float)):
        record["publishedAt"] = datetime.fromtimestamp(published, tz=timezone.utc).date().isoformat()
    elif isinstance(entry.get("release_timestamp"), (int, float)):
        record["publishedAt"] = datetime.fromtimestamp(entry["release_timestamp"], tz=timezone.utc).date().isoformat()
    duration = entry.get("duration") or entry.get("durationSeconds")
    if isinstance(duration, (int, float)):
        record["durationSeconds"] = int(duration)
    elif isinstance(duration, str) and duration.isdigit():
        record["durationSeconds"] = int(duration)
    availability = str(entry.get("availability") or "").lower()
    if entry.get("availability") in {"private", "subscriber_only"} or availability in {"private", "subscriber_only"}:
        record["availability"] = availability
    if transcript_status == "ok" and transcript_api:
        record["provenance"]["transcript"] = "y2md"
    return record


def discover_videos_for_channel(channel: dict[str, Any], *, transcript_api: str, transcript_language: str, refresh_transcripts: bool) -> list[dict[str, Any]]:
    payload = run_yt_dlp_json(channel["videosUrl"], flat_playlist=False)
    entries = payload.get("entries") or []
    videos: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        video_id = str(entry.get("id") or "").strip()
        if not video_id or video_id in seen_ids:
            continue
        seen_ids.add(video_id)
        videos.append(
            normalize_video_record(
                entry,
                channel,
                transcript_api=transcript_api,
                transcript_language=transcript_language,
                refresh_transcripts=refresh_transcripts,
            )
        )
    return videos


def export_csv(videos: list[dict[str, Any]], path: Path) -> None:
    fieldnames = [
        "video_id",
        "channel_id",
        "channel_title",
        "channel_handle",
        "title",
        "url",
        "published_at",
        "duration_seconds",
        "description",
        "summary",
        "mentioned_passages_json",
        "keywords_json",
        "topics_json",
        "resource_kind",
        "transcript_status",
        "transcript_path",
        "crawled_at",
        "refreshed_at",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for video in videos:
            writer.writerow(
                {
                    "video_id": video.get("videoId", ""),
                    "channel_id": video.get("channelId", ""),
                    "channel_title": video.get("channelTitle", ""),
                    "channel_handle": video.get("channelHandle", ""),
                    "title": video.get("title", ""),
                    "url": video.get("url", ""),
                    "published_at": video.get("publishedAt", ""),
                    "duration_seconds": video.get("durationSeconds", ""),
                    "description": video.get("description", ""),
                    "summary": video.get("summary", ""),
                    "mentioned_passages_json": json.dumps(video.get("mentionedPassages", []), ensure_ascii=False),
                    "keywords_json": json.dumps(video.get("keywords", []), ensure_ascii=False),
                    "topics_json": json.dumps(video.get("topics", []), ensure_ascii=False),
                    "resource_kind": video.get("resourceKind", "teaching"),
                    "transcript_status": video.get("transcriptStatus", ""),
                    "transcript_path": video.get("transcriptPath", ""),
                    "crawled_at": video.get("crawledAt", ""),
                    "refreshed_at": video.get("refreshedAt", ""),
                }
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest a local YouTube teaching catalog into canonical JSON artifacts.")
    parser.add_argument("inputs", nargs="*", help="Optional channel or video URLs to normalize and add to the curated channel catalog.")
    parser.add_argument("--channels-path", default=str(CHANNELS_PATH), help="Path to channels.json.")
    parser.add_argument("--videos-path", default=str(VIDEOS_PATH), help="Path to videos.json.")
    parser.add_argument("--transcript-api", default=DEFAULT_TRANSCRIPT_API, help="Optional y2md transcript API endpoint.")
    parser.add_argument("--transcript-language", default="ko", help="Transcript language to request when transcript API is enabled.")
    parser.add_argument("--refresh-channels", action="store_true", help="Re-resolve every configured channel via yt-dlp.")
    parser.add_argument("--discover-videos", action="store_true", help="Discover videos for each active channel using yt-dlp.")
    parser.add_argument("--refresh-transcripts", action="store_true", help="Ignore cached transcript markdown and fetch again when transcript API is enabled.")
    parser.add_argument("--csv-path", default="", help="Optional CSV path to export after ingestion.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ensure_data_dirs()
    channels_path = Path(args.channels_path)
    videos_path = Path(args.videos_path)

    existing_channels = load_channels(channels_path)
    by_channel_id = {item.get("channelId"): dict(item) for item in existing_channels if item.get("channelId")}

    if args.refresh_channels:
        refreshed: dict[str, dict[str, Any]] = {}
        for current in existing_channels:
            resolved = resolve_channel_from_input(current.get("videosUrl") or current.get("sourceUrl"), previous=current)
            refreshed[resolved["channelId"]] = resolved
        by_channel_id = refreshed

    for raw_input in args.inputs:
        resolved = resolve_channel_from_input(raw_input)
        prior = by_channel_id.get(resolved["channelId"])
        by_channel_id[resolved["channelId"]] = normalize_channel_record(resolved, previous=prior)

    channels = list(by_channel_id.values())
    persist_channels(channels, channels_path)

    all_videos = load_videos(videos_path)
    if args.discover_videos:
        by_video_id = {item.get("videoId"): dict(item) for item in all_videos if item.get("videoId")}
        for channel in channels:
            if not channel.get("active", True):
                continue
            discovered = discover_videos_for_channel(
                channel,
                transcript_api=args.transcript_api,
                transcript_language=args.transcript_language,
                refresh_transcripts=args.refresh_transcripts,
            )
            for video in discovered:
                previous = by_video_id.get(video["videoId"])
                if previous and previous.get("crawledAt"):
                    video["crawledAt"] = previous["crawledAt"]
                    video["refreshedAt"] = utc_now()
                by_video_id[video["videoId"]] = video
        all_videos = list(by_video_id.values())
        persist_videos(all_videos, videos_path)

    if args.csv_path:
        export_csv(all_videos, Path(args.csv_path))

    print(
        json.dumps(
            {
                "channels": len(channels),
                "videos": len(all_videos),
                "channelsPath": str(channels_path.relative_to(ROOT)) if channels_path.is_absolute() else str(channels_path),
                "videosPath": str(videos_path.relative_to(ROOT)) if videos_path.is_absolute() else str(videos_path),
                "csvPath": args.csv_path or None,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
