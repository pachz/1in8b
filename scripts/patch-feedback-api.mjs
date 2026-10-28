#!/usr/bin/env node
/**
 * Replace Google Forms feedback with POST /api/feedback across language bundles.
 * Safe to re-run: skips bundles that already call /api/feedback.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const A_DIR = path.join(ROOT, "public", "a");

function imul(a, b) {
  a |= 0;
  b |= 0;
  const ah = (a >>> 16) & 0xffff;
  const al = a & 0xffff;
  const bh = (b >>> 16) & 0xffff;
  const bl = b & 0xffff;
  return (al * bl + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
}

function lHash(e) {
  let a = 3735928559;
  let t = 1103547991;
  for (let o = 0; o < e.length; o++) {
    const n = e.charCodeAt(o);
    a = imul(a ^ n, 2654435761);
    t = imul(t ^ n, 1597334677);
  }
  a = imul(a ^ (a >>> 16), 2246822507) ^ imul(t ^ (t >>> 13), 3266489909);
  t = imul(t ^ (t >>> 16), 2246822507) ^ imul(a ^ (a >>> 13), 3266489909);
  const val = 4294967296 * (2097151 & t) + (a >>> 0);
  return val.toString(36);
}

const OLD = {
  cta: '<a class="cta" id="fbSend" href="#" target="_blank" rel="noopener">구글폼으로 보내기</a><small>새 탭에 내용이 채워진 구글폼이 열려요. 거기서 제출 버튼을 눌러야 전송됩니다.</small>',
  priv: "보낸 내용은 Google 설문지(미국)로 전송되어 보관돼요. 이름이나 연락처는 쓰지 말아 주세요.",
  toast: "열린 구글폼에서 제출 버튼을 눌러야 전송돼요.",
  long: "더 긴 글은 구글폼이 열린 뒤 그 칸에서 이어서 써 주세요.",
};

const NEW = {
  cta: '<button class="cta" id="fbSend" type="button">보내기</button><small>누르면 바로 저장돼요.</small>',
  priv: "보낸 내용은 우리 서버에 저장돼요. 이름이나 연락처는 쓰지 말아 주세요.",
  toastOk: "보냈어요. 읽어 볼게요.",
  toastEmpty: "내용을 적어 주세요.",
  toastRate: "너무 자주 보냈어요. 잠시 후 다시 해 주세요.",
  toastLen: "내용을 조금 더 적어 주세요.",
  toastBusy: "지금 잠시 바빠요. 잠시 후 다시 해 주세요.",
  toastFail: "보내지 못했어요. 잠시 후 다시 해 주세요.",
  long: "최대 1,200자까지 쓸 수 있어요.",
};

const NEW_KEYS = Object.fromEntries(
  Object.entries(NEW).map(([k, v]) => [k, lHash(v)]),
);

const I18N_NEW = {
  en: {
    cta: '<button class="cta" id="fbSend" type="button">Send</button><small>Your message is saved as soon as you press it.</small>',
    priv: "What you send is kept on our server. Please do not include names or contact details.",
    toastOk: "Sent. We'll read it.",
    toastEmpty: "Please write something first.",
    toastRate: "Too many messages. Please try again in a moment.",
    toastLen: "Please write a little more.",
    toastBusy: "We're a bit busy right now. Please try again in a moment.",
    toastFail: "Couldn't send. Please try again in a moment.",
    long: "You can write up to 1,200 characters.",
  },
  fa: {
    cta: '<button class="cta" id="fbSend" type="button">ارسال</button><small>با زدن دکمه، همان‌جا ذخیره می‌شود.</small>',
    priv: "آنچه می‌فرستید روی سرور ما ذخیره می‌شود. نام یا اطلاعات تماس ننویسید.",
    toastOk: "فرستاده شد. می‌خوانیمش.",
    toastEmpty: "لطفاً چیزی بنویسید.",
    toastRate: "خیلی پشت‌سرهم فرستادید. کمی بعد دوباره امتحان کنید.",
    toastLen: "کمی بیشتر بنویسید.",
    toastBusy: "الان شلوغ است. کمی بعد دوباره امتحان کنید.",
    toastFail: "فرستاده نشد. کمی بعد دوباره امتحان کنید.",
    long: "تا ۱٬۲۰۰ نویسه می‌توانید بنویسید.",
  },
  ja: {
    cta: '<button class="cta" id="fbSend" type="button">送る</button><small>押すとその場で保存されます。</small>',
    priv: "送信内容は当社のサーバーに保存されます。氏名や連絡先は書かないでください。",
    toastOk: "送りました。拝見します。",
    toastEmpty: "内容を書いてください。",
    toastRate: "送信が多すぎます。しばらくしてからもう一度どうぞ。",
    toastLen: "もう少し書いてください。",
    toastBusy: "混み合っています。しばらくしてからもう一度どうぞ。",
    toastFail: "送れませんでした。しばらくしてからもう一度どうぞ。",
    long: "最大1,200字まで書けます。",
  },
  zh: {
    cta: '<button class="cta" id="fbSend" type="button">送出</button><small>按下後會立刻儲存。</small>',
    priv: "你送出的內容會保存在我們的伺服器。請不要寫姓名或聯絡方式。",
    toastOk: "已送出。我們會閱讀。",
    toastEmpty: "請先寫一點內容。",
    toastRate: "送得太頻繁了。請稍後再試。",
    toastLen: "請再多寫一點。",
    toastBusy: "現在有點忙。請稍後再試。",
    toastFail: "沒能送出。請稍後再試。",
    long: "最多可以寫 1,200 字。",
  },
  "zh-hans": {
    cta: '<button class="cta" id="fbSend" type="button">发送</button><small>按下后会立刻保存。</small>',
    priv: "你发送的内容会保存在我们的服务器。请不要写姓名或联系方式。",
    toastOk: "已发送。我们会阅读。",
    toastEmpty: "请先写一点内容。",
    toastRate: "发送太频繁了。请稍后再试。",
    toastLen: "请再多写一点。",
    toastBusy: "现在有点忙。请稍后再试。",
    toastFail: "没能发送。请稍后再试。",
    long: "最多可以写 1,200 字。",
  },
  vi: {
    cta: '<button class="cta" id="fbSend" type="button">Gửi</button><small>Nhấn là lưu ngay.</small>',
    priv: "Nội dung bạn gửi được lưu trên máy chủ của chúng tôi. Xin đừng ghi tên hay thông tin liên lạc.",
    toastOk: "Đã gửi. Chúng tôi sẽ đọc.",
    toastEmpty: "Hãy viết gì đó trước.",
    toastRate: "Gửi quá nhiều. Hãy thử lại sau.",
    toastLen: "Hãy viết thêm một chút.",
    toastBusy: "Hiện đang bận. Hãy thử lại sau.",
    toastFail: "Không gửi được. Hãy thử lại sau.",
    long: "Bạn có thể viết tối đa 1.200 ký tự.",
  },
  fr: {
    cta: '<button class="cta" id="fbSend" type="button">Envoyer</button><small>Appuyer enregistre tout de suite.</small>',
    priv: "Ce que vous envoyez est conservé sur notre serveur. N’indiquez ni nom ni coordonnées.",
    toastOk: "Envoyé. Nous le lirons.",
    toastEmpty: "Écrivez quelque chose d’abord.",
    toastRate: "Trop de messages. Réessayez dans un moment.",
    toastLen: "Écrivez un peu plus.",
    toastBusy: "Nous sommes un peu occupés. Réessayez dans un moment.",
    toastFail: "Envoi impossible. Réessayez dans un moment.",
    long: "Vous pouvez écrire jusqu’à 1 200 caractères.",
  },
  th: {
    cta: '<button class="cta" id="fbSend" type="button">ส่ง</button><small>กดแล้วบันทึกทันที</small>',
    priv: "สิ่งที่คุณส่งจะเก็บไว้บนเซิร์ฟเวอร์ของเรา โปรดอย่าใส่ชื่อหรือข้อมูลติดต่อ",
    toastOk: "ส่งแล้ว เราจะอ่าน",
    toastEmpty: "โปรดเขียนอะไรสักหน่อย",
    toastRate: "ส่งบ่อยเกินไป โปรดลองใหม่ภายหลัง",
    toastLen: "โปรดเขียนเพิ่มอีกนิด",
    toastBusy: "ตอนนี้ไม่ว่าง โปรดลองใหม่ภายหลัง",
    toastFail: "ส่งไม่สำเร็จ โปรดลองใหม่ภายหลัง",
    long: "เขียนได้สูงสุด 1,200 ตัวอักษร",
  },
  es: {
    cta: '<button class="cta" id="fbSend" type="button">Enviar</button><small>Al pulsar se guarda al momento.</small>',
    priv: "Lo que envías se guarda en nuestro servidor. No incluyas nombres ni datos de contacto.",
    toastOk: "Enviado. Lo leeremos.",
    toastEmpty: "Escribe algo primero.",
    toastRate: "Demasiados mensajes. Prueba de nuevo en un momento.",
    toastLen: "Escribe un poco más.",
    toastBusy: "Ahora estamos un poco ocupados. Prueba de nuevo en un momento.",
    toastFail: "No se pudo enviar. Prueba de nuevo en un momento.",
    long: "Puedes escribir hasta 1.200 caracteres.",
  },
  de: {
    cta: '<button class="cta" id="fbSend" type="button">Senden</button><small>Mit dem Tippen wird sofort gespeichert.</small>',
    priv: "Was du sendest, wird auf unserem Server gespeichert. Bitte keine Namen oder Kontaktdaten angeben.",
    toastOk: "Gesendet. Wir lesen es.",
    toastEmpty: "Bitte schreib zuerst etwas.",
    toastRate: "Zu viele Nachrichten. Bitte versuch es gleich noch einmal.",
    toastLen: "Bitte schreib etwas mehr.",
    toastBusy: "Gerade etwas voll. Bitte versuch es gleich noch einmal.",
    toastFail: "Senden fehlgeschlagen. Bitte versuch es gleich noch einmal.",
    long: "Du kannst bis zu 1.200 Zeichen schreiben.",
  },
  pt: {
    cta: '<button class="cta" id="fbSend" type="button">Enviar</button><small>Ao tocar, grava na hora.</small>',
    priv: "O que você envia fica no nosso servidor. Não inclua nomes nem contatos.",
    toastOk: "Enviado. Vamos ler.",
    toastEmpty: "Escreva algo primeiro.",
    toastRate: "Mensagens demais. Tente de novo em instantes.",
    toastLen: "Escreva um pouco mais.",
    toastBusy: "Estamos um pouco ocupados. Tente de novo em instantes.",
    toastFail: "Não deu para enviar. Tente de novo em instantes.",
    long: "Você pode escrever até 1.200 caracteres.",
  },
  ru: {
    cta: '<button class="cta" id="fbSend" type="button">Отправить</button><small>Нажатие сразу сохраняет.</small>',
    priv: "Отправленное хранится на нашем сервере. Не указывайте имена и контакты.",
    toastOk: "Отправлено. Мы прочитаем.",
    toastEmpty: "Сначала напишите что-нибудь.",
    toastRate: "Слишком много сообщений. Попробуйте чуть позже.",
    toastLen: "Напишите чуть больше.",
    toastBusy: "Сейчас занято. Попробуйте чуть позже.",
    toastFail: "Не удалось отправить. Попробуйте чуть позже.",
    long: "Можно написать до 1 200 символов.",
  },
  tr: {
    cta: '<button class="cta" id="fbSend" type="button">Gönder</button><small>Basınca hemen kaydedilir.</small>',
    priv: "Gönderdiğin içerik sunucumuzda saklanır. Lütfen ad veya iletişim bilgisi yazma.",
    toastOk: "Gönderildi. Okuyacağız.",
    toastEmpty: "Önce bir şey yaz.",
    toastRate: "Çok sık gönderdin. Biraz sonra yine dene.",
    toastLen: "Biraz daha yaz.",
    toastBusy: "Şu an yoğuz. Biraz sonra yine dene.",
    toastFail: "Gönderilemedi. Biraz sonra yine dene.",
    long: "En fazla 1.200 karakter yazabilirsin.",
  },
  id: {
    cta: '<button class="cta" id="fbSend" type="button">Kirim</button><small>Begitu ditekan, langsung tersimpan.</small>',
    priv: "Isi yang kamu kirim disimpan di server kami. Jangan cantumkan nama atau kontak.",
    toastOk: "Terkirim. Kami akan membacanya.",
    toastEmpty: "Tulis sesuatu dulu.",
    toastRate: "Terlalu sering mengirim. Coba lagi sebentar lagi.",
    toastLen: "Tulis sedikit lebih banyak.",
    toastBusy: "Sedang sibuk. Coba lagi sebentar lagi.",
    toastFail: "Gagal mengirim. Coba lagi sebentar lagi.",
    long: "Kamu bisa menulis hingga 1.200 karakter.",
  },
  it: {
    cta: '<button class="cta" id="fbSend" type="button">Invia</button><small>Toccando si salva subito.</small>',
    priv: "Ciò che invii viene conservato sul nostro server. Non inserire nomi o contatti.",
    toastOk: "Inviato. Lo leggeremo.",
    toastEmpty: "Scrivi qualcosa prima.",
    toastRate: "Troppi messaggi. Riprova tra un momento.",
    toastLen: "Scrivi un po’ di più.",
    toastBusy: "Siamo un po’ impegnati. Riprova tra un momento.",
    toastFail: "Invio non riuscito. Riprova tra un momento.",
    long: "Puoi scrivere fino a 1.200 caratteri.",
  },
  ar: {
    cta: '<button class="cta" id="fbSend" type="button">إرسال</button><small>بالضغط يُحفظ فورًا.</small>',
    priv: "ما ترسله يُحفظ على خادمنا. من فضلك لا تكتب أسماء أو معلومات اتصال.",
    toastOk: "أُرسل. سنقرأه.",
    toastEmpty: "اكتب شيئًا أولًا.",
    toastRate: "أرسلت كثيرًا. حاول بعد قليل.",
    toastLen: "اكتب أكثر قليلًا.",
    toastBusy: "مشغولون الآن. حاول بعد قليل.",
    toastFail: "تعذّر الإرسال. حاول بعد قليل.",
    long: "يمكنك كتابة حتى ١٬٢٠٠ حرف.",
  },
};

const SEND_FEEDBACK_FN = `async function sendFeedback(){const e=$("#fbSend"),t=((($("#fbText")||{}).value)||"").trim(),a=((($("#fbNick")||{}).value)||"").trim().slice(0,40);if(!t||t.length<2){toast(L\`${NEW.toastEmpty}\`);return}e&&(e.disabled=!0);let n=null;try{n=await fetch("/api/feedback",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({s:typeof SID<"u"?SID:"",type:FB_TYPES_FORM[FB_TYPES.indexOf(UI.fbType)]||UI.fbType||"",text:t.slice(0,FB_MAX),nick:a,ctx:UI.fbCtx||"",lang:typeof LANG<"u"?LANG:"en"})}).then(r=>r.json())}catch{n={ok:!1,why:"net"}}if(e&&(e.disabled=!1),n&&n.ok){track("feedback_form",{type:UI.fbType}),toast(L\`${NEW.toastOk}\`),typeof sheetX=="function"&&sheetX();return}const s=n&&n.why;toast(s==="rate"?L\`${NEW.toastRate}\`:s==="len"?L\`${NEW.toastLen}\`:s==="busy"||s==="full"?L\`${NEW.toastBusy}\`:L\`${NEW.toastFail}\`)}`;

function langOf(name) {
  const base = name.replace(/^([a-z-]+)\.[a-f0-9]+\.js$/i, "$1");
  return base === name ? null : base;
}

function patchLogic(js) {
  if (js.includes('fetch("/api/feedback"')) return { js, changed: false };

  let out = js.replace(
    /feedbackForm:"https:\/\/docs\.google\.com\/forms\/[^"]+"/,
    'feedbackForm:""',
  );

  const openRe =
    /const ([a-z])=CONFIG\.feedbackForm\?L`<a class="cta" id="fbSend"[^`]*`:\s*L`<button class="cta" id="fbCopy"[^`]*`;/;
  if (!openRe.test(out)) {
    throw new Error("openFeedback CTA ternary not found");
  }
  out = out.replace(openRe, (_m, v) => `const ${v}=L\`${NEW.cta}\`;`);

  out = out.replace(
    /\$\{L`더 긴 글은 구글폼이 열린 뒤 그 칸에서 이어서 써 주세요\.`\}/,
    `\${L\`${NEW.long}\`}`,
  );

  out = out.replace(
    /\+\(CONFIG\.feedbackForm\?`<p class="fbnote">\$\{L`보낸 내용은 Google 설문지\(미국\)로 전송되어 보관돼요\. 이름이나 연락처는 쓰지 말아 주세요\.`\} \$\{privacyLink\(\)\}<\/p>`:""\)/,
    `+\`<p class="fbnote">\${L\`${NEW.priv}\`} \${privacyLink()}</p>\``,
  );

  const clickRe =
    /document\.addEventListener\("click",([a-z])=>\{\1\.target\.id==="fbSend"&&\(track\("feedback_form",\{type:UI\.fbType\}\),setTimeout\(\(\)=>toast\(L`열린 구글폼에서 제출 버튼을 눌러야 전송돼요\.`\),300\)\)\}\)/;
  if (!clickRe.test(out)) {
    throw new Error("fbSend click handler not found");
  }
  out = out.replace(
    clickRe,
    'document.addEventListener("click",$1=>{$1.target.id==="fbSend"&&($1.preventDefault(),sendFeedback())})',
  );

  if (!out.includes("function sendFeedback")) {
    out = out.replace(
      "function openFeedback()",
      `${SEND_FEEDBACK_FN}function openFeedback()`,
    );
  }

  return { js: out, changed: true };
}

function upsertI18n(js, lang) {
  if (lang === "ko") return js;
  const map = I18N_NEW[lang] || I18N_NEW.en;
  const start = js.indexOf("I18N_T={");
  if (start < 0) return js;
  const brace = start + "I18N_T=".length;
  let depth = 0,
    inStr = false,
    esc = false,
    quote = null,
    end = -1;
  for (let j = brace; j < js.length; j++) {
    const c = js[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === quote) inStr = false;
    } else if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
    } else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = j + 1;
        break;
      }
    }
  }
  if (end < 0) return js;

  let obj;
  try {
    obj = Function(`"use strict"; return (${js.slice(brace, end)})`)();
  } catch {
    console.warn("skip I18N parse for", lang);
    return js;
  }

  for (const [name, text] of Object.entries(map)) {
    obj[NEW_KEYS[name]] = text;
  }
  // Keep old keys pointing at new copy so stale code paths stay harmless
  obj[lHash(OLD.cta)] = map.cta;
  obj[lHash(OLD.priv)] = map.priv;
  obj[lHash(OLD.toast)] = map.toastOk;
  obj[lHash(OLD.long)] = map.long;

  const rebuilt =
    "{" +
    Object.entries(obj)
      .map(([k, v]) => {
        const key = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : JSON.stringify(k);
        return `${key}:${JSON.stringify(v)}`;
      })
      .join(",") +
    "}";
  return js.slice(0, brace) + rebuilt + js.slice(end);
}

function contentHash(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 10);
}

function rehashAndRelink(lang, oldName, js) {
  const hash = contentHash(js);
  const newName = `${lang}.${hash}.js`;
  const oldPath = path.join(A_DIR, oldName);
  const newPath = path.join(A_DIR, newName);
  fs.writeFileSync(newPath, js);
  if (newName !== oldName && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

  // Update HTML script tags that pointed at the old file
  const publicDir = path.join(ROOT, "public");
  const walk = (dir, out = []) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        if (name === "a" || name === "fonts" || name === "node_modules") continue;
        walk(full, out);
      } else if (name.endsWith(".html")) out.push(full);
    }
    return out;
  };
  let htmlHits = 0;
  for (const file of walk(publicDir)) {
    let html = fs.readFileSync(file, "utf8");
    const next = html.replaceAll(`/a/${oldName}`, `/a/${newName}`);
    if (next !== html) {
      fs.writeFileSync(file, next);
      htmlHits++;
    }
  }
  return { newName, htmlHits };
}

function patchPrivacy() {
  const replacements = [
    [
      "Sent through Google Forms and kept in Google Sheets.",
      "Sent to our server and kept in our database.",
    ],
    [
      "Google 설문지로 보내져 Google 스프레드시트에 보관됩니다.",
      "우리 서버로 보내져 데이터베이스에 보관됩니다.",
    ],
    [
      "透過Google表單送出，保存在Google試算表中。",
      "送到我們的伺服器，保存在我們的資料庫中。",
    ],
    [
      "透過Google表单送出，保存在Google试算表中。",
      "送到我们的服务器，保存在我们的数据库中。",
    ],
    [
      "Google フォームで送信され、Google スプレッドシートに保管されます。",
      "当社のサーバーに送信され、データベースに保管されます。",
    ],
    [
      "Được gửi qua Google Forms và lưu trong Google Sheets.",
      "Được gửi lên máy chủ của chúng tôi và lưu trong cơ sở dữ liệu.",
    ],
    [
      "Envoyé via Google Forms et conservé dans Google Sheets.",
      "Envoyé vers notre serveur et conservé dans notre base de données.",
    ],
    [
      "ส่งผ่าน Google Forms และเก็บไว้ใน Google Sheets",
      "ส่งไปยังเซิร์ฟเวอร์ของเราและเก็บไว้ในฐานข้อมูล",
    ],
    [
      "Se envían por Google Forms y se guardan en Google Sheets.",
      "Se envían a nuestro servidor y se guardan en nuestra base de datos.",
    ],
    [
      "Über Google Forms gesendet und in Google Sheets gespeichert.",
      "An unseren Server gesendet und in unserer Datenbank gespeichert.",
    ],
    [
      "São enviados pelo Google Forms e guardados no Google Sheets.",
      "São enviados ao nosso servidor e guardados na nossa base de dados.",
    ],
    [
      "Отправляются через Google Forms и хранятся в Google Sheets.",
      "Отправляются на наш сервер и хранятся в нашей базе данных.",
    ],
    [
      "Google Forms üzerinden gönderilir ve Google Sheets’te saklanır.",
      "Sunucumuza gönderilir ve veritabanımızda saklanır.",
    ],
    [
      "Dikirim lewat Google Forms dan disimpan di Google Sheets.",
      "Dikirim ke server kami dan disimpan di basis data kami.",
    ],
    [
      "Inviati tramite Google Forms e conservati in Google Sheets.",
      "Inviati al nostro server e conservati nel nostro database.",
    ],
    [
      "تُرسل عبر Google Forms وتُحفظ في Google Sheets.",
      "تُرسل إلى خادمنا وتُحفظ في قاعدة بياناتنا.",
    ],
  ];
  let n = 0;
  for (const file of fs.readdirSync(path.join(ROOT, "public"), {
    withFileTypes: true,
  })) {
    if (!file.isDirectory()) continue;
    const priv = path.join(ROOT, "public", file.name, "privacy", "index.html");
    if (!fs.existsSync(priv)) continue;
    let html = fs.readFileSync(priv, "utf8");
    const before = html;
    for (const [a, b] of replacements) html = html.replaceAll(a, b);
    if (html !== before) {
      fs.writeFileSync(priv, html);
      n++;
    }
  }
  return n;
}

function updateFaJson() {
  const p = path.join(ROOT, "data", "i18n_fa.json");
  if (!fs.existsSync(p)) return 0;
  const obj = JSON.parse(fs.readFileSync(p, "utf8"));
  const map = I18N_NEW.fa;
  for (const [name, text] of Object.entries(map)) {
    obj[NEW_KEYS[name]] = text;
  }
  obj[lHash(OLD.cta)] = map.cta;
  obj[lHash(OLD.priv)] = map.priv;
  obj[lHash(OLD.toast)] = map.toastOk;
  obj[lHash(OLD.long)] = map.long;
  fs.writeFileSync(p, JSON.stringify(obj, null, 0));
  return Object.keys(NEW).length;
}

function updateFaOverrides() {
  const p = path.join(ROOT, "data", "fa-key-overrides.json");
  if (!fs.existsSync(p)) return 0;
  const obj = JSON.parse(fs.readFileSync(p, "utf8"));
  const map = I18N_NEW.fa;
  let n = 0;
  for (const [name, text] of Object.entries(map)) {
    obj[NEW_KEYS[name]] = text;
    n++;
  }
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
  return n;
}

function main() {
  console.log("new i18n keys", NEW_KEYS);
  const files = fs
    .readdirSync(A_DIR)
    .filter((n) => /^[a-z-]+\.[a-f0-9]+\.js$/i.test(n) && !n.startsWith("fa."));
  let patched = 0;
  for (const name of files) {
    const lang = langOf(name);
    if (!lang) continue;
    const full = path.join(A_DIR, name);
    let js = fs.readFileSync(full, "utf8");
    const { js: next, changed } = patchLogic(js);
    js = upsertI18n(next, lang);
    if (!changed && js === next && next.includes("/api/feedback")) {
      console.log("skip", name);
      continue;
    }
    const { newName, htmlHits } = rehashAndRelink(lang, name, js);
    patched++;
    console.log("patched", name, "→", newName, `(html ${htmlHits})`);
  }

  const privN = patchPrivacy();
  const faN = updateFaJson();
  const ovN = updateFaOverrides();
  console.log(
    `done: bundles ${patched}, privacy ${privN}, fa json keys ${faN}, overrides ${ovN}`,
  );
  console.log("next: npm run build:fa  (rebuilds FA from patched EN)");
}

main();
