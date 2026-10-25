#!/usr/bin/env python3
"""Translate i18n-fa-batch-work part files to .done.json."""
from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AR = re.compile(r"[\u0600-\u06FF]")

spec = importlib.util.spec_from_file_location(
    "tr_batch", ROOT / "scripts" / "translate-i18n-fa-batch.py"
)
tr_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tr_mod)


def translate_items(items: list[dict]) -> list[dict]:
    out: list[dict] = []
    n = len(items)
    for i, it in enumerate(items):
        en = it["en"]
        if not tr_mod.needs_translation(en):
            fa = en
        else:
            fa = tr_mod.post_process(tr_mod.translate_one(en), en)
        out.append({"k": it["k"], "en": en, "fa": fa})
        if (i + 1) % 10 == 0 or i + 1 == n:
            print(f"  … {i + 1}/{n}", flush=True)
    return out


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: process-fa-batch-part.py <part.json>")
        sys.exit(2)
    src = Path(sys.argv[1])
    items = json.loads(src.read_text(encoding="utf-8"))
    print(f"translate {src.name} ({len(items)} items)", flush=True)
    done = translate_items(items)
    out_path = src.parent / (src.stem + ".done.json")
    out_path.write_text(json.dumps(done, ensure_ascii=False, indent=2), encoding="utf-8")
    pers = sum(1 for x in done if AR.search(x.get("fa", "")))
    print(f"wrote {out_path.name}: {len(done)} items, {pers} persian", flush=True)


if __name__ == "__main__":
    main()
