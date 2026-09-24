from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import datetime, UTC
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
WEB_META = ROOT / "world_english_bible" / "metadata.json"
KOR_META = ROOT / "korean_bible" / "metadata.json"
WEB_VPL = ROOT / "world_english_bible" / "canon_66_vpl.txt"
OUT_DIR = ROOT / "data" / "chapter-background"
VERSION = "chapter-background-2026-08-v1"

VPL_LINE_RE = re.compile(r"^([0-9A-Z]{3})\s+(\d+):(\d+)\s+")

GROUPS = [
    (["GEN","EXO","LEV","NUM","DEU"], "Torah · origins, covenant story, and law", "토라 · 기원 · 언약 이야기와 율법"),
    (["JOS","JDG","RUT","1SA","2SA","1KI","2KI","1CH","2CH","EZR","NEH","EST"], "Historical narrative · covenant memory and national transition", "역사 서사 · 언약 기억과 국가적 전환"),
    (["JOB","PSA","PRO","ECC","SOL"], "Poetry and wisdom · worship, suffering, reflection, and love", "시와 지혜 · 예배 · 고난 · 성찰 · 사랑"),
    (["ISA","JER","LAM","EZE","DAN","HOS","JOE","AMO","OBA","JON","MIC","NAH","HAB","ZEP","HAG","ZEC","MAL"], "Prophetic literature · judgment, hope, and covenant summons", "예언 문학 · 심판 · 소망 · 언약의 부르심"),
    (["MAT","MAR","LUK","JOH"], "Gospel narrative · Jesus' life, teaching, death, and resurrection", "복음서 · 예수님의 삶 · 가르침 · 죽음 · 부활"),
    (["ACT"], "Narrative history · apostolic mission and church expansion", "서사 역사 · 사도적 선교와 교회의 확장"),
    (["ROM","1CO","2CO","GAL","EPH","PHI","COL","1TH","2TH","PHM"], "Pauline letter · gospel instruction and church formation", "바울 서신 · 복음의 가르침과 교회 형성"),
    (["1TI","2TI","TIT"], "Pastoral letter · leadership, endurance, and church order", "목회 서신 · 지도력 · 인내 · 교회 질서"),
    (["HEB","JAM","1PE","2PE","1JO","2JO","3JO","JUD"], "General epistle · exhortation, endurance, and faithful witness", "공동 서신 · 권면 · 인내 · 신실한 증언"),
    (["REV"], "Apocalypse · prophecy and circular church letter", "묵시 · 예언 · 순환 서신"),
]

GROUP_HISTORICAL_EN = {
    "GEN": "Traditionally associated with Moses; final form shaped through long transmission. Settings move through Mesopotamia, Canaan, Egypt, and the wilderness.",
    "JOS": "Prophetic/scribal historians reflecting on conquest through restoration. Geography centers on the land, covenant sites, exile, and return.",
    "JOB": "Poetic and wisdom collections, likely shaped across multiple periods. Setting is Israel's worship and wisdom traditions rather than a single site.",
    "ISA": "Prophetic oracles from Assyrian through post-exilic crises. Horizon centers on Israel, Judah, Jerusalem, exile, and surrounding nations.",
    "MAT": "First-century CE Gospel narrative. Stories unfold in Galilee, Judea, and Jerusalem; final composition location is reconstructed.",
    "ACT": "Second volume of Luke-Acts. Moves from Jerusalem through Judea, Samaria, and the Mediterranean world.",
    "ROM": "Mid-first-century letter from the eastern Mediterranean mission field, moving between cities, house churches, and travel networks.",
    "1TI": "Pastoral letter network of early Christian mission and congregational oversight; drafting site is debated.",
    "HEB": "Dispersed early Christian communities facing pressure, false teaching, and endurance challenges across the Roman world.",
    "REV": "Late first century CE. Visions received on Patmos and sent to churches in Asia Minor.",
}
GROUP_HISTORICAL_KO = {
    "GEN": "전통적으로 모세와 연결되지만 현재 형태는 긴 전승과 편집을 거쳤다. 메소포타미아·가나안·애굽·광야를 배경으로 언약의 기억을 전한다.",
    "JOS": "정복부터 귀환까지를 반성하는 역사 서사. 이스라엘 땅과 언약 장소, 포로와 귀환의 지리가 중심이다.",
    "JOB": "시와 지혜 모음집으로 여러 시기에 걸쳐 형성되었다. 이스라엘 예배와 지혜 전통이 삶의 자리이다.",
    "ISA": "앗수르부터 포로 이후 위기 속에서 선포된 예언. 이스라엘·유다·예루살렘·포로 땅·주변 민족이 시야에 있다.",
    "MAT": "1세기 복음서. 갈릴리·유대·예루살렘에서 이야기가 전개되며 최종 작성지는 재구성된다.",
    "ACT": "누가복음의 두 번째 권. 예루살렘에서 유대·사마리아·지중해 세계로 확장된다.",
    "ROM": "1세기 중반 동지중해 선교 현장의 편지. 도시·가정교회·여행 네트워크를 오간다.",
    "1TI": "목회 서신. 초기 기독교 선교 네트워크와 지역 교회의 돌봄·감독 현장.",
    "HEB": "로마 세계에 흩어진 공동체들이 압박·거짓 가르침·시련을 겪는 자리.",
    "REV": "1세기 후반. 밧모섬에서 받아 소아시아 교회들로 보내진 묵시.",
}

def genre_for(code: str):
    for codes, en, ko in GROUPS:
        if code in codes:
            return en, ko
    return "Biblical literature", "성경 문헌"

def historical_for(code: str, locale: str):
    table = GROUP_HISTORICAL_KO if locale == "ko" else GROUP_HISTORICAL_EN
    # find representative key per group
    for codes, _, _ in GROUPS:
        if code in codes:
            rep = codes[0]
            return table.get(rep, table["GEN"])
    return table["GEN"]

def genre_caution(genre: str, locale: str):
    low = genre.lower()
    if "poetry" in low or "wisdom" in low or "지혜" in genre or "시" in genre:
        return "시와 지혜는 명령문처럼 바로 적용하기보다 기도·탄식·묵상의 장르 안에서 읽어야 합니다." if locale=="ko" else "Poetry and wisdom should be read as prayer and reflection rather than as flat commands."
    if "prophetic" in low or "예언" in genre:
        return "예언서는 심판과 소망을 함께 말하므로 위로만 떼어내지 말고 언약적 부름 안에서 읽어야 합니다." if locale=="ko" else "Prophetic literature holds judgment and hope together; read comfort inside the covenant summons."
    if "gospel" in low or "복음" in genre:
        return "복음서는 예수님의 말과 행동을 이야기 흐름 안에서 보여 주므로 한 절만 떼지 말고 앞뒤를 함께 봐야 합니다." if locale=="ko" else "Gospels show Jesus' words and deeds in narrative flow; read verses with surrounding context."
    if "epistle" in low or "letter" in low or "서신" in genre:
        return "서신서는 실제 공동체를 향한 논증이므로 권면 앞뒤의 논리 흐름을 함께 봐야 합니다." if locale=="ko" else "Letters are pastoral arguments; read exhortations with their surrounding logic."
    if "apocalypse" in low or "묵시" in genre:
        return "묵시는 상징과 순환 서신 구조로 교회를 권면하므로 세부 묘사보다 예배와 인내의 초점을 놓치지 말아야 합니다." if locale=="ko" else "Apocalypse uses symbolic and circular-letter form to exhort endurance; keep worship and perseverance in focus."
    return "장르와 앞뒤 문맥을 지나서 적용해야 합니다." if locale=="ko" else "Apply through genre and surrounding context."

def build_sources(retrieved_at: str):
    return [
        {"id": "stepbible-data", "title": "STEPBible data", "url": "https://github.com/STEPBible/STEPBible-Data", "license": "CC BY", "retrievedAt": retrieved_at, "sourceTier": 1},
        {"id": "local-book-metadata", "title": "Local book metadata", "url": "local://lib/book-metadata", "license": "Internal", "retrievedAt": retrieved_at, "sourceTier": 1},
        {"id": "passage-index", "title": "Passage index", "url": "local://data/passage-index", "license": "Internal", "retrievedAt": retrieved_at, "sourceTier": 2},
        {"id": "world-english-bible", "title": "World English Bible", "url": "https://ebible.org/bible/details.php?id=eng-web&all=1", "license": "Public domain", "retrievedAt": retrieved_at, "sourceTier": 1},
    ]

def load_verse_counts():
    counts = defaultdict(lambda: defaultdict(int))
    if not WEB_VPL.exists():
        return counts
    with WEB_VPL.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            m = VPL_LINE_RE.match(line)
            if not m:
                continue
            code, ch, vs = m.group(1), int(m.group(2)), int(m.group(3))
            if vs > counts[code][ch]:
                counts[code][ch] = vs
    return counts

def build_overview(code, chapter, book_name, genre, total_chapters, locale):
    if locale == "ko":
        pos = "시작" if chapter <= 2 else "마무리" if chapter >= total_chapters -1 else "전개"
        if "토라" in genre:
            return f"{book_name} {chapter}장은 {genre} 안에서 언약 이야기를 이어간다. 창조와 족장, 출애굽과 율법의 흐름 속에서 이 장이 놓인 자리를 확인하며 읽는다."
        if "복음" in genre:
            return f"{book_name} {chapter}장은 예수님의 사역과 가르침, 죽음과 부활을 향한 이야기 흐름 안에 있다. 한 절을 떼지 말고 앞뒤 사건과 함께 읽는다."
        if "서신" in genre or "공동 서신" in genre:
            return f"{book_name} {chapter}장은 편지의 논증 흐름 안에 있다. 앞뒤 문단에서 문제를 제기하고 복음을 적용하는 순서를 따라 읽는다."
        if "시와 지혜" in genre:
            return f"{book_name} {chapter}장은 기도와 지혜의 언어로 쓰였다. 명제처럼 바로 적용하기보다 예배와 묵상의 자리에서 천천히 읽는다."
        if "예언" in genre:
            return f"{book_name} {chapter}장은 심판과 소망을 함께 선포한다. 언약 백성을 향한 부르심 안에서 위로와 경고를 함께 듣는다."
        if "묵시" in genre:
            return f"{book_name} {chapter}장은 환상과 편지 형식을 함께 사용한다. 상징 너머의 예배와 인내라는 주제를 놓치지 않고 읽는다."
        return f"{book_name} {chapter}장은 {genre}의 {pos} 부분에 자리한다. 앞 장과 뒤 장의 흐름을 함께 보며 이 장의 역할을 파악한다."
    else:
        if "Torah" in genre:
            return f"{book_name} {chapter} continues the covenant story within {genre}. Read it inside the flow from creation and ancestors through exodus and instruction."
        if "Gospel" in genre:
            return f"{book_name} {chapter} belongs to the narrative movement toward Jesus' death and resurrection. Read single verses inside the surrounding episode."
        if "letter" in genre.lower() or "epistle" in genre.lower():
            return f"{book_name} {chapter} sits inside a pastoral argument. Follow the logic that leads into and out of its exhortations."
        if "Poetry" in genre:
            return f"{book_name} {chapter} speaks in prayer and wisdom. Linger in its voice rather than flattening it into immediate rules."
        if "Prophetic" in genre:
            return f"{book_name} {chapter} holds judgment and hope together. Hear its warning and promise inside the covenant summons."
        if "Apocalypse" in genre:
            return f"{book_name} {chapter} uses vision and circular letter to call for endurance. Look past symbols to worship and perseverance."
        return f"{book_name} {chapter} stands in the {genre.lower()} movement. Read it with the chapters before and after to see its role."

def build_theological(code, chapter, genre, locale):
    if locale == "ko":
        if "토라" in genre:
            return "창조-타락-언약-출애굽으로 이어지는 정경 이야기의 기초를 놓는다. 하나님께서 백성을 부르고 거룩하게 구별하시는 주권에 주목한다."
        if "역사 서사" in genre:
            return "언약의 신실함과 불순종, 심판과 회복이 공적 역사에서 nasıl 드러나는지 보여 준다. 지도력과 공동체의 책임을 함께 묻는다."
        if "시와 지혜" in genre:
            return "기도·탄식·찬양·분별의 언어로 하나님 앞에서의 삶을 가르친다. 고난과 기쁨을 모두 하나님께 가져가는 법을 배운다."
        if "예언" in genre:
            return "죄를 드러내면서도 남은 자와 회복을 약속한다. 공의와 긍휼이 함께 서 있음을 붙들게 한다."
        if "복음" in genre:
            return "예수님 안에서 율법과 예언의 성취를 보여 준다. 믿음과 제자도, 증언으로의 부르심을 함께 전한다."
        if "서사 역사" in genre:
            return "부활하신 그리스도께서 성령을 통해 교회를 확장하심을 보여 준다. 증언과 고난과 선교가 함께 간다."
        if "서신" in genre:
            return "복음을 교리·예배·윤리·공동체 생활에 적용한다. 칭의와 성화, 사랑과 질서가 함께 다루어진다."
        if "묵시" in genre:
            return "하나님과 어린양의 통치를 예배로 고백하게 하고, 제국의 우상 앞에서 인내를 부른다."
        return "정경 전체 안에서 이 장이 맡은 신학적 역할을 확인하며 읽는다."
    else:
        if "Torah" in genre:
            return "Lays foundation for the canonical storyline of creation, fall, covenant, and exodus. Notice God's initiative in calling and hallowing a people."
        if "Historical" in genre:
            return "Shows how covenant faithfulness and unfaithfulness, judgment and restoration, unfold in public history."
        if "Poetry" in genre:
            return "Trains God's people in prayer, lament, praise, and discernment before God and neighbor."
        if "Prophetic" in genre:
            return "Exposes sin while promising preservation and restoration. Holds righteousness and mercy together."
        if "Gospel" in genre:
            return "Presents Jesus as fulfillment of law and prophets, calling for faith, discipleship, and witness."
        if "Narrative history" in genre:
            return "Shows the risen Christ continuing his work through the Spirit, witness, suffering, and mission."
        if "Pauline" in genre or "Pastoral" in genre or "General" in genre:
            return "Applies the gospel to doctrine, worship, ethics, and communal life with pastoral care."
        if "Apocalypse" in genre:
            return "Calls suffering churches to worship God and the Lamb and to resist idolatrous empire with endurance."
        return "Read its theological contribution inside the wider canonical storyline."

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--enrich-pd", action="store_true", help="placeholder for future PD enrichment")
    args = parser.parse_args()

    web_meta = json.loads(WEB_META.read_text(encoding="utf-8"))
    kor_meta = json.loads(KOR_META.read_text(encoding="utf-8"))
    web_books = {b["code"]: b for b in web_meta["books"]}
    kor_books_map = {b["code"]: b for b in kor_meta["books"]}

    verse_counts = load_verse_counts()
    generated_at = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00","Z")
    retrieved_at = generated_at
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for locale in ("ko","en"):
        books_meta = kor_meta if locale=="ko" else web_meta
        chapters = []
        for book in books_meta["books"]:
            code = book["code"]
            total = book["chapters"]
            testament = "구약" if book["testament"] in ("Old Testament","구약") else "신약" if locale=="ko" else ("Old Testament" if book["testament"] in ("Old Testament","구약") else "New Testament")
            if locale=="en":
                testament = "Old Testament" if web_books[code]["testament"]=="Old Testament" else "New Testament"
            genre_en, genre_ko = genre_for(code)
            genre = genre_ko if locale=="ko" else genre_en
            book_name = book["name"]
            historical = historical_for(code, locale)
            literary = genre_caution(genre, locale)
            theological = build_theological(code, 1, genre, locale)

            for ch in range(1, total+1):
                theo = build_theological(code, ch, genre, locale)
                overview = build_overview(code, ch, book_name, genre, total, locale)
                vc = verse_counts.get(code, {}).get(ch, 0)
                if vc == 0:
                    vc = 12
                mid = vc // 2 + 1 if vc > 1 else 1
                if locale=="ko":
                    key_verses = [
                        {"reference": f"{code} {ch}:1", "why": "장의 시작 — 전체 방향을 제시한다"},
                        {"reference": f"{code} {ch}:{mid}", "why": "장 중간 — 흐름의 전환이나 강조를 확인한다"},
                    ]
                    cautions = [literary]
                    if "시편" in book_name or "시" in genre:
                        cautions.append("한 절을 독립된 약속처럼 떼지 말고 시편 전체의 기도 흐름 안에서 읽는다")
                    if "예언" in genre:
                        cautions.append("한 구절로 예언을 단정하지 말고 앞뒤 신탁과 성취의 맥락을 함께 본다")
                else:
                    key_verses = [
                        {"reference": f"{code} {ch}:1", "why": "Opening — sets the chapter's direction"},
                        {"reference": f"{code} {ch}:{mid}", "why": "Middle — often carries the turn or emphasis"},
                    ]
                    cautions = [literary]
                    if code=="PSA":
                        cautions.append("Read the psalm as a whole prayer rather than isolating a single line")
                    if "Prophetic" in genre:
                        cautions.append("Avoid reading one oracle as a fixed timetable without surrounding oracles")

                # trim keyVerses to 1 if single-verse chapter like OBA
                if vc == 1:
                    key_verses = [key_verses[0]]

                item = {
                    "id": f"{code}-{ch}",
                    "code": code,
                    "chapter": ch,
                    "testament": testament,
                    "locale": locale,
                    "overview": overview,
                    "historical": historical,
                    "literary": f"{genre}. {literary}",
                    "theological": theo,
                    "keyVerses": key_verses,
                    "cautions": cautions,
                    "sources": build_sources(retrieved_at),
                    "version": VERSION,
                    "generatedAt": generated_at,
                }
                # keep crossRefDegree placeholder if present
                chapters.append(item)

        payload = {
            "version": VERSION,
            "generatedAt": generated_at,
            "locale": locale,
            "source": {
                "name": "Chapter background skeleton",
                "note": "Deterministic skeleton from local book metadata and genre templates. PD enrichment via --enrich-pd is a future step.",
                "license": "Internal",
                "retrievedAt": retrieved_at,
            },
            "stats": {
                "totalChapters": len(chapters),
                "books": len(books_meta["books"]),
            },
            "chapters": chapters,
        }
        out_path = OUT_DIR / f"{locale}.json"
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {out_path} with {len(chapters)} chapters")

    if args.enrich_pd:
        print("Note: --enrich-pd is reserved for Matthew Henry/JFB/TSK fetch in Phase 3.")

if __name__ == "__main__":
    main()
