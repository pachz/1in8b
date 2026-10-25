#!/usr/bin/env python3
"""Translate i18n chunks 05-09 EN→FA with smaller Bing batches + resume."""
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

BATCH_SIZE = 18
WORKERS = 4
FILES = [f"{n:02d}.json" for n in range(5, 10)]


def translate_keys(path: Path) -> tuple[str, int, int]:
    out_path = tr.OUT_DIR / path.name
    done: dict = {}
    if out_path.exists():
        done = json.loads(out_path.read_text(encoding="utf-8"))
    src = json.loads(path.read_text(encoding="utf-8"))
    pending = [k for k in src if k not in done]

    for k, v in src.items():
        if k in done:
            continue
        if not tr.needs_translation(v):
            done[k] = v

    pending = [k for k in src if k not in done]
    if not pending:
        out_path.write_text(json.dumps(done, ensure_ascii=False), encoding="utf-8")
        return path.name, len(done), 0

    def work_batch(batch_keys: list[str]) -> list[tuple[str, str]]:
        batch_vals = [src[k] for k in batch_keys]
        fa_vals = tr.translate_batch(batch_vals)
        return [
            (k, tr.post_process(fa, en))
            for k, en, fa in zip(batch_keys, batch_vals, fa_vals)
        ]

    batches = [
        pending[i : i + BATCH_SIZE] for i in range(0, len(pending), BATCH_SIZE)
    ]
    translated = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(work_batch, b): b for b in batches}
        for fut in as_completed(futures):
            for k, fa in fut.result():
                done[k] = fa
                translated += 1
            out_path.write_text(json.dumps(done, ensure_ascii=False), encoding="utf-8")

    for k, v in src.items():
        if k not in done:
            done[k] = v
    out_path.write_text(json.dumps(done, ensure_ascii=False), encoding="utf-8")
    return path.name, len(done), translated


def main() -> None:
    results = []
    for name in FILES:
        path = tr.IN_DIR / name
        if not path.exists():
            print(f"missing {name}", file=sys.stderr)
            continue
        label, total, new = translate_keys(path)
        results.append((label, total, new))
        print(f"{label}: {total} keys ({new} new this run)", flush=True)

    for label, total, _ in results:
        src_n = len(json.loads((tr.IN_DIR / label).read_text()))
        if total != src_n:
            print(f"WARNING {label}: {total} != source {src_n}", file=sys.stderr)


if __name__ == "__main__":
    main()
