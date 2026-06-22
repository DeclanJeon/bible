from __future__ import annotations

from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path("/home/declan/Documents/Obsidian Vault/신학/관련링크.md")
TARGET = ROOT / "data" / "hanja" / "import" / "related-links.md"


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    if not source.exists():
        raise SystemExit(f"Missing Hanja source note: {source}")
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, TARGET)
    print(f"Synced {source} -> {TARGET}")


if __name__ == "__main__":
    main()
