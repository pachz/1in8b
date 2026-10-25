#!/usr/bin/env python3
"""Translate i18n chunks 00-04 EN→FA. Small batches for Bing reliability."""
from __future__ import annotations

import importlib.util
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "batch", ROOT / "scripts" / "translate-i18n-fa-batch.py"
)
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)

MAX_BATCH_ITEMS = 8
MAX_BATCH_CHARS = 600


def translate_batch_smart(texts: list[str]) -> list[str]:
    if not texts:
        return []
    if len(texts) == 1:
        return [batch.translate_one(texts[0])]

    protected_list: list[str] = []
    all_slots: list[list[str]] = []
    for t in texts:
        p, slots = batch.protect(t)
        protected_list.append(p)
        all_slots.append(slots)

    joined = batch.SEP.join(protected_list)
    for attempt in range(3):
        try:
            out = batch.ts.translate_text(
                joined,
                translator="bing",
                from_language="en",
                to_language="fa",
            )
            parts = out.split(batch.SEP)
            if len(parts) != len(texts):
                raise ValueError(f"split mismatch {len(parts)} vs {len(texts)}")
            return [batch.restore(parts[i], all_slots[i]) for i in range(len(texts))]
        except Exception:
            time.sleep(1.0 * (attempt + 1))

    mid = len(texts) // 2
    return translate_batch_smart(texts[:mid]) + translate_batch_smart(texts[mid:])


def write_out(out_path: Path, data: dict) -> None:
    tmp = out_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False))
    tmp.replace(out_path)


def translate_chunk(path: Path) -> None:
    out_path = batch.OUT_DIR / path.name
    done: dict = {}
    if out_path.exists():
        done = json.loads(out_path.read_text())
    src = json.loads(path.read_text())
    for k, v in src.items():
        if k not in done:
            done[k] = v
    pending_keys = [
        k
        for k in src
        if done[k] == src[k] and batch.needs_translation(src[k])
    ]
    print(f"{path.name}: {len(done)} done, {len(pending_keys)} pending", flush=True)

    batch_keys: list[str] = []
    batch_vals: list[str] = []
    batch_chars = 0

    def flush_batch() -> None:
        nonlocal batch_keys, batch_vals, batch_chars
        if not batch_keys:
            return
        en_vals = batch_vals[:]
        fa_vals = translate_batch_smart(batch_vals)
        for k, en, fa in zip(batch_keys, en_vals, fa_vals):
            done[k] = batch.post_process(fa, en)
        write_out(out_path, done)
        print(f"  {path.name} +{len(batch_keys)} (total {len(done)})", flush=True)
        batch_keys = []
        batch_vals = []
        batch_chars = 0
        time.sleep(0.35)

    for k in pending_keys:
        v = src[k]
        if not batch.needs_translation(v):
            done[k] = v
            continue
        if len(v) > batch.MAX_SINGLE:
            flush_batch()
            fa = batch.translate_one(v)
            done[k] = batch.post_process(fa, v)
            write_out(out_path, done)
            time.sleep(0.25)
            continue
        add_len = len(v) + len(batch.SEP)
        if batch_keys and (
            len(batch_keys) >= MAX_BATCH_ITEMS
            or batch_chars + add_len > MAX_BATCH_CHARS
        ):
            flush_batch()
        batch_keys.append(k)
        batch_vals.append(v)
        batch_chars += add_len

    flush_batch()
    for k, v in src.items():
        if k not in done:
            done[k] = v
    write_out(out_path, done)
    print(f"{path.name}: complete {len(done)}", flush=True)


if __name__ == "__main__":
    for i in range(5):
        translate_chunk(batch.IN_DIR / f"{i:02d}.json")
