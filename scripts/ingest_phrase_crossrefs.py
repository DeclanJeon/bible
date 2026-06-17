from __future__ import annotations

import json
import re
import urllib.request
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, UTC
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "knowledge"
OUT_PATH = OUT_DIR / "crossreferences-kjv.json"
URL = "https://raw.githubusercontent.com/CrossReferences-org/bible-cross-references/main/kjv/crossreferences_kjv.tsv"

BOOK_MAP = {
    "Gen": "GEN",
    "Exod": "EXO",
    "Lev": "LEV",
    "Num": "NUM",
    "Deut": "DEU",
    "Josh": "JOS",
    "Judg": "JDG",
    "Ruth": "RUT",
    "1 Sam": "1SA",
    "2 Sam": "2SA",
    "1 Kgs": "1KI",
    "2 Kgs": "2KI",
    "1 Chr": "1CH",
    "2 Chr": "2CH",
    "Ezra": "EZR",
    "Neh": "NEH",
    "Esth": "EST",
    "Job": "JOB",
    "Ps": "PSA",
    "Prov": "PRO",
    "Eccl": "ECC",
    "Song": "SOL",
    "Isa": "ISA",
    "Jer": "JER",
    "Lam": "LAM",
    "Ezek": "EZE",
    "Dan": "DAN",
    "Hos": "HOS",
    "Joel": "JOE",
    "Amos": "AMO",
    "Obad": "OBA",
    "Jonah": "JON",
    "Mic": "MIC",
    "Nah": "NAH",
    "Hab": "HAB",
    "Zeph": "ZEP",
    "Hag": "HAG",
    "Zech": "ZEC",
    "Mal": "MAL",
    "Matt": "MAT",
    "Mark": "MAR",
    "Luke": "LUK",
    "John": "JOH",
    "Acts": "ACT",
    "Rom": "ROM",
    "1 Cor": "1CO",
    "2 Cor": "2CO",
    "Gal": "GAL",
    "Eph": "EPH",
    "Phil": "PHI",
    "Col": "COL",
    "1 Thess": "1TH",
    "2 Thess": "2TH",
    "1 Tim": "1TI",
    "2 Tim": "2TI",
    "Titus": "TIT",
    "Phlm": "PHM",
    "Heb": "HEB",
    "Jas": "JAM",
    "1 Pet": "1PE",
    "2 Pet": "2PE",
    "1 John": "1JO",
    "2 John": "2JO",
    "3 John": "3JO",
    "Jude": "JUD",
    "Rev": "REV",
}

ROW_RE = re.compile(r"^(?P<book>(?:[1-3]\s)?[A-Za-z]+)\t(?P<chapter>\d+)\t(?P<verse>\d+)\t(?P<anchor>.*?)\t(?P<refs>.*)$")
REF_RE = re.compile(r"^(?P<book>(?:[1-3]\s)?[A-Za-z]+)\s(?P<chapter>\d+):(?P<verses>[\d,\-]+)$")

@dataclass
class NormalizedRef:
    code: str
    chapter: int
    startVerse: int
    endVerse: int


def fetch_tsv() -> str:
    request = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(request, timeout=120).read().decode("utf-8", "replace")


def normalize_segment(code: str, chapter: int, segment: str) -> NormalizedRef:
    if "-" in segment:
        start, end = segment.split("-", 1)
        return NormalizedRef(code=code, chapter=chapter, startVerse=int(start), endVerse=int(end))
    verse = int(segment)
    return NormalizedRef(code=code, chapter=chapter, startVerse=verse, endVerse=verse)


def parse_reference_token(token: str) -> list[NormalizedRef]:
    token = token.strip()
    match = REF_RE.match(token)
    if not match:
        raise ValueError(f"Unsupported reference token: {token}")
    book = match.group("book")
    chapter = int(match.group("chapter"))
    code = BOOK_MAP[book]
    return [normalize_segment(code, chapter, segment) for segment in match.group("verses").split(",")]


def label(reference: NormalizedRef) -> str:
    if reference.startVerse == reference.endVerse:
        return f"{reference.code} {reference.chapter}:{reference.startVerse}"
    return f"{reference.code} {reference.chapter}:{reference.startVerse}-{reference.endVerse}"


def main() -> None:
    text = fetch_tsv()
    lines = text.splitlines()
    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    skipped = 0
    edges = 0

    for line in lines[1:]:
        if not line.strip():
            continue
        match = ROW_RE.match(line)
        if not match:
            skipped += 1
            continue

        source_code = BOOK_MAP[match.group("book")]
        source_chapter = int(match.group("chapter"))
        source_verse = int(match.group("verse"))
        anchor_phrase = match.group("anchor").strip()
        source_key = f"{source_code} {source_chapter}:{source_verse}"

        try:
            for token in match.group("refs").split("|"):
                for target in parse_reference_token(token):
                    grouped[source_key].append(
                        {
                            "anchorPhrase": anchor_phrase,
                            "to": asdict(target),
                            "toLabel": label(target),
                            "source": "Bible Cross References KJV",
                        }
                    )
                    edges += 1
        except Exception:
            skipped += 1
            continue

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(
            {
                "source": {
                    "name": "Bible Cross References KJV",
                    "url": URL,
                    "license": "CC BY-SA 4.0",
                    "retrievedAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                },
                "stats": {
                    "anchors": len(grouped),
                    "edges": edges,
                    "skipped": skipped,
                },
                "byVerse": grouped,
            },
            ensure_ascii=False,
        ) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT_PATH} with {len(grouped)} anchors and {edges} edges")


if __name__ == "__main__":
    main()
