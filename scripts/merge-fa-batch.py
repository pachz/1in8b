#!/usr/bin/env python3
"""Merge a translated batch JSON into data/i18n-fa-out/<chunk>.json.

Input file format: [{"k": "...", "en": "...", "fa": "..."}, ...]
Usage: python3 scripts/merge-fa-batch.py data/i18n-fa-batch-work/02-p00.done.json
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "i18n-fa-out"
AR = re.compile(r"[\u0600-\u06FF]")


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: merge-fa-batch.py <batch.done.json> [chunk]")
        sys.exit(2)
    path = Path(sys.argv[1])
    items = json.loads(path.read_text(encoding="utf-8"))
    chunk = sys.argv[2] if len(sys.argv) > 2 else path.name.split("-")[0]
    out_path = OUT_DIR / f"{chunk}.json"
    src_path = ROOT / "data" / "i18n-chunks" / f"{chunk}.json"
    # Always start from full chunk keys so a bad partial write cannot shrink the file.
    done: dict = {}
    if src_path.exists():
        done.update(json.loads(src_path.read_text(encoding="utf-8")))
    if out_path.exists():
        done.update(json.loads(out_path.read_text(encoding="utf-8")))
    n = 0
    for it in items:
        k = it["k"]
        fa = it.get("fa") or it.get("tr")
        if not fa:
            raise SystemExit(f"missing fa for {k}")
        # keep placeholders present
        en = it.get("en", "")
        for ph in re.findall(r"\{\d+\}", en):
            if ph not in fa:
                print(f"WARN missing {ph} in {k}: {en[:60]!r}")
        done[k] = fa
        n += 1
    if src_path.exists():
        src_n = len(json.loads(src_path.read_text(encoding="utf-8")))
        if len(done) < src_n:
            raise SystemExit(
                f"refusing to write {out_path.name}: would shrink {src_n} → {len(done)}"
            )
    tmp = out_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(done, ensure_ascii=False), encoding="utf-8")
    tmp.replace(out_path)
    pers = sum(1 for v in done.values() if AR.search(str(v)))
    print(f"merged {n} into {out_path.name} ({pers} persian values)")


if __name__ == "__main__":
    main()
