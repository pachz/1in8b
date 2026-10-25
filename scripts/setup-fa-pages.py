#!/usr/bin/env python3
"""Create /fa/ pages from English + RTL, wire Vazirmatn, update all lang switchers."""
from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
BUNDLE = (ROOT / "data" / "fa-bundle-name.txt").read_text().strip() if (
    ROOT / "data" / "fa-bundle-name.txt"
).exists() else "fa.pending.js"

FA_LINK = (
    '<a href="/fa/" lang="fa" hreflang="fa" data-lang="fa">فارسی</a>'
)
FA_FOOTER = (
    '<a href="/fa/" hreflang="fa" lang="fa">۱ در ۸ میلیارد (فارسی)</a>'
)

# Static HTML strings (EN → FA) for first paint
HTML_REPLACEMENTS = [
    ("1 in 8 Billion (1in8b, Official) · Life Simulation Game · Who will you be born as?",
     "۱ در ۸ میلیارد (1in8b، رسمی) · بازی شبیه‌سازی زندگی · به‌عنوان چه کسی متولد می‌شوید؟"),
    ("The official 1 in 8 Billion life simulation",
     "شبیه‌سازی رسمی زندگی ۱ در ۸ میلیارد"),
    ("Free life simulation ·", "شبیه‌سازی رایگان زندگی ·"),
    ("Real statistics from 172 countries ·", "آمار واقعی از ۱۷۲ کشور ·"),
    ("Ages 15+", "۱۵ سال به بالا"),
    ("in 8 Billion", "در ۸ میلیارد"),
    ("Babies born since you opened this page", "نوزادان متولدشده از وقتی این صفحه را باز کردید"),
    ("People who passed away in that time", "کسانی که در همین مدت درگذشتند"),
    ("Lives kept in the memorial", "زندگی‌های نگه‌داشته‌شده در یادبود"),
    ("See all", "همه را ببین"),
    ("If you were a baby born right now", "اگر همین حالا نوزاد متولد می‌شدید"),
    ("See the statistics for all 172 countries", "آمار هر ۱۷۲ کشور را ببینید"),
    ("Shared lives", "زندگی‌های به‌اشتراک‌گذاشته"),
    ("People share the lives they lived here and what they felt. No names, no contact details. Only the lives remain.",
     "مردم زندگی‌هایی را که اینجا زیسته‌اند و آنچه حس کرده‌اند به اشتراک می‌گذارند. بدون نام، بدون راه تماس. فقط خود زندگی‌ها می‌مانند."),
    ("The world you are born into", "دنیایی که در آن متولد می‌شوید"),
    ("The past", "گذشته"),
    ("Today", "امروز"),
    ("The future", "آینده"),
    ("Any world", "هر دوره"),
    ("Year of birth", "سال تولد"),
    ("Live a whole life in today's world. Today's statistics hold to the end.",
     "یک زندگی کامل را در دنیای امروز زندگی کنید. آمار امروز تا پایان برقرار می‌ماند."),
    ("How your country is drawn", "چگونه کشورتان انتخاب می‌شود"),
    ("Choosing your birthplace", "انتخاب زادگاه شما"),
    ("Babies born now", "نوزادانِ همین حالا"),
    ("The 8 billion alive now", "۸ میلیاردِ زندۀ امروز"),
    ("Length of one life", "طول یک زندگی"),
    ("About 30 min", "حدود ۳۰ دقیقه"),
    ("About 1 hour", "حدود ۱ ساعت"),
    ("About 1.5 hours", "حدود ۱٫۵ ساعت"),
    ("Where you were actually born (optional)", "کجایی واقعاً متولد شده‌اید (اختیاری)"),
    ("You can leave the settings as they are and be born right away.",
     "می‌توانید تنظیمات را همین‌طور بگذارید و فوراً متولد شوید."),
    ("Calm music", "موسیقی آرام"),
    ("Continue", "ادامه"),
    ("Be born", "متولد شو"),
    ("Leave out frightening scenes", "صحنه‌های ترسناک را حذف کن"),
    ("Memorials", "یادبودها"),
    ("Lives that someone lived to the end and wanted to keep. Anyone can stop by, light a candle and leave a word.",
     "زندگی‌هایی که کسی تا پایان زیست و خواست نگه دارد. هرکسی می‌تواند سر بزند، شمعی روشن کند و کلمه‌ای بگذارد."),
    ("Visit the memorials", "بازدید از یادبودها"),
    ("Meet a life at random", "دیدن یک زندگی به‌صورت تصادفی"),
    ("Past lives", "زندگی‌های پیشین"),
    ("Your lives are kept in this browser only.", "زندگی‌های شما فقط در همین مرورگر نگه داشته می‌شوند."),
    ("Send feedback", "ارسال بازخورد"),
    ("Update notes", "یادداشت‌های به‌روزرسانی"),
    ("Move my lives", "انتقال زندگی‌های من"),
    ("Open my pass", "باز کردن گذر من"),
    ("Add to Home Screen", "افزودن به صفحهٔ اصلی"),
    ("About 1 in 8 Billion", "دربارهٔ ۱ در ۸ میلیارد"),
    ("Privacy policy", "سیاست حفظ حریم خصوصی"),
    ("Terms and refunds", "شرایط و بازپرداخت"),
    ("Developer API", "API توسعه‌دهندگان"),
    ("Open in classroom mode", "باز کردن در حالت کلاس"),
    ("Language", "زبان"),
    ("Right now, about four babies are born every second. You become one of them and live that one life all the way to its end. Where you are born, and to whom, you don’t get to choose. Just as you didn’t.",
     "همین حالا، حدود چهار نوزاد در هر ثانیه متولد می‌شوند. شما یکی از آن‌ها می‌شوید و همان یک زندگی را تا پایانش می‌زیید. کجا و در چه خانواده‌ای به دنیا بیایید، انتخاب شما نیست. همان‌طور که نبود."),
]


FA_FONT_CSS = """
html[lang="fa"] {
  --f-display: "Vazirmatn", "IBM Plex Sans Arabic", Tahoma, serif;
  --f-body: "Vazirmatn", "IBM Plex Sans Arabic", system-ui, Tahoma, sans-serif;
  --f-mono: "IBM Plex Mono", "Vazirmatn", ui-monospace, Menlo, monospace;
}
html[lang="fa"] body { line-height: 1.85; }
html[lang="fa"] body * { word-break: normal !important; letter-spacing: 0 !important; font-style: normal !important; }
html[lang="fa"] .hero h1 { font-size: clamp(48px, 8vw, 120px); line-height: 1.2; font-weight: 700; }
html[lang="fa"] .stat { grid-template-columns: 7em minmax(0, 1fr) 2.4em; }
html[lang="fa"] .orow { grid-template-columns: 10em 1fr 3.6em; }
html[lang="fa"] .feed .f::before { content: "داده "; }
html[lang="fa"] .speed .ffsh { display: none; }
"""


def inject_fa_nav(html: str, current_fa: bool = False) -> str:
    """Insert Farsi link into language switcher if missing."""
    if 'data-lang="fa"' in html and 'hreflang="fa"' in html:
        # still refresh current markers
        pass
    else:
        # After English link in nav
        html = re.sub(
            r'(<a href="/en/"[^>]*>English</a>)',
            r"\1" + FA_LINK,
            html,
            count=1,
        )
        # Footer language list (localized brand names)
        if FA_FOOTER not in html:
            html = re.sub(
                r'(<a href="/ko/"[^>]*>80억 분의 1 \(한국어\)</a>)',
                FA_FOOTER + r"\1",
                html,
                count=1,
            )
            # EN footer variant
            html = re.sub(
                r'(80억 분의 1 \(한국어\))',
                lambda m: m.group(0) if FA_FOOTER in html else m.group(0),
                html,
                count=1,
            )

    # Fix aria-current
    html = re.sub(r' data-lang="fa" aria-current="page"', ' data-lang="fa"', html)
    html = re.sub(r'(data-lang="en") aria-current="page"', r"\1", html)
    if current_fa:
        html = html.replace(
            'data-lang="fa">فارسی</a>',
            'data-lang="fa" aria-current="page">فارسی</a>',
        )
        # remove other aria-current=page on lang links
        def strip_other(m):
            if 'data-lang="fa"' in m.group(0):
                return m.group(0)
            return m.group(0).replace(' aria-current="page"', "")

        html = re.sub(
            r'<a href="/[^"]+"[^>]*data-lang="[^"]+"[^>]*>',
            strip_other,
            html,
        )
        # ensure fa has it
        html = re.sub(
            r'(<a href="/fa/"[^>]*data-lang="fa")(?![^>]*aria-current)',
            r'\1 aria-current="page"',
            html,
        )
    return html


def transform_to_fa(html: str) -> str:
    html = re.sub(r"<html\b[^>]*>", '<html lang="fa" dir="rtl">', html, count=1)
    html = re.sub(
        r'<script src="/a/en\.[^"]+\.js"></script>',
        f'<script src="/a/{BUNDLE}"></script>',
        html,
    )
    # fonts.css + vazirmatn
    if "vazirmatn.css" not in html:
        html = html.replace(
            '<link href="/fonts/fonts.css" rel="stylesheet">',
            '<link href="/fonts/fonts.css" rel="stylesheet">\n'
            '<link href="/fonts/vazirmatn.css" rel="stylesheet">',
        )
    # inject fa font CSS before </style> of main block (last </style> before body)
    if 'html[lang="fa"]' not in html:
        # insert before the final </style> in head
        idx = html.rfind("</style>", 0, html.find("<body"))
        if idx > 0:
            html = html[:idx] + FA_FONT_CSS + html[idx:]

    for en, fa in HTML_REPLACEMENTS:
        html = html.replace(en, fa)

    # Hero brand: keep italic 1 accent — markup uses <i>1</i> in 8 Billion pattern
    html = html.replace(">in 8 Billion<", ">در ۸ میلیارد<")
    html = re.sub(
        r"(<h1[^>]*>[\s\S]*?<i[^>]*>)1(</i>)",
        r"\g<1>۱\2",
        html,
        count=1,
    )

    html = inject_fa_nav(html, current_fa=True)

    # Canonical / hreflang
    html = re.sub(
        r'href="https://1in8b\.(?:life|ir)/en/"',
        'href="https://1in8b.ir/fa/"',
        html,
    )
    html = html.replace('hreflang="en" href="/en/"', 'hreflang="fa" href="/fa/"')
    html = html.replace("/en/manifest.webmanifest", "/fa/manifest.webmanifest")
    html = html.replace('lang="en"', 'lang="fa"')  # careful — may hit too much
    # undo over-replace inside other language links
    html = html.replace('lang="fa" hreflang="en"', 'lang="en" hreflang="en"')
    html = re.sub(
        r'<a href="/en/" lang="fa"',
        '<a href="/en/" lang="en"',
        html,
    )
    return html


def copy_tree():
    src = PUBLIC / "en"
    dst = PUBLIC / "fa"
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)

    for path in dst.rglob("*"):
        if path.is_file() and path.suffix in {".html", ".webmanifest", ".json"}:
            text = path.read_text(encoding="utf-8", errors="replace")
            if path.suffix == ".html":
                text = transform_to_fa(text)
            elif path.name == "manifest.webmanifest":
                text = text.replace("1 in 8 Billion", "۱ در ۸ میلیارد")
                text = text.replace("/en/", "/fa/")
            elif path.name == "notes.json":
                # leave English notes until translated; prefix marker
                pass
            path.write_text(text, encoding="utf-8")
    print("Created /fa with bundle", BUNDLE)


def update_all_lang_switchers():
    for path in PUBLIC.rglob("*.html"):
        if "/fa/" in str(path) or path.name == "index.html" and path.parent == PUBLIC:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if "langsw" not in text and "data-lang=" not in text:
            continue
        new = inject_fa_nav(text, current_fa=False)
        # Ensure FA_LINK present
        if 'data-lang="fa"' not in new:
            new = re.sub(
                r'(<a href="/en/"[^>]*>English</a>)',
                r"\1" + FA_LINK,
                new,
                count=1,
            )
        if new != text:
            path.write_text(new, encoding="utf-8")
            print("updated nav", path.relative_to(PUBLIC))


def main():
    copy_tree()
    update_all_lang_switchers()
    # default redirect
    (PUBLIC / "index.html").write_text(
        """<!doctype html>
<html lang="fa" dir="rtl">
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=/fa/">
<link rel="canonical" href="/fa/">
<title>۱ در ۸ میلیارد</title>
<script>location.replace("/fa/")</script>
</html>
""",
        encoding="utf-8",
    )
    print("Default → /fa/")


if __name__ == "__main__":
    main()
