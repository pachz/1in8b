#!/usr/bin/env python3
"""Apply FA_MAP to batch parts and merge. FA_MAP populated in 02_fa_map_data.py"""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "data" / "i18n-fa-batch-work"
MERGE = ROOT / "scripts" / "merge-fa-batch.py"


def load_map():
    spec = importlib.util.spec_from_file_location("fa_map", WORK / "02_fa_map_data.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    return mod.FA_MAP


def merge_part(n: int, fa_map: dict[str, str]) -> None:
    items = json.loads((WORK / f"02-p{n:02d}.json").read_text(encoding="utf-8"))
    missing = [i["k"] for i in items if i["k"] not in fa_map]
    if missing:
        raise SystemExit(f"02-p{n:02d} missing {len(missing)} keys, e.g. {missing[0]}")
    out = [{"k": i["k"], "en": i["en"], "fa": fa_map[i["k"]]} for i in items]
    dst = WORK / f"02-p{n:02d}.done.json"
    dst.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    subprocess.run([sys.executable, str(MERGE), str(dst), "02"], check=True)
    print(f"merged part {n:02d}")


def main() -> None:
    fa_map = load_map()
    parts = [int(x) for x in sys.argv[1:]] if len(sys.argv) > 1 else list(range(2, 9))
    for n in parts:
        merge_part(n, fa_map)


if __name__ == "__main__":
    main()
