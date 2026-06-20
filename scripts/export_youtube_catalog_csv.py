from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data" / "external" / "youtube" / "videos.json"
DEFAULT_OUTPUT = ROOT / "data" / "external" / "youtube" / "videos.csv"
FIELDS = [
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export the local YouTube catalog JSON to CSV.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Path to videos.json.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="CSV output path.")
    return parser.parse_args()


def load_videos(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if isinstance(payload, list):
        return payload
    videos = payload.get("videos", [])
    if not isinstance(videos, list):
        raise ValueError("videos.json must contain a top-level videos array")
    return videos


def write_csv(videos: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = sorted(videos, key=lambda item: (item.get("channelTitle", ""), item.get("publishedAt") or "", item.get("videoId", "")))
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for video in ordered:
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


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)
    videos = load_videos(input_path)
    write_csv(videos, output_path)
    print(json.dumps({"videos": len(videos), "input": str(input_path), "output": str(output_path)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
