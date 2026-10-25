#!/usr/bin/env python3
"""Download EN /c/:slug pages and build localized /fa/c/:slug pages with Vazirmatn."""
from __future__ import annotations

import concurrent.futures
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
EN_C = PUBLIC / "en" / "c"
FA_C = PUBLIC / "fa" / "c"
COUNTRY_FA = json.loads((ROOT / "data" / "country-fa.json").read_text(encoding="utf-8"))

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html",
}

FA_FONT = """
<link href="/fonts/vazirmatn.css" rel="stylesheet">
"""

FA_CSS = """
html[lang="fa"] body{font-family:"Vazirmatn","IBM Plex Sans Arabic",Tahoma,system-ui,sans-serif!important;word-break:normal!important;overflow-wrap:break-word;line-height:1.85;letter-spacing:0!important}
html[lang="fa"] h1,html[lang="fa"] h2,html[lang="fa"] .st b,html[lang="fa"] .brand,html[lang="fa"] .go,html[lang="fa"] .btn,html[lang="fa"] .lead,html[lang="fa"] .kicker,html[lang="fa"] .cta,html[lang="fa"] footer,html[lang="fa"] p,html[lang="fa"] a,html[lang="fa"] span,html[lang="fa"] small,html[lang="fa"] li,html[lang="fa"] b{font-family:"Vazirmatn","IBM Plex Sans Arabic",Tahoma,system-ui,sans-serif!important;letter-spacing:0!important}
html[lang="fa"] h1,html[lang="fa"] h2,html[lang="fa"] .st b,html[lang="fa"] .brand{font-weight:700;line-height:1.45}
html[lang="fa"] .cta{border-left:1px solid var(--rule);border-right:3px solid var(--accent)}
html[lang="fa"] body *{font-style:normal!important}
"""

# UI chrome / repeated labels (EN → FA)
LABELS = [
    ("Be born", "متولد شو"),
    ("About", "درباره"),
    ("All 172 countries", "همهٔ ۱۷۲ کشور"),
    ("See all 172 countries", "مشاهدهٔ همهٔ ۱۷۲ کشور"),
    ("Privacy policy", "سیاست حفظ حریم خصوصی"),
    ("Life expectancy", "امید به زندگی"),
    ("Chance of dying before age 5", "احتمال مرگ پیش از ۵‌سالگی"),
    ("Chance of dying before age 1", "احتمال مرگ پیش از ۱‌سالگی"),
    ("Mothers who die giving birth", "مادرانی که هنگام زایمان می‌میرند"),
    ("maternal mortality ratio", "نسبت مرگ مادران"),
    ("Children per woman", "فرزند به‌ازای هر زن"),
    ("total fertility rate", "نرخ باروری کل"),
    ("Expected years of schooling", "سال‌های مورد انتظار تحصیل"),
    ("College and university enrollment", "ثبت‌نام در دانشگاه"),
    ("gross enrollment ratio", "نسبت ناخالص ثبت‌نام"),
    ("Income per person (PPP)", "درآمد سرانه (PPP)"),
    ("GDP per capita, PPP", "تولید ناخالص داخلی سرانه، PPP"),
    ("Income inequality", "نابرابری درآمد"),
    ("Gini index (closer to 0 = more equal)", "شاخص جینی (نزدیک‌تر به ۰ = برابرتر)"),
    ("People living in cities", "شهرنشینان"),
    ("urbanization", "شهرنشینی"),
    ("People working in farming", "شاغلان کشاورزی"),
    ("share of jobs in agriculture", "سهم مشاغل کشاورزی"),
    ("People using the internet", "کاربران اینترنت"),
    ("Women married before 18", "زنان ازدواج‌کرده پیش از ۱۸"),
    ("of women aged 20–24", "از زنان ۲۰ تا ۲۴ ساله"),
    ("Health costs paid out of pocket", "هزینهٔ سلامت از جیب"),
    ("share of health spending", "سهم هزینه‌های سلامت"),
    ("adults living with HIV", "بزرگسالان مبتلا به اچ‌آی‌وی"),
    ("Homicide", "قتل"),
    ("Road traffic deaths", "مرگ‌های جاده‌ای"),
    ("People who smoke", "افراد سیگاری"),
    ("Life satisfaction", "رضایت از زندگی"),
    ("World Happiness Report", "گزارش شادی جهانی"),
    ("Religion", "دین"),
    ("Major cities", "شهرهای بزرگ"),
    ("Common disasters", "بلایای رایج"),
    ("Where people move to", "مقصد مهاجرت"),
    ("Other countries", "کشورهای دیگر"),
    ("years for women and", "سال برای زنان و"),
    ("years for men", "سال برای مردان"),
    ("women ", "زنان "),
    ("men ", "مردان "),
    (" per 100,000 births", " در ۱۰۰٬۰۰۰ تولد"),
    (" per 100,000", " در ۱۰۰٬۰۰۰"),
    (" in 1,000", " در ۱٬۰۰۰"),
    (" years", " سال"),
    ("population about ", "جمعیت حدود "),
    ("billion", "میلیارد"),
    ("million", "میلیون"),
]

REGIONS = {
    "South Asia": "جنوب آسیا",
    "East Asia": "شرق آسیا",
    "Southeast Asia": "جنوب‌شرق آسیا",
    "Central Asia": "آسیای مرکزی",
    "Western Asia": "غرب آسیا",
    "Middle East": "خاورمیانه",
    "North Africa": "شمال آفریقا",
    "West Africa": "غرب آفریقا",
    "East Africa": "شرق آفریقا",
    "Central Africa": "آفریقای مرکزی",
    "Southern Africa": "جنوب آفریقا",
    "Sub-Saharan Africa": "آفریقای جنوب صحرا",
    "Northern Europe": "شمال اروپا",
    "Western Europe": "غرب اروپا",
    "Southern Europe": "جنوب اروپا",
    "Eastern Europe": "شرق اروپا",
    "Northern America": "آمریکای شمالی",
    "North America": "آمریکای شمالی",
    "Central America": "آمریکای مرکزی",
    "South America": "آمریکای جنوبی",
    "Caribbean": "کارائیب",
    "Oceania": "اقیانوسیه",
    "Australia and New Zealand": "استرالیا و نیوزیلند",
    "Melanesia": "ملانزی",
    "Micronesia": "میکرونزی",
    "Polynesia": "پلی‌نزی",
}

RELIGIONS = {
    "Hinduism": "هندوییسم",
    "Islam": "اسلام",
    "Christianity": "مسیحیت",
    "Sikhism": "آیین سیک",
    "Buddhism": "بودیسم",
    "Judaism": "یهودیت",
    "Another religion": "دین دیگر",
    "Other religion": "دین دیگر",
    "Folk religion": "دین قومی / سنتی",
    "Traditional religion": "دین سنتی",
    "No religion": "بدون دین",
    "Unaffiliated": "بدون دین",
    "Orthodox Christianity": "مسیحیت ارتدکس",
    "Catholicism": "کاتولیک",
    "Protestantism": "پروتستان",
    "Shinto": "شینتو",
    "Taoism": "تائوییسم",
    "Confucianism": "کنفوسیوسیسم",
    "Baháʼí": "بهائی",
    "Baha'i": "بهائی",
}

DISASTERS = {
    "Floods": "سیل",
    "Heat waves": "موج گرما",
    "Typhoons and storms": "تایفون و طوفان",
    "Earthquakes": "زلزله",
    "Droughts": "خشکسالی",
    "Wildfires": "آتش‌سوزی جنگل",
    "Volcanic eruptions": "فوران آتشفشان",
    "Landslides": "رانش زمین",
    "Cyclones": "گردباد",
    "Hurricanes": "توفند",
    "Tornadoes": "گردباد پیچشی",
    "Tsunamis": "سونامی",
    "Cold waves": "موج سرما",
    "Storms": "طوفان",
    "Epidemics": "همه‌گیری",
    "Conflict": "درگیری",
}

ORDINAL = {
    "1st": "۱م",
    "2nd": "۲م",
    "3rd": "۳م",
}

SOURCES_FA = (
    "منابع: چشم‌انداز جمعیت جهان ۲۰۲۴ سازمان ملل (تولدها، جمعیت، امید به زندگی، باروری)، "
    "UN IGME (مرگ کودکان)، WHO و UN MMEIG (مرگ مادران، دخانیات، مرگ جاده‌ای)، UNDP و یونسکو (آموزش)، "
    "بانک جهانی (درآمد، نابرابری، اینترنت، هزینهٔ سلامت)، ILO (اشتغال در کشاورزی)، UN-Habitat (شهرنشینی)، "
    "UNAIDS (اچ‌آی‌وی)، UNODC (قتل)، یونیسف (ازدواج کودکان)، گزارش شادی جهانی ۲۰۲۴. "
    "چند مقدار بدون دادهٔ تازه، برآوردهایی بر پایهٔ میانگین‌های منطقه‌ای‌اند."
)

CTA_FA = (
    "پشت هر یک از این اعداد زندگی یک انسان است. در «۱ در ۸ میلیارد» یکی از نوزادانی می‌شوید "
    "که همین حالا به‌دنیا می‌آیند و یک زندگی کامل را درون آمارهایی از این دست می‌زیید، از روز اول تا روز آخر. "
    "نمی‌توانید انتخاب کنید کجا متولد شوید. هیچ‌کس هرگز نتوانست."
)

DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


def fa_digits(s: str) -> str:
    return s.translate(DIGITS)


def slugs_from_index() -> list[str]:
    html = (EN_C / "index.html").read_text(encoding="utf-8")
    return re.findall(r'href="/en/c/([a-z]{2,3})"', html)


def en_names_from_index() -> dict[str, str]:
    html = (EN_C / "index.html").read_text(encoding="utf-8")
    return dict(re.findall(r'href="/en/c/([a-z]{2,3})">([^<]+)', html))


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def download_en(slug: str) -> Path:
    dest = EN_C / slug / "index.html"
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    data = fetch(f"https://1in8b.life/en/c/{slug}")
    # drop cloudflare beacon
    text = data.decode("utf-8", "replace")
    text = re.sub(r'<script type="module" src="https://static\.cloudflareinsights\.com/[^<]+</script>\s*', "", text)
    text = text.replace("https://1in8b.life/", "https://1in8b.ir/")
    dest.write_text(text, encoding="utf-8")
    return dest


def nth_fa(m: re.Match) -> str:
    n, suf = m.group(1), m.group(2)
    return f"{fa_digits(n)}{'م' if suf else ''}"


def transform_to_fa(html: str, slug: str, en_name: str, fa_name: str) -> str:
    html = re.sub(r"<html\b[^>]*>", '<html lang="fa" dir="rtl">', html, count=1)

    # domain / paths
    html = html.replace("https://1in8b.life/", "https://1in8b.ir/")
    html = html.replace("/en/", "/fa/")
    # restore cross-lang switcher targets that were wrongly rewritten
    for lang in ["en", "ko", "ja", "zh", "vi", "fr", "th", "es", "de", "pt", "ru", "tr", "id", "it", "ar"]:
        html = html.replace(f'href="/fa/c/{slug}" hreflang="{lang}"', f'href="/{lang}/c/{slug}" hreflang="{lang}"')
        # footer variants
        html = html.replace(f'href="/fa/c/{slug}" hreflang="{lang}" lang="{lang}"', f'href="/{lang}/c/{slug}" hreflang="{lang}" lang="{lang}"')

    # language switcher block
    langs = (
        f'<span class="langs">'
        f'<a href="/en/c/{slug}" hreflang="en" lang="en">English</a>'
        f'<a href="/fa/c/{slug}" hreflang="fa" lang="fa" aria-current="page">فارسی</a>'
        f'<a href="/ko/c/{slug}" hreflang="ko" lang="ko">한국어</a>'
        f'<a href="/ja/c/{slug}" hreflang="ja" lang="ja">日本語</a>'
        f'<a href="/zh/c/{slug}" hreflang="zh-Hant" lang="zh-Hant">繁體中文</a>'
        f'<a href="/vi/c/{slug}" hreflang="vi" lang="vi">Tiếng Việt</a>'
        f'<a href="/fr/c/{slug}" hreflang="fr" lang="fr">Français</a>'
        f'<a href="/th/c/{slug}" hreflang="th" lang="th">ไทย</a>'
        f'<a href="/es/c/{slug}" hreflang="es" lang="es">Español</a>'
        f'<a href="/de/c/{slug}" hreflang="de" lang="de">Deutsch</a>'
        f'<a href="/pt/c/{slug}" hreflang="pt" lang="pt">Português</a>'
        f'<a href="/ru/c/{slug}" hreflang="ru" lang="ru">Русский</a>'
        f'<a href="/tr/c/{slug}" hreflang="tr" lang="tr">Türkçe</a>'
        f'<a href="/id/c/{slug}" hreflang="id" lang="id">Bahasa Indonesia</a>'
        f'<a href="/it/c/{slug}" hreflang="it" lang="it">Italiano</a>'
        f'<a href="/ar/c/{slug}" hreflang="ar" lang="ar">العربية</a>'
        f"</span>"
    )
    html = re.sub(r'<span class="langs">.*?</span>', langs, html, count=1, flags=re.S)

    # brand
    html = html.replace("<em>1</em> in 8 Billion", "<em>۱</em> در ۸ میلیارد")
    html = html.replace(">1 in 8 Billion<", ">۱ در ۸ میلیارد<")
    html = html.replace("1 in 8 Billion", "۱ در ۸ میلیارد")

    # fonts
    if "vazirmatn.css" not in html:
        html = html.replace(
            '<link href="/fonts/fonts.css" rel="stylesheet">',
            '<link href="/fonts/fonts.css" rel="stylesheet">\n' + FA_FONT.strip(),
        )
    if 'html[lang="fa"] body{' not in html:
        html = html.replace("</style>", FA_CSS + "</style>", 1)

    # hreflang fa
    if 'hreflang="fa"' not in html:
        html = html.replace(
            f'<link rel="alternate" hreflang="en" href="https://1in8b.ir/en/c/{slug}">',
            f'<link rel="alternate" hreflang="en" href="https://1in8b.ir/en/c/{slug}">\n'
            f'<link rel="alternate" hreflang="fa" href="https://1in8b.ir/fa/c/{slug}">',
        )
    html = html.replace('content="en_US"', 'content="fa_IR"')

    # Lead templates BEFORE any partial country-name swaps (those would break the regex)
    def lead1(m: re.Match) -> str:
        pct, odds, n_year, unit_year, n_min = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
        unit = {"million": "میلیون", "billion": "میلیارد"}.get(unit_year, unit_year)
        return (
            f"همین حالا حدود {pct}٪ از نوزادان زمین در {fa_name} متولد می‌شوند: "
            f"۱ در {fa_digits(odds)}، حدود {n_year} {unit} در سال، یا حدود {n_min} در دقیقه."
        )

    html = re.sub(
        r"Right now, about ([0-9.]+)% of the babies born on Earth are born in [^:]+: "
        r"1 in ([0-9,]+), about ([0-9.]+) (million|billion) a year, or about ([0-9.]+) a minute\.",
        lead1,
        html,
        count=1,
    )

    # Small countries: "about 4,213 a year, or one every 7,491 minutes."
    def lead_minutes(m: re.Match) -> str:
        pct, odds, n_year, n_min = m.group(1), m.group(2), m.group(3), m.group(4)
        return (
            f"همین حالا حدود {pct}٪ از نوزادان زمین در {fa_name} متولد می‌شوند: "
            f"۱ در {fa_digits(odds)}، حدود {fa_digits(n_year)} در سال، "
            f"یا یکی در هر {fa_digits(n_min)} دقیقه."
        )

    html = re.sub(
        r"Right now, about ([0-9.]+)% of the babies born on Earth are born in [^:]+: "
        r"1 in ([0-9,]+), about ([0-9,]+) a year, or one every ([0-9,]+) minutes?\.",
        lead_minutes,
        html,
        count=1,
    )
    # Fallback for other phrasings
    html = re.sub(
        r"Right now, about ([0-9.]+)% of the babies born on Earth are born in [^:]+: 1 in ([0-9,]+), about ([^.]+)\.",
        lambda m: (
            f"همین حالا حدود {m.group(1)}٪ از نوزادان زمین در {fa_name} متولد می‌شوند: "
            f"۱ در {fa_digits(m.group(2))}، حدود {m.group(3)}."
            .replace(" million a year", " میلیون در سال")
            .replace(" billion a year", " میلیارد در سال")
            .replace(" a minute", " در دقیقه")
            .replace(" a year, or one every ", " در سال، یا یکی در هر ")
            .replace(" minutes", " دقیقه")
            .replace(" minute", " دقیقه")
        ),
        html,
        count=1,
    )
    # Leftover EN fragments already partially localized
    html = re.sub(
        r"حدود ([0-9,.]+) a year, or one every ([0-9,]+) minutes?\.",
        lambda m: f"حدود {fa_digits(m.group(1))} در سال، یا یکی در هر {fa_digits(m.group(2))} دقیقه.",
        html,
    )

    html = re.sub(
        r"The chance that a baby born in .+? dies before turning five is ([0-9.]+)%, about ([0-9.]+) times that of ([^(]+)\(([0-9.]+)%\)\. Life expectancy is ([0-9.]+) years for women and ([0-9.]+) years for men\.",
        lambda m: (
            f"احتمال اینکه نوزاد متولد {fa_name} پیش از پنج‌سالگی بمیرد {m.group(1)}٪ است؛ "
            f"حدود {m.group(2)} برابر {country_swap(m.group(3).strip())} ({m.group(4)}٪). "
            f"امید به زندگی برای زنان {m.group(5)} سال و برای مردان {m.group(6)} سال است."
        ),
        html,
        count=1,
    )
    html = re.sub(
        r"The chance that a baby born in .+? dies before turning five is ([0-9.]+)%[^.]*\. Life expectancy is ([0-9.]+) years for women and ([0-9.]+) years for men\.",
        lambda m: (
            f"احتمال اینکه نوزاد متولد {fa_name} پیش از پنج‌سالگی بمیرد {m.group(1)}٪ است. "
            f"امید به زندگی برای زنان {m.group(2)} سال و برای مردان {m.group(3)} سال است."
        ),
        html,
        count=1,
    )

    # Titles / remaining country phrases (EN often uses "the United States", "the Maldives", …)
    html = html.replace(f"If you were born in the {en_name}", f"اگر در {fa_name} متولد می‌شدید")
    html = html.replace(f"If you were born in {en_name}", f"اگر در {fa_name} متولد می‌شدید")
    html = html.replace(f"Life in {en_name}, in numbers", f"زندگی در {fa_name}، در قالب عدد")
    html = html.replace(f"born in {en_name}", f"متولد {fa_name}")
    html = html.replace(f"a baby born in {en_name}", f"نوزادی متولد {fa_name}")
    html = html.replace(
        f"of the babies born on Earth are born in {en_name}",
        f"از نوزادان زمین در {fa_name} متولد می‌شوند",
    )

    # Rank lines: "71st lowest of 172 countries" / "61st highest of 172 countries"
    html = re.sub(
        r"(\d+)(st|nd|rd|th) lowest of (\d+) countries",
        lambda m: f"{fa_digits(m.group(1))}مین پایین‌ترین میان {fa_digits(m.group(3))} کشور",
        html,
    )
    html = re.sub(
        r"(\d+)(st|nd|rd|th) highest of (\d+) countries",
        lambda m: f"{fa_digits(m.group(1))}مین بالاترین میان {fa_digits(m.group(3))} کشور",
        html,
    )

    # Regions
    for en, fa in sorted(REGIONS.items(), key=lambda x: -len(x[0])):
        html = html.replace(en, fa)

    # Religions / disasters
    for en, fa in sorted(RELIGIONS.items(), key=lambda x: -len(x[0])):
        html = html.replace(en, fa)
    for en, fa in sorted(DISASTERS.items(), key=lambda x: -len(x[0])):
        html = html.replace(en, fa)

    # Labels
    for en, fa in LABELS:
        html = html.replace(en, fa)

    # Replace remaining English country names (longest first),
    # but don't touch language-switcher labels like "Bahasa Indonesia".
    protected: list[str] = []

    def protect(m: re.Match) -> str:
        protected.append(m.group(0))
        return f"\x00P{len(protected) - 1}\x00"

    html = re.sub(
        r"<a[^>]*hreflang=\"[^\"]+\"[^>]*>.*?</a>",
        protect,
        html,
        flags=re.S,
    )
    for en, fa in sorted(NAME_TO_FA.items(), key=lambda x: -len(x[0])):
        if en and en in html:
            html = html.replace(en, fa)
    for i, chunk in enumerate(protected):
        html = html.replace(f"\x00P{i}\x00", chunk)

    # Catch leftover "If you were born in the X" after name swaps (the + Persian name)
    html = re.sub(
        r"If you were born in(?: the)? ([^·<\"\n]+?)(?=\s*[·<\"|]|$)",
        lambda m: f"اگر در {m.group(1).strip()} متولد می‌شدید",
        html,
    )

    # Odds leftover: "1 in N"
    html = re.sub(r"\b1 in ([0-9,]+)\b", lambda m: f"۱ در {fa_digits(m.group(1))}", html)

    # CTA + sources
    html = re.sub(
        r'<div class="cta"><p>.*?</p>',
        f'<div class="cta"><p>{CTA_FA}</p>',
        html,
        count=1,
        flags=re.S,
    )
    html = re.sub(
        r"<p>Sources:.*?</p>",
        f"<p>{SOURCES_FA}</p>",
        html,
        count=1,
        flags=re.S,
    )

    # Footer lang list: ensure English + فارسی present with correct hrefs
    html = re.sub(
        rf'(<footer><p><a href="/fa/">۱ در ۸ میلیارد</a> · <a href="/fa/about/">درباره</a> · <a href="/fa/c/">همهٔ ۱۷۲ کشور</a> · )',
        rf'\1<a href="/en/c/{slug}" hreflang="en" lang="en">English</a> · <a href="/fa/c/{slug}" hreflang="fa" lang="fa">فارسی</a> · ',
        html,
        count=1,
    )

    # meta titles that still say English patterns
    html = html.replace("life expectancy", "امید به زندگی")
    html = html.replace("under-5 deaths", "مرگ زیر ۵ سال")

    # Rebuild meta description from Farsi h1 + lead (avoid mixed EN leftovers)
    h1 = re.search(r"<h1>(.*?)</h1>", html)
    lead = re.search(r'<p class="lead">(.*?)</p>', html)
    if h1 and lead:
        desc = re.sub(r"\s+", " ", f"{h1.group(1)}. {lead.group(1)}").strip()
        if len(desc) > 220:
            desc = desc[:217] + "…"
        safe = desc.replace('"', "&quot;")
        html = re.sub(
            r'(<meta name="description" content=")[^"]*(">)',
            rf"\1{safe}\2",
            html,
            count=1,
        )
        html = re.sub(
            r'(<meta property="og:description" content=")[^"]*(">)',
            rf"\1{safe}\2",
            html,
            count=1,
        )
        t_le = re.search(r"امید به زندگی ([0-9.]+)", html)
        t_u5 = re.search(r"([0-9.]+%)", html[html.find("<title>") : html.find("</title>") + 1] if "<title>" in html else "")
        new_title = (
            f"{h1.group(1)} · امید به زندگی {t_le.group(1) if t_le else ''}، "
            f"مرگ زیر ۵ سال {t_u5.group(1) if t_u5 else ''} | ۱ در ۸ میلیارد"
        )
        new_title = re.sub(r"\s+", " ", new_title).strip()
        html = re.sub(r"<title>.*?</title>", f"<title>{new_title}</title>", html, count=1)
        html = re.sub(
            r'(<meta property="og:title" content=")[^"]*(">)',
            rf'\1{new_title.replace(chr(34), "&quot;")}\2',
            html,
            count=1,
        )

    return html


# Filled in main
NAME_TO_FA: dict[str, str] = {}


def country_swap(name: str) -> str:
    name = name.strip().rstrip(",").strip()
    name = re.sub(r"^(the|The)\s+", "", name)
    return NAME_TO_FA.get(name, name)


def build_one(slug: str, en_name: str) -> None:
    en_path = download_en(slug)
    en_html = en_path.read_text(encoding="utf-8")
    iso = slug.upper()
    fa_name = COUNTRY_FA.get(iso, en_name)
    fa_html = transform_to_fa(en_html, slug, en_name, fa_name)
    out = FA_C / slug / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(fa_html, encoding="utf-8")


def main() -> None:
    global NAME_TO_FA
    slug_en = en_names_from_index()
    NAME_TO_FA = {en: COUNTRY_FA.get(slug.upper(), en) for slug, en in slug_en.items()}
    # common aliases
    NAME_TO_FA.update(
        {
            "United States": "ایالات متحده",
            "United Kingdom": "بریتانیا",
            "Czech Republic": "چک",
            "Czechia": "چک",
            "DR Congo": "جمهوری دموکراتیک کنگو",
            "Côte d'Ivoire": "ساحل عاج",
            "Cote d'Ivoire": "ساحل عاج",
        }
    )

    slugs = list(slug_en.keys())
    print(f"Building {len(slugs)} country pages…")

    # download EN in parallel first
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        futs = {ex.submit(download_en, s): s for s in slugs}
        done = 0
        for fut in concurrent.futures.as_completed(futs):
            s = futs[fut]
            try:
                fut.result()
                done += 1
                if done % 20 == 0:
                    print(f"  downloaded {done}/{len(slugs)}")
            except Exception as e:
                print("FAIL download", s, e)
                raise

    for i, slug in enumerate(slugs, 1):
        build_one(slug, slug_en[slug])
        if i % 40 == 0:
            print(f"  localized {i}/{len(slugs)}")

    # sanity
    ind = (FA_C / "ind" / "index.html").read_text(encoding="utf-8")
    assert "اگر در هند متولد می‌شدید" in ind
    assert "Vazirmatn" in ind
    assert 'lang="fa"' in ind
    assert 'href="/fa/c/pak"' in ind or "پاکستان" in ind
    print("OK", FA_C / "ind" / "index.html")


if __name__ == "__main__":
    main()
