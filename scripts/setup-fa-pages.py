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
    # Do not replace bare "Today" here — it mangles "Today's" in longer copy.
    # Button label is applied later as a whole-word/context-safe pass.
    ("The future", "آینده"),
    ("Any world", "هر دوره"),
    ("Year of birth", "سال تولد"),
    ("Live a whole life in today's world. Today's statistics hold to the end.",
     "یک زندگی کامل را در دنیای امروز زندگی کنید. آمار امروز تا پایان برقرار می‌ماند."),
    ("The first picks a country by its number of births each year, the second by its population. Either way, life starts at age 0.",
     "اولی کشور را بر اساس شمار تولدهای سالانه انتخاب می‌کند، دومی بر اساس جمعیت. در هر دو حالت، زندگی از سن ۰ آغاز می‌شود."),
    ("The time it takes to live to that country’s life expectancy. At 1 hour, a year passes in about 40–60 seconds. You can pause or speed up while you live.",
     "زمانی که برای رسیدن به امید به زندگی آن کشور لازم است. در حالت ۱ ساعت، هر سال حدود ۴۰ تا ۶۰ ثانیه می‌گذرد. هنگام زندگی می‌توانید مکث کنید یا سرعت را بالا ببرید."),
    ("If you choose one, the life you live here is compared with the country you were really born in. It’s saved only on this device.",
     "اگر یکی را انتخاب کنید، زندگی‌ای که اینجا می‌زیید با کشوری که واقعاً در آن متولد شده‌اید مقایسه می‌شود. فقط روی همین دستگاه ذخیره می‌شود."),
    ("Hard things such as death, violence and suicide happen here at their real rates. No scene is shown, and where to find help comes with them.",
     "چیزهای سخت مثل مرگ، خشونت و خودکشی اینجا با نرخ واقعی‌شان رخ می‌دهند. صحنه‌ای نشان داده نمی‌شود و همراهشان جای کمک آمده است."),
    ("For your 10 most recent lives, press 'See again' to reopen the death record and the share card.",
     "برای ۱۰ زندگی اخیرتان، «دوباره ببین» را بزنید تا پروندهٔ مرگ و کارت اشتراک دوباره باز شود."),
    ("A deleted life cannot be brought back. A life placed in a memorial stays in the memorial.",
     "زندگی حذف‌شده بازنمی‌گردد. زندگی‌ای که در یادبود گذاشته شده در یادبود می‌ماند."),
    ("In the same second you are born, other babies are born all over the world. Four of them live out their lives by the same statistics, shown alongside yours. No one chose where to be born.",
     "در همان ثانیه‌ای که شما متولد می‌شوید، نوزادان دیگری در سراسر جهان به دنیا می‌آیند. چهار نفر از آن‌ها با همان آمار زندگی‌شان را پیش می‌برند و کنار زندگی شما نشان داده می‌شوند. هیچ‌کس محل تولدش را انتخاب نکرده است."),
    ("At 5, 15, 30, 50 and 70, time stops and asks you one question. Think about this person’s life and your own together, and leave a line if you like. At the end, you can say a few words to this person.",
     "در ۵، ۱۵، ۳۰، ۵۰ و ۷۰ سالگی زمان می‌ایستد و یک پرسش می‌پرسد. دربارهٔ زندگی این شخص و زندگی خودتان با هم فکر کنید و اگر خواستید خطی بنویسید. در پایان می‌توانید چند کلمه به این شخص بگویید."),
    ("For 172 countries: births, life expectancy by sex, infant and under-5 mortality, GDP per person (PPP), income inequality, years of schooling, university enrollment, employment in agriculture, fertility rate, maternal mortality, HIV, homicide rate, smoking rate, out-of-pocket health costs, child marriage rate and life satisfaction. The age at death comes from each country’s life tables by sex, and causes of death follow the patterns of the WHO Global Health Estimates by region and age.",
     "برای ۱۷۲ کشور: تولدها، امید به زندگی بر اساس جنس، مرگ‌ومیر نوزادان و زیر ۵ سال، تولید ناخالص داخلی سرانه (PPP)، نابرابری درآمد، سال‌های تحصیل، ثبت‌نام دانشگاه، اشتغال در کشاورزی، نرخ باروری، مرگ مادران، HIV، نرخ قتل، نرخ مصرف دخانیات، هزینه‌های درمانی از جیب، نرخ ازدواج کودکان و رضایت از زندگی. سن مرگ از جدول‌های عمر هر کشور بر اساس جنس می‌آید و علل مرگ از الگوهای برآورد سلامت جهانی سازمان بهداشت جهانی بر اساس منطقه و سن پیروی می‌کند."),
    ("If making decisions feels like too much, start a life and turn on 'Auto mode' in the bar at the top (the ⋯ menu on phones) to simply watch. You pick a focus for each year and make choices when decisions come up about school, work, love, moving abroad or medical care. Choices change a life, but it is hard to fully escape the statistics of the place you were born. Today’s world is calculated with today’s statistics, a past world with that year’s, and the coming world with UN and other projections. Income comes from the country’s income distribution (based on the Gini index), and amounts are shown in purchasing-power (PPP) dollars and in US terms, as they would feel at US prices. Suicide also happens from the teenage years on, as often as the real statistics say, without showing how or why.",
     "اگر تصمیم‌گرفتن زیاد به نظرتان سخت است، یک زندگی را شروع کنید و در نوار بالا «حالت خودکار» را روشن کنید (در موبایل از منوی ⋯) تا فقط تماشا کنید. برای هر سال یک تمرکز برمی‌گزینید و وقتی پای مدرسه، کار، عشق، مهاجرت یا درمان در میان است تصمیم می‌گیرید. انتخاب‌ها زندگی را عوض می‌کنند، اما گریختن کامل از آمار جایی که متولد شده‌اید دشوار است. دنیای امروز با آمار امروز محاسبه می‌شود، دنیای گذشته با آمار همان سال، و دنیای آینده با پیش‌بینی‌های سازمان ملل و دیگران. درآمد از توزیع درآمد کشور (بر پایهٔ شاخص جینی) می‌آید و مبالغ به دلار قدرت خرید (PPP) و به مقیاس آمریکا نشان داده می‌شوند، انگار در قیمت‌های آمریکا حس می‌شوند. خودکشی نیز از نوجوانی به بعد، به اندازهٔ آمار واقعی، رخ می‌دهد؛ بدون نشان‌دادن چگونگی یا چرایی."),
    ("Death, illness, war, poverty, drinking and gambling, drug dependence, violence at home, sexual violence and suicide happen here as often as the real statistics say, never shown in detail and always with where to find help, and a past world tells of real history such as wars and mass killings. It is made for ages 15 and up.",
     "مرگ، بیماری، جنگ، فقر، نوشیدن و قمار، وابستگی به مواد، خشونت خانگی، خشونت جنسی و خودکشی اینجا به اندازهٔ آمار واقعی رخ می‌دهند، هرگز با جزئیات نشان داده نمی‌شوند و همیشه همراه با جای کمک هستند؛ و دنیای گذشته از تاریخ واقعی مثل جنگ‌ها و کشتارهای جمعی می‌گوید. برای سنین ۱۵ سال به بالا ساخته شده است."),
    ("A life simulation the operator makes with AI (Claude); the numbers are public statistics from the UN, the World Bank and others.",
     "شبیه‌سازی زندگی‌ای که سازنده با هوش مصنوعی (Claude) می‌سازد؛ اعداد آمار عمومی سازمان ملل، بانک جهانی و دیگران است."),
    ('Teaching a class? Use <a href="?edu=1">Open in classroom mode</a>: heavier themes are held back, and posting and payments are off.',
     'در کلاس درس می‌دهید؟ از <a href="?edu=1">باز کردن در حالت کلاس</a> استفاده کنید: مضامین سنگین کمتر می‌شوند و انتشار و پرداخت‌ها خاموش‌اند.'),
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
    ("My memorials", "یادبودهای من"),
    ("Show more past lives", "نمایش زندگی‌های پیشین بیشتر"),
    ("Tidy up the records", "مرتب‌سازی پرونده‌ها"),
    ("Delete all", "حذف همه"),
    ("People in this simulation", "افراد این شبیه‌سازی"),
    ("Where they live now", "کجا الان زندگی می‌کنند"),
    ("A pause", "یک مکث"),
    ("What comes from real data", "آنچه از دادهٔ واقعی می‌آید"),
    (">Today<", ">امروز<"),
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
    # SEO meta / social / PWA
    ("Become one of the babies being born right now and live their whole life inside the real statistics of 172 countries. Where will you be born?",
     "یکی از نوزادانی شوید که همین حالا به‌دنیا می‌آیند و تمام زندگی‌شان را درون آمار واقعی ۱۷۲ کشور زندگی کنید. کجا متولد می‌شوید؟"),
    ("The official 1 in 8 Billion (1in8b), a free life simulation game: be born at random as one of today's babies and live one life in real data from 172 countries. No sign-up. Where will you be born?",
     "شبیه‌سازی رسمی زندگی ۱ در ۸ میلیارد (1in8b): به‌صورت تصادفی به‌عنوان یکی از نوزادان امروز متولد شوید و یک زندگی را با آمار واقعی ۱۷۲ کشور (سازمان ملل، WHO، بانک جهانی) تا پایان زندگی کنید. بدون ثبت‌نام. کجا متولد می‌شوید؟"),
    ("1 in 8 Billion (1in8b.ir) is a free life simulation: be born at random as one of today's babies and live one whole life in the real statistics of 172 countries. How it works, its data and who makes it.",
     "۱ در ۸ میلیارد (1in8b.ir) یک شبیه‌سازی رایگان زندگی است: به‌صورت تصادفی به‌عنوان یکی از نوزادان امروز متولد شوید و یک زندگی کامل را درون آمار واقعی ۱۷۲ کشور زندگی کنید. چطور کار می‌کند، داده‌ها از کجا می‌آیند و چه کسی آن را می‌سازد."),
    ("About 1 in 8 Billion · Official site 1in8b.ir",
     "دربارهٔ ۱ در ۸ میلیارد · سایت رسمی 1in8b.ir"),
    ("What 1 in 8 Billion handles, where it is kept, international transfers and your rights",
     "۱ در ۸ میلیارد چه داده‌هایی را پردازش می‌کند، کجا نگه‌داری می‌شود، انتقال‌های بین‌المللی و حقوق شما"),
    ("Who runs 1 in 8 Billion, how to use it, the keepsake pass and refunds",
     "چه کسی ۱ در ۸ میلیارد را اداره می‌کند، نحوهٔ استفاده، گذر یادگاری و بازپرداخت‌ها"),
    ("Privacy policy", "سیاست حفظ حریم خصوصی"),
    ("Terms and refunds", "شرایط و بازپرداخت"),
    ("Developer API", "API توسعه‌دهندگان"),
    ("Open in classroom mode", "باز کردن در حالت کلاس"),
    ("Language", "زبان"),
    ("Right now, about four babies are born every second. You become one of them and live that one life all the way to its end. Where you are born, and to whom, you don’t get to choose. Just as you didn’t.",
     "همین حالا، حدود چهار نوزاد در هر ثانیه متولد می‌شوند. شما یکی از آن‌ها می‌شوید و همان یک زندگی را تا پایانش می‌زیید. کجا و در چه خانواده‌ای به دنیا بیایید، انتخاب شما نیست. همان‌طور که نبود."),
    # Play screen chrome (static HTML; not covered by I18N alone)
    ("Newest first · <span class=\"sth\">tap a line for ☆</span>", "جدیدترین اول · <span class=\"sth\">برای ☆ روی یک خط بزن</span>"),
    ("Share of those born the same year still alive", "سهم کسانی که همان سال متولد شدند و هنوز زنده‌اند"),
    ("Change it anytime", "هر وقت خواستی عوض کن"),
    ("This year’s focus", "تمرکز امسال"),
    ("This year's focus", "تمرکز امسال"),
    ("Born in the same second", "متولد همان ثانیه"),
    ("At this same age", "در همین سن"),
    ("Family and life", "خانواده و زندگی"),
    ("Life record", "کارنامهٔ زندگی"),
    ("Life map", "نقشهٔ زندگی"),
    ("Survival curve", "منحنی بقا"),
    ("1 square = 1 year", "هر مربع = ۱ سال"),
    ("Spend &amp; invest", "خرج و سرمایه‌گذاری"),
    ("Spend & invest", "خرج و سرمایه‌گذاری"),
    ("What do these mean?", "این‌ها یعنی چه؟"),
    ("Light or dark", "روشن یا تاریک"),
    ("Show earlier lines", "نمایش خطوط قبلی"),
    ("A decision is waiting", "یک تصمیم در انتظار است"),
    ("Open it again", "دوباره بازش کن"),
    ("Back to top", "بازگشت به بالا"),
    ("Waiting decision", "تصمیم در انتظار"),
    ("This life right now", "این زندگی همین حالا"),
    ("Measures and this year's focus", "شاخص‌ها و تمرکز امسال"),
    ("Measures and this year’s focus", "شاخص‌ها و تمرکز امسال"),
    ("Music volume", "بلندی موسیقی"),
    ("Calm background music", "موسیقی پس‌زمینهٔ آرام"),
    ("Let decisions be made for you and just watch", "بگذار تصمیم‌ها برایت گرفته شوند و فقط تماشا کن"),
    ("Pause at 5, 15, 30, 50 and 70 to write down a thought", "در ۵، ۱۵، ۳۰، ۵۰ و ۷۰ مکث کن تا فکری بنویسی"),
    ("Keeps frightening scenes such as suicide, sexual violence, drugs and violence from happening", "جلوی رخ‌دادن صحنه‌های ترسناک مثل خودکشی، خشونت جنسی، مواد و خشونت را می‌گیرد"),
    ("Affects the risk of dying and whether you can keep working. Exercise, checkups and looking after yourself raise it; age lowers it.", "بر خطر مرگ و امکان ادامهٔ کار اثر دارد. ورزش، معاینه و مراقبت از خود آن را بالا می‌برد؛ سن پایینش می‌آورد."),
    ("How satisfied you are with life. Income, family and friends, health and debt all affect it.", "میزان رضایت از زندگی. درآمد، خانواده و دوستان، سلامت و بدهی همه بر آن اثر دارند."),
    ("Affects entrance exams, job offers and your starting pay. Your family's means and your country's schools matter more, and above about 70 more of it makes little difference.", "بر آزمون‌های ورودی، پیشنهاد کار و حقوق اولیه اثر دارد. وضع خانواده و مدارس کشور مهم‌ترند و بالای حدود ۷۰ تأثیر کمی دارد."),
    ("Your bonds with family and friends. They affect marriage and its crises, talks with your children, the chance of being bullied at school, and loneliness in old age.", "پیوند با خانواده و دوستان. بر ازدواج و بحران‌هایش، گفتگو با فرزندان، احتمال اذیت در مدرسه و تنهایی در پیری اثر دارد."),
    ("Higher numbers raise the odds; they never decide the outcome. As in real life, luck and circumstances play their part too.", "اعداد بالاتر شانس را بالا می‌برند؛ هرگز نتیجه را قطعی نمی‌کنند. مثل زندگی واقعی، شانس و شرایط هم نقش دارند."),
    ("Auto mode", "حالت خودکار"),
    ("Next decision", "تصمیم بعدی"),
    ("♪ Music", "♪ موسیقی"),
    ("✎ Pauses", "✎ مکث‌ها"),
    ("<b>Health</b>", "<b>سلامت</b>"),
    ("<b>Happiness</b>", "<b>شادی</b>"),
    ("<b>Knowledge</b>", "<b>دانش</b>"),
    ("<b>Relationships</b>", "<b>روابط</b>"),
    (">Status<", ">وضعیت<"),
    (">Focus<", ">تمرکز<"),
    (">Spend<", ">خرج<"),
    (">Exit<", ">خروج<"),
    (">Next<", ">بعدی<"),
    (">More<", ">بیشتر<"),
    ("aria-label=\"Next decision\"", "aria-label=\"تصمیم بعدی\""),
    ("aria-label=\"More\"", "aria-label=\"بیشتر\""),
]


FA_FONT_CSS = """
html[lang="fa"] {
  --f-display: "Vazirmatn", "IBM Plex Sans Arabic", Tahoma, serif;
  --f-body: "Vazirmatn", "IBM Plex Sans Arabic", system-ui, Tahoma, sans-serif;
  --f-mono: "IBM Plex Mono", "Vazirmatn", ui-monospace, Menlo, monospace;
}
html[lang="fa"] body { line-height: 1.85; font-family: var(--f-body) !important; word-break: normal !important; letter-spacing: 0 !important; }
html[lang="fa"] body * { word-break: normal !important; letter-spacing: 0 !important; font-style: normal !important; }
html[lang="fa"] .hero h1 { font-size: clamp(48px, 8vw, 120px); line-height: 1.2; font-weight: 700; }
html[lang="fa"] .stat { grid-template-columns: 7em minmax(0, 1fr) 2.4em; }
html[lang="fa"] .orow { grid-template-columns: 10em 1fr 3.6em; }
html[lang="fa"] .feed .f::before { content: "داده "; }
html[lang="fa"] .speed .ffsh { display: none; }
/* Static pages hardcode Hahmlet / IBM Plex Sans KR — force Vazirmatn */
html[lang="fa"] body,
html[lang="fa"] button,
html[lang="fa"] input,
html[lang="fa"] select,
html[lang="fa"] textarea {
  font-family: "Vazirmatn", "IBM Plex Sans Arabic", Tahoma, system-ui, sans-serif !important;
}
html[lang="fa"] h1,
html[lang="fa"] h2,
html[lang="fa"] .brand,
html[lang="fa"] .st b,
html[lang="fa"] .go,
html[lang="fa"] .btn,
html[lang="fa"] th,
html[lang="fa"] td,
html[lang="fa"] .lead,
html[lang="fa"] .kicker,
html[lang="fa"] .cta,
html[lang="fa"] footer {
  font-family: "Vazirmatn", "IBM Plex Sans Arabic", Tahoma, system-ui, sans-serif !important;
  letter-spacing: 0 !important;
}
html[lang="fa"] h1,
html[lang="fa"] h2,
html[lang="fa"] .brand,
html[lang="fa"] .st b { font-weight: 700; line-height: 1.45; }
html[lang="fa"] th,
html[lang="fa"] td { text-align: left; }
html[lang="fa"] th:first-child,
html[lang="fa"] td:first-child { text-align: right; }
html[lang="fa"] .cta { border-left: 1px solid var(--rule); border-right: 3px solid var(--accent); }
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
