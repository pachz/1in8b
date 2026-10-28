/**
 * Latin / romanized names → Persian script.
 * Exact overrides win. Everything else goes through a culture profile.
 */
const OVERRIDES = {
  // particles
  bin: "بن",
  binti: "بنت",
  ibn: "ابن",
  singh: "سینگ",
  kaur: "کور",
  de: { _: "دو", nl: "ده", it: "ده", pt: "د", lu: "د", tl: "د", es: "ده" },
  da: "دا",
  di: "دی",
  del: "دل",
  della: "دلا",
  dos: "دوس",
  das: "داس",
  van: "فن",
  von: "فون",
  den: "دن",
  der: "در",
  ten: "تن",
  ter: "تر",
  la: "لا",
  le: "لو",
  du: "دو",
  des: "ده",
  al: "ال",
  el: "ال",
  st: "سنت",
  saint: "سنت",
  y: "ای",
  e: "ای",

  // Persian
  reza: "رضا",
  mohammad: "محمد",
  mohammed: "محمد",
  muhammad: "محمد",
  mohamed: "محمد",
  ali: "علی",
  amir: "امیر",
  hossein: "حسین",
  hussein: "حسین",
  hüseyn: "حسین",
  mehdi: "مهدی",
  arash: "آرش",
  behnam: "بهنام",
  sina: "سینا",
  kian: "کیان",
  navid: "نوید",
  hamid: "حمید",
  saeed: "سعید",
  majid: "مجید",
  morteza: "مرتضی",
  javad: "جواد",
  hamed: "حامد",
  babak: "بابک",
  farhad: "فرهاد",
  kourosh: "کوروش",
  pouya: "پویا",
  amirhossein: "امیرحسین",
  mohsen: "محسن",
  ehsan: "احسان",
  omid: "امید",
  danial: "دانیال",
  parsa: "پارسا",
  saman: "سامان",
  zahra: "زهرا",
  zəhra: "زهرا",
  fatemeh: "فاطمه",
  fatima: "فاطمه",
  fatma: "فاطمه",
  fatimə: "فاطمه",
  maryam: "مریم",
  mariam: "مریم",
  sara: "سارا",
  narges: "نرگس",
  nərgiz: "نرگس",
  leila: "لیلا",
  leyla: "لیلا",
  laila: "لیلا",
  shirin: "شیرین",
  neda: "ندا",
  parisa: "پریسا",
  nazanin: "نازنین",
  mahsa: "مهسا",
  mina: "مینا",
  azadeh: "آزاده",
  elham: "الهام",
  mahnaz: "مهناز",
  roya: "رویا",
  röya: "رویا",
  shabnam: "شبنم",
  şəbnəm: "شبنم",
  ziba: "زیبا",
  golnaz: "گلناز",
  yasaman: "یاسمن",
  niloufar: "نیلوفر",
  nilofar: "نیلوفر",
  tara: "تارا",
  fereshteh: "فرشته",
  somayeh: "سمیه",
  zeinab: "زینب",
  zainab: "زینب",
  ladan: "لادن",
  helia: "هلیا",
  hosseini: "حسینی",
  mohammadi: "محمدی",
  ahmadi: "احمدی",
  rezaei: "رضایی",
  karimi: "کریمی",
  moradi: "مرادی",
  rahimi: "رحیمی",
  jafari: "جعفری",
  kazemi: "کاظمی",
  hashemi: "هاشمی",
  hashimi: "هاشمی",
  rostami: "رستمی",
  sadeghi: "صادقی",
  mousavi: "موسوی",
  akbari: "اکبری",
  ghasemi: "قاسمی",
  sharifi: "شریفی",
  bagheri: "باقری",
  najafi: "نجفی",
  ebrahimi: "ابراهیمی",
  salehi: "صالحی",
  heidari: "حیدری",
  shirazi: "شیرازی",
  tehrani: "تهرانی",
  farahani: "فراهانی",
  azizi: "عزیزی",

  // Arabic
  ahmed: "احمد",
  ahmad: "احمد",
  ahmet: "احمد",
  omar: "عمر",
  ömer: "عمر",
  ömər: "عمر",
  youssef: "یوسف",
  yusuf: "یوسف",
  yusif: "یوسف",
  mahmoud: "محمود",
  khaled: "خالد",
  khalid: "خالد",
  mustafa: "مصطفی",
  hassan: "حسن",
  hasan: "حسن",
  ibrahim: "ابراهیم",
  i̇brahim: "ابراهیم",
  abdullah: "عبدالله",
  abdullahi: "عبدالله",
  abdulla: "عبدالله",
  karim: "کریم",
  abdelrahman: "عبدالرحمان",
  "abdel-rahman": "عبدالرحمان",
  tarek: "طارق",
  samir: "سمیر",
  walid: "ولید",
  adel: "عادل",
  hamza: "حمزه",
  yassin: "یاسین",
  yasin: "یاسین",
  bilal: "بلال",
  ziad: "زیاد",
  nabil: "نبیل",
  amr: "عمرو",
  sami: "سامی",
  rami: "رامی",
  faris: "فارس",
  mazen: "مازن",
  anas: "انس",
  nour: "نور",
  aya: "آیه",
  salma: "سلما",
  rania: "رانیا",
  hana: "هنا",
  layla: "لیلا",
  amira: "امیره",
  yasmin: "یاسمین",
  huda: "هدی",
  mona: "مونا",
  aisha: "عایشه",
  khadija: "خدیجه",
  xədicə: "خدیجه",
  nada: "ندا",
  dina: "دینا",
  reem: "ریم",
  heba: "هبه",
  noha: "نها",
  doaa: "دعاء",
  asmaa: "اسماء",
  shaimaa: "شیماء",
  farah: "فرح",
  lina: "لینا",
  malak: "ملک",
  məmmədov: "محمداف",
  jana: "جانا",
  rawan: "روان",
  samira: "سمیره",
  mansour: "منصور",
  khalil: "خلیل",
  haddad: "حداد",
  saleh: "صالح",
  othman: "عثمان",
  osman: "عثمان",
  nasser: "ناصر",
  kamal: "کمال",
  kəmalə: "کماله",
  fawzi: "فوزی",
  sabri: "صبری",
  hamdan: "حمدان",
  najjar: "نجار",
  masri: "مصری",
  darwish: "درویش",
  suleiman: "سلیمان",
  süleymanov: "سلیمان‌اف",
  bakr: "بکر",
  farouk: "فاروق",
  zaki: "زکی",
  habib: "حبیب",
  rashid: "رشید",
  abdul: "عبدال",
  farid: "فرید",
  fərid: "فرید",
  wahid: "وحید",
  "gul agha": "گل‌آغا",
  najib: "نجیب",
  rahmatullah: "رحمت‌الله",
  zabihullah: "ذبیح‌الله",
  mirwais: "میرویس",
  "ahmad shah": "احمدشاه",
  zalmai: "زلمای",
  shafiq: "شفیق",
  nasir: "ناصر",
  sayed: "سید",
  bashir: "بشیر",
  aziz: "عزیز",
  jawad: "جواد",
  samiullah: "سمیع‌الله",
  naqibullah: "نقیب‌الله",
  rahim: "رحیم",
  feroz: "فیروز",
  ismail: "اسماعیل",
  shabana: "شبانه",
  malalai: "ملالی",
  freshta: "فرشته",
  gulalai: "گلالی",
  nazia: "نازیه",
  sima: "سیما",
  mursal: "مرسل",
  parwana: "پروانه",
  nooria: "نوریه",
  shakila: "شکیلا",
  sharifa: "شریفه",
  mahbooba: "محبوبه",
  hasina: "حسینه",
  zarghona: "زرغونه",
  shukria: "شکریه",
  farzana: "فرزانه",
  lida: "لیدا",
  wazhma: "واژمه",
  palwasha: "پلوشه",
  ahmadzai: "احمدزی",
  popal: "پوپال",
  stanekzai: "ستانکزی",
  hakimi: "حکیمی",
  sultani: "سلطانی",
  wardak: "وردک",
  noori: "نوری",
  safi: "سافی",
  amiri: "امیری",
  nazari: "نظری",
  hotak: "هوتک",
  durrani: "درانی",
  barakzai: "بارکزی",
  habibi: "حبیبی",
  khan: "خان",
  jalali: "جلالی",
  rasuli: "رسولی",
  sadat: "سادات",

  // Turkish
  mehmet: "مهمت",
  emre: "امره",
  murat: "مراد",
  burak: "بوراک",
  can: "جان",
  eymen: "ایمن",
  halil: "خلیل",
  hüseyin: "حسین",
  kemal: "کمال",
  hakan: "هاکان",
  serkan: "سرکان",
  oğuz: "اوغوز",
  kerem: "کرم",
  arda: "آردا",
  berk: "برک",
  furkan: "فرقان",
  umut: "اوموت",
  barış: "باریش",
  orhan: "اورهان",
  emin: "امین",
  enes: "انس",
  volkan: "ولکان",
  zeynep: "زینب",
  elif: "الیف",
  ayşe: "عایشه",
  emine: "امینه",
  defne: "دفنه",
  esra: "اسرا",
  merve: "مروه",
  hatice: "خدیجه",
  sibel: "سیبل",
  zehra: "زهرا",
  hacer: "هاجر",
  sultan: "سلطان",
  özlem: "اوزلم",
  gül: "گل",
  sevgi: "سوگی",
  derya: "دریا",
  selin: "سلین",
  ebru: "ابرو",
  nur: "نور",
  büşra: "بشری",
  kübra: "کبری",
  ecrin: "اجرین",
  azra: "عذرا",
  melek: "ملک",
  mələk: "ملک",
  hülya: "هولیا",
  meryem: "مریم",
  yılmaz: "یلماز",
  kaya: "کایا",
  demir: "دمیر",
  şahin: "شاهین",
  çelik: "چلیک",
  yıldız: "یلدیز",
  aydın: "آیدین",
  öztürk: "اوزترک",
  arslan: "ارسلان",
  doğan: "دوغان",
  aksoy: "آکسوی",
  erdoğan: "اردوغان",
  koç: "کوچ",
  kurt: "کورت",
  özdemir: "اوزدمیر",
  polat: "پولات",
  aslan: "اصلان",
  güneş: "گونش",
  kılıç: "قیلیچ",
  çetin: "چتین",
  kara: "کارا",
  korkmaz: "کورکماز",
  özkan: "اوزکان",
  şimşek: "شیمشک",
  turan: "توران",
  yavuz: "یاووز",
  ateş: "آتش",
  bulut: "بولوت",

  // Azerbaijani
  məhəmməd: "محمد",
  elvin: "الوین",
  rauf: "رئوف",
  tural: "تورال",
  orxan: "اورخان",
  rəşad: "رشاد",
  elçin: "الچین",
  kamran: "کامران",
  ramin: "رامین",
  vüqar: "وقار",
  nicat: "نجات",
  ruslan: "روسلان",
  anar: "انار",
  səbuhi: "صبحی",
  cavid: "جاوید",
  elnur: "النور",
  rövşən: "روشن",
  emil: "امیل",
  nihad: "نهاد",
  toğrul: "طغرل",
  rüstəm: "رستم",
  rustam: "رستم",
  i̇lkin: "ایلکین",
  ilkin: "ایلکین",
  aysel: "آیسل",
  günel: "گونل",
  nigar: "نگار",
  səbinə: "سبینه",
  aytən: "آیتن",
  nərmin: "نرمین",
  gülnar: "گلنار",
  gulnar: "گلنار",
  lalə: "لاله",
  aynur: "آینور",
  türkan: "تورکان",
  sevinc: "سوینج",
  könül: "کنول",
  nurlana: "نورلانا",
  sevda: "سودا",
  zərifə: "ظریفه",
  aygün: "آیگون",
  səidə: "سعیده",
  ayan: "آیان",
  fidan: "فیدان",
  hüseynov: "حسین‌اف",
  həsənov: "حسن‌اف",
  quliyev: "قلی‌اف",
  i̇smayılov: "اسماعیل‌اف",
  ismayılov: "اسماعیل‌اف",
  abbasov: "عباس‌اف",
  babayev: "بابایف",
  cəfərov: "جعفر‌اف",
  rzayev: "رضایف",
  kərimov: "کریم‌اف",
  mustafayev: "مصطفایف",
  nəsibov: "نصیب‌اف",
  orucov: "ارج‌اف",
  qasımov: "قاسم‌اف",
  rəhimov: "رحیم‌اف",
  vəliyev: "ولی‌اف",
  bayramov: "بایرام‌اف",
  nəbiyev: "نبی‌اف",
  sadıqov: "صادق‌اف",
  hacıyev: "حاجی‌اف",
  i̇brahimov: "ابراهیم‌اف",
  ibrahimov: "ابراهیم‌اف",
  musayev: "موسی‌اف",
  zeynalov: "زینال‌اف",
  şükürov: "شکور‌اف",
  novruzov: "نوروز‌اف",
  hümbətov: "همبت‌اف",
  mehdiyev: "مهدی‌اف",

  // Urdu / South Asian Muslim
  "muhammad ali": "محمد علی",
  usman: "عثمان",
  imran: "عمران",
  faisal: "فیصل",
  zain: "زین",
  danish: "دانش",
  saad: "سعد",
  umar: "عمر",
  asad: "اسد",
  kashif: "کاشف",
  waqas: "وقاص",
  adeel: "عدیل",
  fahad: "فهد",
  junaid: "جنید",
  shoaib: "شعیب",
  tariq: "طارق",
  naveed: "نوید",
  rizwan: "رضوان",
  sajid: "ساجد",
  arslan: "ارسلان",
  zeeshan: "ذیشان",
  nadeem: "ندیم",
  ayesha: "عایشه",
  sana: "ثنا",
  hira: "حیرا",
  amna: "آمنه",
  mahnoor: "ماه‌نور",
  iqra: "اقرا",
  rabia: "رابعه",
  nida: "ندا",
  sadia: "سعدیه",
  aliza: "علیزه",
  areeba: "اریبه",
  hafsa: "حفصه",
  mehwish: "مهوش",
  saima: "صائمه",
  shazia: "شازیه",
  bushra: "بشری",
  uzma: "عظمی",
  anum: "انعم",
  kiran: "کیران",
  rida: "ریدا",
  sidra: "سدره",
  fariha: "فریحه",
  javeria: "جاوریه",
  laiba: "لائبه",
  noor: "نور",
  samina: "ثمینه",
  malik: "ملک",
  butt: "بٹ",
  qureshi: "قریشی",
  chaudhry: "چودری",
  shah: "شاه",
  iqbal: "اقبال",
  raza: "رضا",
  ansari: "انصاری",
  siddiqui: "صدیقی",
  awan: "اعوان",
  mirza: "میرزا",
  rana: "رانا",
  sheikh: "شیخ",
  abbasi: "عباسی",
  gondal: "گوندل",
  bhatti: "بهاتی",
  rajput: "راجپوت",
  baig: "بیگ",
  hashmi: "هاشمی",
  jutt: "جٹ",
  memon: "مِمن",
  khattak: "ختک",
  sayed: "سید",
  "al-sayed": "السید",
  paul: "پل",
  louise: "لوئیز",
  chloé: "شلوئه",
  chloe: "شلوئه",
  lê: "له",
  "léo": "لئو",
  leo: "لئو",
  raphaël: "رافائل",
  raphael: "رافائل",
  ivan: "ایوان",
  andrey: "آندری",
  sergey: "سرگئی",
  dmitry: "دمیتری",
  yousafzai: "یوسف‌زی",
  hussain: "حسین",

  // Hebrew
  david: "داوود",
  yosef: "یوسف",
  ariel: "آریل",
  noam: "نوعام",
  eitan: "ایتان",
  moshe: "موشه",
  itai: "ایتای",
  yonatan: "یوناتان",
  daniel: "دانیل",
  avraham: "ابراهیم",
  yehuda: "یهودا",
  amit: { he: "عمیت", _: "آمیت" },
  omer: "عمر",
  uri: "اوری",
  lior: "لیئور",
  yair: "یایر",
  gal: "گال",
  ido: "ایدو",
  nadav: "نداو",
  eyal: "ایال",
  ron: "رون",
  tamar: "تمار",
  noa: "نوا",
  maya: "مایا",
  shira: "شیرا",
  yael: "یائل",
  avigail: "اویگایل",
  michal: "میکال",
  sarah: "سارا",
  rivka: "ریوکا",
  esther: "استر",
  hila: "هیلا",
  noya: "نویا",
  adi: "عدی",
  yarden: "یاردن",
  efrat: "افرات",
  talia: "تالیا",
  hadas: "هدَس",
  ayala: "آیالا",
  rachel: "راحیل",
  liat: "لیات",
  ella: "الا",
  cohen: "کوهن",
  levi: "لوی",
  mizrahi: "مزراحی",
  peretz: "پرتز",
  biton: "بیتون",
  friedman: "فریدمن",
  katz: "کاتز",
  dahan: "داهان",
  azoulay: "ازولای",
  ohana: "اوهانا",
  malka: "ملکا",
  goldberg: "گلدبرگ",
  shapiro: "شاپیرو",
  "ben-david": "بن‌داوود",
  amar: "عمار",
  gabay: "گبای",
  rosenberg: "روزنبرگ",
  weiss: "وایس",
  halevi: "هالوی",
  sasson: "ساسون",

  // Somali
  abdi: "عبدی",
  abdirahman: "عبدالرحمان",
  farah: "فرح",
  jama: "جامع",
  abdiweli: "عبدالولی",
  abdikarim: "عبدالکریم",
  mahad: "مهد",
  guled: "گولد",
  liban: "لیبان",
  said: "سعید",
  dahir: "ظاهر",
  warsame: "ورسمه",
  aden: "عدن",
  hodan: "هودان",
  fadumo: "فضیمو",
  sahra: "صحرا",
  ayaan: "آیان",
  hawa: "حوا",
  asha: "عایشه",
  ifrah: "افراح",
  khadra: "خضرا",
  amina: "آمنه",
  halimo: "حلیمو",
  hibo: "هیبو",
  nimco: "نیمکو",
  ubah: "ابه",
  sagal: "سگل",
  hamdi: "حمدی",
  muna: "منا",
  shukri: "شکری",
  idil: "ادل",
  ruqiyo: "رقیه",
  nasra: "نصره",
  deeqa: "دیقه",
  ikran: "اکران",
  fartun: "فرتون",
  bilan: "بیلان",

  // Common European given names (Persian media spellings)
  james: "جیمز",
  liam: "لیام",
  noah: "نوح",
  michael: "مایکل",
  william: "ویلیام",
  oliver: "الیور",
  ethan: "ایتن",
  jacob: "جیکوب",
  benjamin: "بنجامین",
  jack: "جک",
  lucas: "لوکاس",
  matthew: "متیو",
  joseph: "ژوزف",
  christopher: "کریستوفر",
  andrew: "اندرو",
  joshua: "جاشوا",
  ryan: "رایان",
  samuel: "ساموئل",
  henry: "هنری",
  alexander: "الکساندر",
  aleksandr: "الکساندر",
  aleksandar: "الکساندر",
  aleksander: "الکساندر",
  thomas: "توماس",
  nathan: "ناتان",
  tyler: "تایلر",
  brandon: "براندون",
  jayden: "جیدن",
  isaac: "اسحاق",
  owen: "اوون",
  caleb: "کیلب",
  dylan: "دیلان",
  connor: "کانر",
  logan: "لوگان",
  robert: "رابرت",
  john: "جان",
  mark: "مارک",
  anthony: "آنتونی",
  kevin: "کوین",
  olivia: "اولیویا",
  emma: "اما",
  charlotte: "شارلوت",
  amelia: "آملیا",
  sophia: "سوفیا",
  sofia: "سوفیا",
  isabella: "ایزابلا",
  mia: "میا",
  evelyn: "اولین",
  harper: "هارپر",
  abigail: "ابیگیل",
  emily: "امیلی",
  elizabeth: "الیزابت",
  sofía: "سوفیا",
  mila: "میلا",
  ella: "الا",
  avery: "اوری",
  scarlett: "اسکارلت",
  grace: "گریس",
  chloe: "کلوئی",
  victoria: "ویکتوریا",
  riley: "رایلی",
  aria: "آریا",
  lily: "لیلی",
  aurora: "آرورا",
  zoey: "زوئی",
  penelope: "پنه‌لوپه",
  layla: "لیلا",
  hannah: "هانا",
  natalie: "ناتالی",
  addison: "ادیسون",
  brooklyn: "بروکلین",
  lucy: "لوسی",
  stella: "استلا",
  leah: "لیا",
  hazel: "هیزل",
  violet: "ویولت",
  savannah: "ساوانا",
  audrey: "آدری",
  claire: "کلر",
  skylar: "اسکایلر",
  paisley: "پیزلی",
  eliana: "الیانا",
  anna: "آنا",
  caroline: "کارولین",
  genesis: "جنسیس",
  aaliyah: "عالیه",
  kennedy: "کندی",
  kinsley: "کینزلی",
  allison: "آلیسون",
  gabriel: "گابریل",
  smith: "اسمیت",
  johnson: "جانسون",
  williams: "ویلیامز",
  brown: "براون",
  jones: "جونز",
  garcia: "گارسیا",
  miller: "میلر",
  davis: "دیویس",
  rodriguez: "رودریگز",
  martinez: "مارتینز",
  hernandez: "هرناندز",
  lopez: "لوپز",
  gonzalez: "گونزالس",
  wilson: "ویلسون",
  anderson: "اندرسون",
  thomas: { fr: "توما", _: "توماس" },
  taylor: "تیلور",
  moore: "مور",
  jackson: "جکسون",
  martin: "مارتین",
  lee: "لی",
  perez: "پرز",
  thompson: "تامپسون",
  white: "وایت",
  harris: "هریس",
  sanchez: "سانچز",
  clark: "کلارک",
  ramirez: "رامیرز",
  lewis: "لوئیس",
  robinson: "رابینسون",
  walker: "واکر",
  young: "یانگ",
  allen: "آلن",
  king: "کینگ",
  wright: "رایت",
  scott: "اسکات",
  torres: "تورس",
  nguyen: "نگوین",
  hill: "هیل",
  flores: "فلورس",
  green: "گرین",
  adams: "آدامز",
  nelson: "نلسون",
  baker: "بیکر",
  hall: "هال",
  rivera: "ریورا",
  campbell: "کمبل",
  mitchell: "میچل",
  carter: "کارتر",
  roberts: "رابرتس",

  // pets
  max: "مکس",
  luna: "لونا",
  bella: "بلا",
  coco: "کوکو",
  milo: "میلو",
  charlie: "چارلی",
  lucky: "لاکی",
  toby: "توبی",
  rocky: "راکی",
  kitty: "کیتی",
  simba: "سیمبا",
  nala: "نالا",
  toffee: "تافی",
  buddy: "بادی",
  ginger: "جینجر",
  shadow: "شدو",
  fluffy: "فلافی",
  cookie: "کوکی",
  peanut: "پینات",
  oreo: "اوریو",
  choco: "چوکو",
  mocha: "موکا",
  biscuit: "بیسکویت",
  pepper: "پپر",
  honey: "هانی",
  snowy: "اسنووی",
  smokey: "اسموکی",
  tiger: "تایگر",
  leo: "لئو",
  lola: "لولا",
  daisy: "دیزی",
  bailey: "بیلی",
  molly: "مالی",
  jack: "جک",
  oscar: "اسکار",
  teddy: "تدی",
};

const PROFILE = {
  fa: "ar",
  ar: "ar",
  ps: "ar",
  ur: "ar",
  so: "ar",
  arc: "ar",
  amm: "ar",
  km: "ar",
  dv: "ar",
  film: "ar",
  mmm: "ar",
  ug: "az",
  tr: "tr",
  az: "az",
  de: "de",
  nl: "de",
  nd: "de",
  fr: "fr",
  ht: "fr",
  cf: "fr",
  wf: "fr",
  wfc: "fr",
  tdc: "fr",
  es: "es",
  la: "es",
  pt: "pt",
  br: "pt",
  lu: "pt",
  tl: "pt",
  it: "it",
  ru: "ru",
  ua: "ru",
  bg: "ru",
  sr: "ru",
  mk: "ru",
  ca: "ru",
  pl: "pl",
  cz: "cz",
  hr: "pl",
  sl: "pl",
  el: "el",
  vi: "vi",
  zh: "zh",
  ja: "ja",
  ko: "ko",
  he: "en",
  hk: "en",
};

const PY_INI = [
  ["zh", "ژ"],
  ["ch", "چ"],
  ["sh", "ش"],
  ["b", "ب"],
  ["p", "پ"],
  ["m", "م"],
  ["f", "ف"],
  ["d", "د"],
  ["t", "ت"],
  ["n", "ن"],
  ["l", "ل"],
  ["g", "گ"],
  ["k", "ک"],
  ["h", "ه"],
  ["j", "ج"],
  ["q", "چ"],
  ["x", "ش"],
  ["r", "ر"],
  ["z", "ز"],
  ["c", "تس"],
  ["s", "س"],
  ["y", ""],
  ["w", ""],
];
const PY_FIN = [
  ["iang", "یانگ"],
  ["iong", "یونگ"],
  ["uang", "وانگ"],
  ["ueng", "ونگ"],
  ["ian", "ین"],
  ["iao", "یائو"],
  ["uan", "وان"],
  ["uai", "وای"],
  ["ing", "ینگ"],
  ["ong", "ونگ"],
  ["ang", "انگ"],
  ["eng", "انگ"],
  ["ia", "یا"],
  ["ie", "یه"],
  ["iu", "یو"],
  ["in", "ین"],
  ["un", "ون"],
  ["ui", "وی"],
  ["ua", "وا"],
  ["uo", "ئو"],
  ["ue", "یوئه"],
  ["ve", "یوئه"],
  ["ai", "آی"],
  ["ei", "ای"],
  ["ao", "آئو"],
  ["ou", "او"],
  ["an", "ان"],
  ["en", "ان"],
  ["er", "ار"],
  ["a", "آ"],
  ["o", "او"],
  ["e", "ه"],
  ["i", "ی"],
  ["u", "و"],
  ["v", "یو"],
  ["ü", "یو"],
];

export function fold(s) {
  return String(s)
    .normalize("NFC")
    .replace(/İ/g, "i")
    .toLowerCase()
    .normalize("NFC");
}

function override(s, culture) {
  const k = fold(s);
  const hit = OVERRIDES[k];
  if (!hit) return null;
  if (typeof hit === "string") return hit;
  return hit[culture] || hit._ || null;
}

function ascii(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/ø/g, "o")
    .replace(/đ/g, "d")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ß/g, "ss");
}

function phonAr(raw) {
  let s = fold(raw).replace(/['’`-]/g, "");
  s = s
    .replace(/aa/g, "ا")
    .replace(/ee|ii/g, "ی")
    .replace(/oo|ou|uu/g, "و")
    .replace(/kh/g, "خ")
    .replace(/gh/g, "غ")
    .replace(/sh/g, "ش")
    .replace(/ch/g, "چ")
    .replace(/zh/g, "ژ")
    .replace(/th/g, "ث")
    .replace(/dh/g, "ذ")
    .replace(/ph/g, "ف");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const prev = s[i - 1] || "";
    const next = s[i + 1] || "";
    if ("aeo".includes(c)) {
      const edge = i === 0 || i === s.length - 1;
      const longish = i === s.length - 1 && c === "a";
      if (edge || longish || !"bcdfghjklmnpqrstvwxyzخغشچژثذف".includes(prev)) {
        out += c === "a" && i === 0 ? "ا" : c === "a" ? "ا" : c === "o" && i === 0 ? "ا" : "";
        if (c === "a" && i === s.length - 1 && out.endsWith("ا") === false) out += "ا";
        if (c === "a" && i === 0 && !out.endsWith("ا")) out += "ا";
      }
      if (c === "a" && i === 0) {
        if (!out.startsWith("ا")) out = "ا" + out;
      } else if (c === "o" && i === 0 && !out) out = "ا";
      else if (c === "e" && i === 0) out += "ا";
      else if (c === "a" && i === s.length - 1) {
        if (!out.endsWith("ا") && !out.endsWith("ی")) out += "ا";
      }
      continue;
    }
    if (c === "i" || c === "y") {
      out += "ی";
      continue;
    }
    if (c === "u" || c === "w") {
      out += "و";
      continue;
    }
    const map = {
      b: "ب",
      p: "پ",
      t: "ت",
      d: "د",
      r: "ر",
      z: "ز",
      s: "س",
      f: "ف",
      q: "ق",
      k: "ک",
      g: "گ",
      l: "ل",
      m: "م",
      n: "ن",
      h: "ه",
      j: "ج",
      v: "و",
      c: "ک",
      x: "کس",
    };
    if (map[c]) {
      if (out.endsWith(map[c]) && c === prev) continue;
      out += map[c];
    } else if (/[\u0600-\u06FF]/.test(c)) out += c;
  }
  return out.replace(/^اا/, "آ").replace(/اا/g, "ا");
}

function phonTr(raw) {
  let s = String(raw).normalize("NFC").replace(/İ/g, "i").replace(/I/g, "ı");
  s = s.toLowerCase();
  const map = [
    ["ç", "چ"],
    ["ş", "ش"],
    ["ğ", "غ"],
    ["ö", "و"],
    ["ü", "و"],
    ["ı", "ی"],
    ["c", "ج"],
    ["j", "ژ"],
    ["a", "ا"],
    ["e", "ا"],
    ["i", "ی"],
    ["o", "و"],
    ["u", "و"],
    ["b", "ب"],
    ["d", "د"],
    ["f", "ف"],
    ["g", "گ"],
    ["h", "ه"],
    ["k", "ک"],
    ["l", "ل"],
    ["m", "م"],
    ["n", "ن"],
    ["p", "پ"],
    ["r", "ر"],
    ["s", "س"],
    ["t", "ت"],
    ["v", "و"],
    ["y", "ی"],
    ["z", "ز"],
  ];
  let out = "";
  for (const ch of s) {
    const pair = map.find(([a]) => a === ch);
    out += pair ? pair[1] : "";
  }
  if (out.startsWith("ا")) out = "آ" + out.slice(1);
  return out.replace(/(.)\1/g, "$1");
}

function phonAz(raw) {
  let s = String(raw).normalize("NFC").replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
  const dig = [
    ["ç", "چ"],
    ["ş", "ش"],
    ["ğ", "غ"],
    ["ö", "و"],
    ["ü", "و"],
    ["ə", "ا"],
    ["ı", "ی"],
    ["x", "خ"],
    ["q", "ق"],
    ["c", "ج"],
    ["j", "ژ"],
  ];
  for (const [a, b] of dig) s = s.replaceAll(a, b);
  const map = {
    a: "ا",
    e: "ا",
    i: "ی",
    o: "و",
    u: "و",
    b: "ب",
    d: "د",
    f: "ف",
    g: "گ",
    h: "ه",
    k: "ک",
    l: "ل",
    m: "م",
    n: "ن",
    p: "پ",
    r: "ر",
    s: "س",
    t: "ت",
    v: "و",
    y: "ی",
    z: "ز",
  };
  let out = "";
  for (const ch of s) out += map[ch] || (/[\u0600-\u06FF]/.test(ch) ? ch : "");
  if (out.startsWith("ا")) out = "آ" + out.slice(1);
  return out.replace(/(.)\1/g, "$1");
}

function phonEn(raw, profile) {
  let rusuf = "";
  const accentE = /[éèêë]$/u.test(String(raw));
  let s = ascii(fold(raw));
  const silentE = /e$/.test(s) && !/[aeiou]e$/.test(s) && s.length > 3 && profile !== "es" && profile !== "it" && profile !== "pt" && profile !== "fr";
  if (silentE && profile === "en") s = s.slice(0, -1);
  if (profile === "de") {
    s = s
      .replace(/sch/g, "ش")
      .replace(/tsch/g, "چ")
      .replace(/ei/g, "آی")
      .replace(/ie/g, "ی")
      .replace(/eu/g, "اوی")
      .replace(/äu/g, "اوی")
      .replace(/ä/g, "ا")
      .replace(/ö/g, "و")
      .replace(/ü/g, "یو")
      .replace(/^sp/, "اشپ")
      .replace(/^st/, "اشت");
  }
  if (profile === "fr") {
    s = s
      .replace(/eau/g, "او")
      .replace(/ean/g, "ان")
      .replace(/ou/g, "و")
      .replace(/oi/g, "وا")
      .replace(/ch/g, "ش")
      .replace(/gn/g, "نی")
      .replace(/ge/g, "ژ")
      .replace(/gi/g, "ژی")
      .replace(/j/g, "ژ")
      .replace(/ph/g, "ف")
      .replace(/ç/g, "س");
    s = s.replace(/(?<=[aeiou])[stdx]$/, "");
    if (!accentE) s = s.replace(/e$/, "");
  }
  if (profile === "es") {
    s = s
      .replace(/ll/g, "ی")
      .replace(/ñ/g, "نی")
      .replace(/que/g, "که")
      .replace(/qui/g, "کی")
      .replace(/ce/g, "سه")
      .replace(/ci/g, "سی")
      .replace(/ge/g, "خه")
      .replace(/gi/g, "خی")
      .replace(/j/g, "خ")
      .replace(/h/g, "");
  }
  if (profile === "pt") {
    s = s
      .replace(/nh/g, "نی")
      .replace(/lh/g, "لی")
      .replace(/ão/g, "آئو")
      .replace(/õe/g, "اوی")
      .replace(/ch/g, "ش")
      .replace(/ç/g, "س")
      .replace(/j/g, "ژ")
      .replace(/h/g, "");
  }
  if (profile === "it") {
    s = s
      .replace(/gli/g, "لی")
      .replace(/gn/g, "نی")
      .replace(/ch/g, "ک")
      .replace(/gh/g, "گ")
      .replace(/ce$/g, "چه")
      .replace(/ge$/g, "جه")
      .replace(/ce/g, "چ")
      .replace(/ci/g, "چ")
      .replace(/ge/g, "ج")
      .replace(/gi/g, "ج")
      .replace(/zz/g, "تس");
  }
  if (profile === "vi") {
    s = s.replace(/uyen/g, "وین").replace(/uo/g, "و");
  }
  if (profile === "ru") {
    if (/ova$/.test(s)) {
      rusuf = "وا";
      s = s.slice(0, -3);
    } else if (/eva$/.test(s)) {
      rusuf = "وا";
      s = s.slice(0, -3);
    } else if (/ov$/.test(s)) {
      rusuf = "ف";
      s = s.slice(0, -2);
    } else if (/ev$/.test(s)) {
      rusuf = "ف";
      s = s.slice(0, -2);
    }
    s = s
      .replace(/shch/g, "شچ")
      .replace(/zh/g, "ژ")
      .replace(/kh/g, "خ")
      .replace(/ts/g, "تس")
      .replace(/ch/g, "چ")
      .replace(/sh/g, "ش")
      .replace(/ya/g, "یا")
      .replace(/yu/g, "یو")
      .replace(/yo/g, "یو")
      .replace(/ye/g, "یه");
  }
  if (profile === "pl" || profile === "cz") {
    s = s
      .replace(/sz/g, "ش")
      .replace(/cz/g, "چ")
      .replace(/rz/g, "ژ")
      .replace(/dz/g, "دز")
      .replace(/ch/g, "خ");
  }
  s = s
    .replace(/qu/g, "کو")
    .replace(/sch/g, "ش")
    .replace(/tch/g, "چ")
    .replace(/dge/g, "ج")
    .replace(/ch/g, "چ")
    .replace(/sh/g, "ش")
    .replace(/ph/g, "ف")
    .replace(/th/g, "ت")
    .replace(/kh/g, "خ")
    .replace(/gh/g, "غ")
    .replace(/zh/g, "ژ")
    .replace(/ck/g, "ک")
    .replace(/ng/g, "نگ")
    .replace(/wr/g, "ر")
    .replace(/kn/g, "ن");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const n = s[i + 1] || "";
    const two = c + n;
    const teams = {
      ai: "ای",
      ay: "ای",
      ei: "ای",
      ey: "ای",
      ea: "ی",
      ee: "ی",
      ie: "ی",
      oa: "او",
      oe: "و",
      oo: "و",
      ou: "او",
      ow: "او",
      oi: "اوی",
      oy: "اوی",
      au: profile === "es" || profile === "pt" || profile === "it" ? "آو" : "آ",
      aw: "آ",
      ew: "یو",
      ua: "وا",
      ui: "وی",
    };
    if (teams[two] && !/[\u0600-\u06FF]/.test(c)) {
      out += (two === "ey" || two === "ay") && i + 2 >= s.length ? "ی" : teams[two];
      i++;
      continue;
    }
    if (/[\u0600-\u06FF]/.test(c)) {
      out += c;
      continue;
    }
    if ("aeiouy".includes(c)) {
      if ((c === "i" || c === "y") && i === 0 && n && !"aeiou".includes(n)) {
        out += "ای";
        continue;
      }
      if ((c === "i" || c === "y") && out.endsWith("ی")) continue;
      if (c === "a" && n === "a") {
        out += i === 0 ? "آ" : "ا";
        i++;
        continue;
      }
      if (c === "a") out += i === 0 ? "آ" : "ا";
      else if (c === "e") {
        if ("aeiouy".includes(n)) out += "ئ";
        else if (i === 0) out += "ا";
        else if (!n && !/[آاویوهئ]/.test(out)) out += "ه";
      } else if (c === "i" || c === "y") out += "ی";
      else if (c === "o") out += i === 0 ? "او" : "و";
      else if (c === "u") out += i === 0 ? "او" : "و";
      continue;
    }
    const cons = {
      b: "ب",
      c: "سهیو".includes(n) ? "س" : "ک",
      d: "د",
      f: "ف",
      g: "گ",
      h: "ه",
      j: "ج",
      k: "ک",
      l: "ل",
      m: "م",
      n: "ن",
      p: "پ",
      q: "ق",
      r: "ر",
      s: "س",
      t: "ت",
      v: "و",
      w: "و",
      x: "کس",
      z: "ز",
    };
    if (cons[c]) {
      if (c === s[i - 1]) continue;
      out += cons[c];
    }
  }
  if (profile === "fr" && /[stdxz]$/.test(ascii(fold(raw))) && !/(ss|tt|zz)$/.test(ascii(fold(raw)))) {
    out = out.replace(/[ستدز]$/, "");
  }
  if (accentE && !/[هه]$/.test(out)) out += "ه";
  return (out + rusuf).replace(/^اا/, "آ").replace(/اا/g, "ا");
}

function pinyin(raw) {
  let s = ascii(fold(raw)).replace(/ü/g, "v").replace(/[^a-z]/g, "");
  let i = 0;
  let out = "";
  while (i < s.length) {
    let ini = "";
    let iniFa = "";
    let used = 0;
    for (const [lat, fa] of PY_INI) {
      if (lat && s.startsWith(lat, i)) {
        ini = lat;
        iniFa = fa;
        used = lat.length;
        break;
      }
    }
    let fin = "";
    let finFa = "";
    for (const [lat, fa] of PY_FIN) {
      if (s.startsWith(lat, i + used)) {
        fin = lat;
        finFa = fa;
        break;
      }
    }
    if (!fin) {
      out += phonEn(s[i] || "", "en");
      i++;
      continue;
    }
    const yw = {
      "y:i": "ی",
      "y:in": "یین",
      "y:ing": "یینگ",
      "y:u": "یو",
      "y:an": "یان",
      "y:ang": "یانگ",
      "y:ao": "یائو",
      "y:ou": "یو",
      "y:e": "یه",
      "y:ue": "یوئه",
      "y:ve": "یوئه",
      "y:a": "یا",
      "y:o": "یو",
      "y:ei": "یی",
      "w:u": "وو",
      "w:o": "وو",
      "w:ei": "وی",
      "w:ang": "وانگ",
      "w:eng": "ونگ",
      "w:en": "ون",
      "w:an": "وان",
      "w:a": "وا",
      "w:ai": "وای",
    };
    let piece = yw[ini + ":" + fin];
    if (!piece) {
      let finOut = finFa;
      if (iniFa && finOut.startsWith("آ")) finOut = "ا" + finOut.slice(1);
      if (fin === "en") finOut = "ن";
      if (fin === "ei") finOut = "ی";
      piece = iniFa + finOut;
    }
    out += piece;
    i += used + fin.length;
  }
  return out;
}

function romaji(raw) {
  let s = ascii(fold(raw)).replace(/[^a-z]/g, "");
  const dig = [
    ["sha", "شا"],
    ["shu", "شو"],
    ["sho", "شو"],
    ["chi", "چی"],
    ["cha", "چا"],
    ["chu", "چو"],
    ["cho", "چو"],
    ["tsu", "تسو"],
    ["shi", "شی"],
    ["fu", "فو"],
    ["ji", "جی"],
    ["ja", "جا"],
    ["ju", "جو"],
    ["jo", "جو"],
  ];
  let i = 0;
  let out = "";
  const vow = { a: "ا", i: "ی", u: "و", e: "", o: "و" };
  const con = {
    k: "ک",
    s: "س",
    t: "ت",
    n: "ن",
    h: "ه",
    m: "م",
    y: "ی",
    r: "ر",
    w: "و",
    g: "گ",
    z: "ز",
    d: "د",
    b: "ب",
    p: "پ",
  };
  while (i < s.length) {
    if (s[i] === s[i + 1] && con[s[i]]) {
      i++;
      continue;
    }
    let hit = false;
    for (const [lat, fa] of dig) {
      if (s.startsWith(lat, i)) {
        out += fa;
        i += lat.length;
        hit = true;
        break;
      }
    }
    if (hit) continue;
    const c = s[i];
    const v = s[i + 1];
    if (con[c] && Object.prototype.hasOwnProperty.call(vow, v)) {
      let vv = vow[v];
      if (v === "a" && out && !/[\u0600-\u06FFو]/.test(out.slice(-1))) vv = "ا";
      if (c === "y") out += v === "a" ? "یا" : v === "u" ? "یو" : v === "o" ? "یو" : "ی" + (v === "a" ? "" : vv);
      else out += con[c] + (v === "a" ? "ا" : vv);
      if (v === "a" && c !== "y") {
        /* already */
      }
      i += 2;
      continue;
    }
    if (c === "n") {
      out += "ن";
      i++;
      continue;
    }
    if (vow[c]) {
      if (c === "a" && i === 0) out += "آ";
      else if (c === "i" && i === 0) out += "ای";
      else if (c === "e") out += i === 0 ? "ا" : "";
      else if (c === "o" && i === 0) out += "او";
      else if (c === "u" && i === 0) out += "او";
      else out += vow[c];
      i++;
      continue;
    }
    i++;
  }
  return out.replace(/اا/g, "ا");
}

function korean(raw) {
  let s = ascii(fold(raw));
  const chunks = [
    ["yeong", "یونگ"],
    ["young", "یونگ"],
    ["yeon", "یون"],
    ["yeo", "یو"],
    ["eun", "اون"],
    ["eo", "ئو"],
    ["eu", "او"],
    ["ae", "ا"],
    ["wa", "وا"],
    ["wo", "وو"],
    ["we", "وه"],
    ["wi", "وی"],
    ["oo", "و"],
    ["ng", "نگ"],
    ["kk", "ک"],
    ["tt", "ت"],
    ["pp", "پ"],
    ["ss", "س"],
    ["jj", "ج"],
    ["ch", "چ"],
    ["kh", "خ"],
  ];
  let i = 0;
  let out = "";
  const cons = {
    b: "ب",
    c: "ک",
    d: "د",
    f: "ف",
    g: "گ",
    h: "ه",
    j: "ج",
    k: "ک",
    l: "ل",
    m: "م",
    n: "ن",
    p: "پ",
    r: "ر",
    s: "س",
    t: "ت",
    v: "و",
    w: "و",
    y: "ی",
    z: "ز",
  };
  const vow = { a: "ا", e: "ه", i: "ی", o: "و", u: "و" };
  while (i < s.length) {
    let hit = false;
    for (const [lat, fa] of chunks) {
      if (s.startsWith(lat, i)) {
        out += fa;
        i += lat.length;
        hit = true;
        break;
      }
    }
    if (hit) continue;
    const c = s[i];
    if (vow[c]) {
      out += c === "a" && (i === 0 || /نگ$/.test(out)) ? (i === 0 ? "آ" : "ا") : vow[c];
      i++;
      continue;
    }
    if (cons[c]) {
      out += cons[c];
      i++;
      continue;
    }
    i++;
  }
  return out.replace(/(.)\1/g, "$1");
}

function phonetic(raw, culture) {
  const profile = PROFILE[culture] || "en";
  if (profile === "ar") return phonAr(raw);
  if (profile === "tr") return phonTr(raw);
  if (profile === "az") return phonAz(raw);
  if (profile === "zh") return pinyin(raw);
  if (profile === "ja") return romaji(raw);
  if (profile === "ko") return korean(raw);
  return phonEn(raw, profile);
}

export function translateToken(token, culture) {
  if (!token) return token;
  const exact = override(token, culture);
  if (exact) return exact;
  const mc = token.match(/^mc(.+)$/i);
  if (mc) return "مک‌" + translateToken(mc[1], culture);
  const ob = token.match(/^o['’](.+)$/i);
  if (ob) return "او" + translateToken(ob[1], culture);
  return phonetic(token, culture);
}

export function translateName(name, culture = "en") {
  const s = String(name);
  if (!s) return s;
  if (/[\u0600-\u06FF]/.test(s) && !/[A-Za-z\u00C0-\u024F]/.test(s)) return s;
  const whole = override(s, culture);
  if (whole) return whole;
  if (/\s/.test(s)) {
    return s
      .split(/(\s+)/)
      .map((p) => (/^\s+$/.test(p) ? p : translateName(p, culture)))
      .join("");
  }
  if (s.includes("-")) {
    const parts = s.split("-");
    const fa = parts.map((p) => translateName(p, culture));
    const head = fold(parts[0]);
    const glue = ["ar", "fa", "ps", "ur", "so", "arc", "amm"].includes(culture);
    if (glue && (head === "al" || head === "abd" || head === "abdel" || head === "abdul" || head === "el")) {
      return fa.join("");
    }
    return fa.join("-");
  }
  return translateToken(s, culture);
}
