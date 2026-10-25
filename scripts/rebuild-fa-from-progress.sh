#!/bin/bash
set -e
cd "$(dirname "$0")/.."
python3 - <<'PY'
import json, re
from pathlib import Path
base={}
for p in sorted(Path('data/i18n-chunks').glob('*.json')):
  base.update(json.loads(p.read_text()))
for p in sorted(Path('data/i18n-fa-out').glob('[0-9][0-9].json')):
  part=json.loads(p.read_text())
  for k,v in part.items():
    if re.search(r'[\u0600-\u06FF]', str(v)):
      base[k]=v
ov=json.loads(Path('data/fa-overrides.json').read_text())
by_val={}
for k,v in list(base.items()):
  by_val.setdefault(v, []).append(k)
for a,b in ov.items():
  if a in base: base[a]=b
  for k in by_val.get(a, []): base[k]=b
# Direct I18N key → FA (birth card, story, religions, …)
key_ov_path=Path('data/fa-key-overrides.json')
if key_ov_path.exists():
  for k,v in json.loads(key_ov_path.read_text()).items():
    base[k]=v
  print('applied', len(json.loads(key_ov_path.read_text())), 'key overrides')
Path('data/i18n_fa.json').write_text(json.dumps(base, ensure_ascii=False))
pers=sum(1 for v in base.values() if re.search(r'[\u0600-\u06FF]', str(v)))
print(f'persian {pers}/{len(base)} ({100*pers/len(base):.1f}%)')
PY
node scripts/build-fa-bundle.mjs
BUNDLE=$(cat data/fa-bundle-name.txt)
python3 - <<PY
from pathlib import Path
import re
bundle=Path('data/fa-bundle-name.txt').read_text().strip()
for p in Path('public/a').glob('fa.*.js'):
  if p.name!=bundle: p.unlink()
for p in Path('public/fa').rglob('*.html'):
  t=p.read_text(encoding='utf-8')
  p.write_text(re.sub(r'/a/fa\.[a-f0-9]+\.js', f'/a/{bundle}', t), encoding='utf-8')
print('bundle', bundle)
PY
