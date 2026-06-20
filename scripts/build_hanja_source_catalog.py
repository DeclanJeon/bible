from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = ROOT / "data" / "hanja" / "import" / "related-links.md"
OUTPUT_PATH = ROOT / "data" / "hanja" / "sources.json"
URL_RE = re.compile(r"https?://\S+")
EMOJI_PREFIX_RE = re.compile(r"^[^\w\s#]+\s*")
STRONG_RE = re.compile(r"\*\*(.*?)\*\*")


@dataclass
class ParsedLink:
    section: str
    subsection: str | None
    title: str
    url: str
    line: int
    notes: list[str]


@dataclass
class HanjaSource:
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


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")
    return re.sub(r"-{2,}", "-", slug)


def clean_text(value: str) -> str:
    value = value.strip()
    value = STRONG_RE.sub(r"\1", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip(" -:")


def clean_heading(value: str) -> str:
    return clean_text(EMOJI_PREFIX_RE.sub("", value))


def extract_primary_title(value: str) -> tuple[str, str | None]:
    match = STRONG_RE.search(value)
    if not match:
        return clean_text(value), None
    strong = clean_text(match.group(1))
    remainder = clean_text(value.replace(match.group(0), "", 1))
    remainder = remainder.lstrip("—- ")
    if remainder:
        return f"{strong} — {remainder}", strong
    return strong, strong


def parse_markdown_links(text: str) -> list[ParsedLink]:
    links: list[ParsedLink] = []
    current_section: str | None = None
    current_subsection: str | None = None
    pending_title: str | None = None
    pending_notes: list[str] = []

    for index, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            pending_title = None
            pending_notes = []
            continue
        if line == "---":
            pending_title = None
            pending_notes = []
            continue
        if line.startswith("# "):
            continue
        if line.startswith("## "):
            current_section = clean_heading(line[3:])
            current_subsection = None
            pending_title = None
            pending_notes = []
            continue
        if line.startswith("### "):
            current_subsection = clean_heading(line[4:])
            pending_title = None
            pending_notes = []
            continue
        if line.startswith(">"):
            pending_notes.append(clean_text(line.lstrip("> ")))
            continue
        if current_section is None:
            continue

        url_match = URL_RE.search(line)
        if line.startswith("|") and not url_match:
            continue

        if line.startswith("|") and url_match:
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            if len(cells) >= 3 and cells[0] != "강":
                title = clean_text(cells[-2])
                url = url_match.group(0)
                links.append(
                    ParsedLink(
                        section=current_section,
                        subsection=current_subsection,
                        title=title,
                        url=url,
                        line=index,
                        notes=pending_notes.copy(),
                    )
                )
            continue

        if line.startswith("- "):
            bullet = line[2:].strip()
            if url_match:
                url = url_match.group(0)
                title = clean_text(bullet.replace(url, " "))
                links.append(
                    ParsedLink(
                        section=current_section,
                        subsection=current_subsection,
                        title=title,
                        url=url,
                        line=index,
                        notes=pending_notes.copy(),
                    )
                )
                pending_title = None
                continue

            pending_title = bullet
            pending_notes = []
            continue

        if url_match and pending_title:
            links.append(
                ParsedLink(
                    section=current_section,
                    subsection=current_subsection,
                    title=clean_text(pending_title),
                    url=url_match.group(0),
                    line=index,
                    notes=pending_notes.copy(),
                )
            )
            pending_title = None
            continue

        if pending_title:
            pending_title = f"{pending_title} {line}"
        else:
            pending_notes = [*pending_notes, clean_text(line)]

    return links


def language_for(link: ParsedLink) -> str:
    text = f"{link.section} {link.subsection or ''} {link.title} {' '.join(link.notes)}"
    if "중국어" in link.section or "Baidu" in link.section:
        return "zh"
    if "영문" in link.section or ("YouTube" in link.section and link.subsection == "주요 영문 영상"):
        return "en"
    if re.search(r"[가-힣]", text):
        return "ko"
    if re.search(r"[A-Za-z]", text):
        return "en"
    if any("\u4e00" <= ch <= "\u9fff" for ch in text):
        return "zh"
    return "ko"


def catalog_role_for(link: ParsedLink) -> str:
    if "검색" in link.section or "Baidu" in link.section or "Naver 블로그" in link.section:
        return "lead"
    return "curated"


def kind_for(link: ParsedLink) -> str:
    url = link.url.lower()
    title = link.title.lower()
    if "youtube.com/@" in url:
        return "channel"
    if "youtube.com/watch" in url:
        return "video"
    if "riss.kr/search" in url or "baidu.com/s" in url:
        return "search"
    if "blog.naver.com" in url:
        return "blog"
    if url.endswith(".pdf") or "paper" in title or "논문" in link.title:
        return "paper"
    if "도서 정보" in link.section or "kyobobook" in url or "yes24" in url or "book" in url:
        return "book"
    if "전체 목록" in link.title or "dictionary" in url or "staff" in url:
        return "reference"
    return "article"


def stance_for(link: ParsedLink) -> str:
    joined = f"{link.section} {link.title} {' '.join(link.notes)}"
    if "비평" in joined or "반대 관점" in joined or "critique" in joined.lower() or "sino-platonic" in link.url.lower():
        return "critical"
    if catalog_role_for(link) == "lead":
        return "unclear"
    return "supportive"


def publisher_for(link: ParsedLink) -> str | None:
    title, strong = extract_primary_title(link.title)
    if strong:
        return strong

    host = urlparse(link.url).netloc.lower().removeprefix("www.")
    known = {
        "londontimes.tv": "런던타임즈",
        "creation.kr": "한국창조과학회",
        "answersingenesis.org": "Answers in Genesis",
        "icr.org": "Institute for Creation Research",
        "creation.com": "Creation.com",
        "sino-platonic.org": "Sino-Platonic Papers",
        "youtube.com": "YouTube",
        "keepbible.com": "KeepBible",
        "biblescience.org": "Bible Science",
        "wordsquare.org": "WordSquare",
        "riss.kr": "RISS",
        "baidu.com": "Baidu",
        "blog.naver.com": "Naver Blog",
    }
    return known.get(host)


def provider_slug(link: ParsedLink) -> str:
    host = urlparse(link.url).netloc.lower().removeprefix("www.")
    overrides = {
        "londontimes.tv": "londontimes",
        "creation.kr": "creation-kr",
        "answersingenesis.org": "answers-in-genesis",
        "icr.org": "institute-for-creation-research",
        "creation.com": "creation-com",
        "sino-platonic.org": "sino-platonic-papers",
        "youtube.com": "youtube",
        "keepbible.com": "keepbible",
        "biblescience.org": "bible-science",
        "wordsquare.org": "wordsquare",
        "riss.kr": "riss",
        "baidu.com": "baidu",
        "blog.naver.com": "naver-blog",
    }
    return overrides.get(host, slugify(host.replace(".", "-")) or "source")


def title_slug(link: ParsedLink) -> str:
    title, _ = extract_primary_title(link.title)
    title_parts = [clean_text(part) for part in title.split("—") if clean_text(part)]
    candidate_inputs = [title_parts[-1]] if len(title_parts) > 1 else []
    candidate_inputs.extend([
        title,
        title.replace("—", " "),
        title.replace("漢字", "hanja").replace("創世記", "genesis"),
    ])

    for raw_candidate in candidate_inputs:
        candidate = slugify(raw_candidate)
        if candidate:
            return candidate

    parsed = urlparse(link.url)
    if "youtube.com" in parsed.netloc.lower():
        query = parse_qs(parsed.query)
        video_id = query.get("v", [None])[0]
        if video_id:
            return video_id.lower()
        handle = parsed.path.strip("/").replace("@", "")
        if handle:
            return slugify(unquote(handle)) or "channel"

    path_bits = [slugify(unquote(bit)) for bit in parsed.path.split("/") if slugify(unquote(bit))]
    if path_bits:
        return "-".join(path_bits[-2:]) if len(path_bits) > 1 else path_bits[-1]

    query_bits: list[str] = []
    for values in parse_qs(parsed.query).values():
        for value in values:
            candidate = slugify(unquote(value))
            if candidate:
                query_bits.append(candidate)
    if query_bits:
        return "-".join(query_bits[:2])

    return "item"


def topic_tags_for(link: ParsedLink) -> list[str]:
    text = f"{link.section} {link.subsection or ''} {link.title} {' '.join(link.notes)}"
    tags = ["hanja", "bible"]

    if "창세기" in text or "genesis" in text.lower():
        tags.append("genesis")
    if "예수" in text or "gospel" in text.lower() or "jesus" in text.lower():
        tags.append("jesus")
    if "의(義)" in text or "옳을 의" in text or "righteousness" in text.lower():
        tags.extend(["의", "righteousness"])
    if "복(福)" in text or "blessing" in text.lower():
        tags.extend(["복", "blessing"])
    if "신(神)" in text or "god" in text.lower() or "spirit" in text.lower():
        tags.extend(["신", "god-spirit"])
    if kind_for(link) in {"video", "channel"}:
        tags.append("video")
    if catalog_role_for(link) == "lead":
        tags.append("lead")
    if stance_for(link) == "critical":
        tags.append("critical-review")

    seen: set[str] = set()
    ordered: list[str] = []
    for tag in tags:
        normalized = slugify(tag).replace("god-spirit", "god-spirit")
        if tag in {"의", "복", "신"}:
            normalized = tag
        if normalized and normalized not in seen:
            ordered.append(normalized)
            seen.add(normalized)
    return ordered


def build_sources(links: Iterable[ParsedLink]) -> list[HanjaSource]:
    sources: list[HanjaSource] = []
    id_counts: dict[str, int] = {}

    for link in links:
        title, _ = extract_primary_title(link.title)
        base_id = f"hanja-src-{provider_slug(link)}-{title_slug(link)}"
        duplicate_count = id_counts.get(base_id, 0) + 1
        id_counts[base_id] = duplicate_count
        source_id = base_id if duplicate_count == 1 else f"{base_id}-{duplicate_count}"

        note_parts = [*link.notes]
        if link.subsection and link.subsection not in note_parts:
            note_parts.insert(0, link.subsection)

        sources.append(
            HanjaSource(
                id=source_id,
                title=title,
                url=link.url,
                kind=kind_for(link),
                language=language_for(link),
                stance=stance_for(link),
                catalogRole=catalog_role_for(link),
                publisher=publisher_for(link),
                section=link.section,
                subsection=link.subsection,
                topicTags=topic_tags_for(link),
                notes=" | ".join(note_parts) if note_parts else None,
                importLine=link.line,
            )
        )

    return sources


def main() -> None:
    if not INPUT_PATH.exists():
        raise SystemExit(
            f"Missing portable Hanja seed note: {INPUT_PATH}. Copy the approved markdown into that path and rerun this script."
        )

    text = INPUT_PATH.read_text(encoding="utf-8")
    parsed_links = parse_markdown_links(text)
    sources = build_sources(parsed_links)
    if len(parsed_links) < 10 or len(sources) < 10:
        raise SystemExit(
            f"Portable Hanja import produced too few sources ({len(sources)}) from {len(parsed_links)} parsed links. Refuse to write a suspiciously incomplete catalog."
        )

    payload = {
        "version": 1,
        "sourceNote": {
            "path": str(INPUT_PATH.relative_to(ROOT)).replace("\\", "/"),
            "importedAt": now_iso(),
            "linkCount": len(sources),
        },
        "sources": [asdict(source) for source in sources],
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} with {len(sources)} sources")


if __name__ == "__main__":
    main()
