#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "tr", ROOT / "scripts" / "translate-i18n-fa-batch.py"
)
tr = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(tr)

WORKERS = 6
TARGETS = [f"{n:02d}.json" for n in range(5, 10)]


def one_key(src: dict, k: str) -> tuple[str, str]:
    v = src[k]
    if not tr.needs_translation(v):
        return k, v
    fa = tr.translate_one(v)
    return k, tr.post_process(fa, v)


def finish_file(name: str) -> tuple[str, int]:
    path = tr.IN_DIR / name
    out_path = tr.OUT_DIR / name
    src = json.loads(path.read_text(encoding="utf-8"))
    done: dict = {}
    if out_path.exists():
        done = json.loads(out_path.read_text(encoding="utf-8"))
    pending = [k for k in src if k not in done]
    if not pending:
        return name, len(done)

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = [pool.submit(one_key, src, k) for k in pending]
        n = 0
        for fut in as_completed(futures):
            k, fa = fut.result()
            done[k] = fa
            n += 1
            if n % 50 == 0:
                out_path.write_text(json.dumps(done, ensure_ascii=False), encoding="utf-8")
                print(f"  {name} {len(done)}/{len(src)}", flush=True)

    for k, v in src.items():
        done.setdefault(k, v)
    out_path.write_text(json.dumps(done, ensure_ascii=False), encoding="utf-8")
    return name, len(done)


def main() -> None:
    for name in TARGETS:
        src_n = len(json.loads((tr.IN_DIR / name).read_text()))
        out_path = tr.OUT_DIR / name
        have = len(json.loads(out_path.read_text())) if out_path.exists() else 0
        if have >= src_n:
            print(f"{name}: already {have}", flush=True)
            continue
        print(f"{name}: resuming from {have}/{src_n}", flush=True)
        label, total = finish_file(name)
        print(f"{label}: complete {total}", flush=True)


if __name__ == "__main__":
    main()
