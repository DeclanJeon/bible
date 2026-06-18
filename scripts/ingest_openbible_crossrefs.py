from __future__ import annotations

import io
import json
import re
import urllib.request
import zipfile
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, UTC
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "knowledge"
OUT_PATH = OUT_DIR / "openbible-crossrefs.json"
URL = "https://a.openbible.info/data/cross-references.zip"

BOOK_MAP = {
    "Gen": "GEN",
    "Exod": "EXO",
    "Lev": "LEV",
    "Num": "NUM",
    "Deut": "DEU",
    "Josh": "JOS",
    "Judg": "JDG",
    "Ruth": "RUT",
    "1Sam": "1SA",
    "2Sam": "2SA",
    "1Kgs": "1KI",
    "2Kgs": "2KI",
    "1Chr": "1CH",
    "2Chr": "2CH",
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
    "1Cor": "1CO",
    "2Cor": "2CO",
    "Gal": "GAL",
    "Eph": "EPH",
    "Phil": "PHI",
    "Col": "COL",
    "1Thess": "1TH",
    "2Thess": "2TH",
    "1Tim": "1TI",
    "2Tim": "2TI",
    "Titus": "TIT",
    "Phlm": "PHM",
    "Heb": "HEB",
    "Jas": "JAM",
    "1Pet": "1PE",
    "2Pet": "2PE",
    "1John": "1JO",
    "2John": "2JO",
    "3John": "3JO",
    "Jude": "JUD",
    "Rev": "REV",
}

REF_RE = re.compile(r"^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$")


@dataclass
class NormalizedRef:
    code: str
    chapter: int
    startVerse: int
    endVerse: int


def parse_single(token: str) -> tuple[str, int, int]:
    match = REF_RE.match(token)
    if not match:
        raise ValueError(f"Unsupported reference token: {token}")
    book, chapter, verse = match.groups()
    code = BOOK_MAP[book]
    return code, int(chapter), int(verse)


def parse_reference(raw: str) -> tuple[NormalizedRef, bool]:
    if "-" not in raw:
        code, chapter, verse = parse_single(raw)
        return NormalizedRef(code=code, chapter=chapter, startVerse=verse, endVerse=verse), False

    start_raw, end_raw = raw.split("-", 1)
    start_code, start_chapter, start_verse = parse_single(start_raw)
    end_code, end_chapter, end_verse = parse_single(end_raw)

    if start_code != end_code or start_chapter != end_chapter:
        # Keep the start anchor only when a range spans further than our current UI can render cleanly.
        return NormalizedRef(code=start_code, chapter=start_chapter, startVerse=start_verse, endVerse=start_verse), True

    return NormalizedRef(code=start_code, chapter=start_chapter, startVerse=start_verse, endVerse=end_verse), False


def label(reference: NormalizedRef) -> str:
    if reference.startVerse == reference.endVerse:
        return f"{reference.code} {reference.chapter}:{reference.startVerse}"
    return f"{reference.code} {reference.chapter}:{reference.startVerse}-{reference.endVerse}"


def download_source() -> str:
    request = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    payload = urllib.request.urlopen(request, timeout=120).read()
    archive = zipfile.ZipFile(io.BytesIO(payload))
    return archive.read("cross_references.txt").decode("utf-8", "replace")


def main() -> None:
    text = download_source()
    rows = text.splitlines()
    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    skipped = 0
    total_edges = 0

    collapsed_ranges = 0
    for line in rows[1:]:
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) < 3:
            skipped += 1
            continue

        from_raw, to_raw, votes_raw = parts[:3]

        try:
            from_ref, from_collapsed = parse_reference(from_raw)
            to_ref, to_collapsed = parse_reference(to_raw)
            votes = int(votes_raw)
        except Exception:
            skipped += 1
            continue

        if votes <= 0:
            continue

        if from_collapsed:
            collapsed_ranges += 1
        if to_collapsed:
            collapsed_ranges += 1

        grouped[label(from_ref)].append(
            {
                "to": asdict(to_ref),
                "toLabel": label(to_ref),
                "votes": votes,
                "source": "OpenBible Cross References",
                "rawFrom": from_raw,
                "rawTo": to_raw,
                "normalizationLoss": from_collapsed or to_collapsed,
            }
        )
        total_edges += 1

    normalized = {
        key: sorted(value, key=lambda item: int(item["votes"]), reverse=True)
        for key, value in grouped.items()
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(
            {
                "source": {
                    "name": "OpenBible Cross References",
                    "url": URL,
                    "license": "CC BY 4.0",
                    "retrievedAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                },
                "stats": {
                    "anchors": len(normalized),
                    "edges": total_edges,
                    "skipped": skipped,
                    "skippedSourceRows": skipped,
                    "unsupportedRanges": 0,
                    "collapsedRanges": collapsed_ranges,
                },
                "byVerse": normalized,
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT_PATH} with {len(normalized)} anchors and {total_edges} edges")


if __name__ == "__main__":
    main()
