(() => {
  const KEEP_KEY = "one8b.keep.v1";
  const KEEP_DV_KEY = "one8b.kdv.v1";
  const AUTH_KEY = "one8b.auth.v1";

  const copy = window.__LOGIN_COPY__ || {};
  const homeHref = copy.homeHref || "/";

  const $ = (id) => document.getElementById(id);
  const msg = $("msg");
  const identInput = $("ident");
  const codeInput = $("code");
  const startPanel = $("startPanel");
  const codePanel = $("codePanel");
  const donePanel = $("donePanel");
  const identLabel = $("identLabel");
  let channel = "phone";
  let challengeId = "";
  let busy = false;

  function setMsg(text, kind) {
    if (!msg) return;
    msg.textContent = text || "";
    msg.classList.toggle("bad", kind === "bad");
    msg.classList.toggle("ok", kind === "ok");
  }

  function whyText(why) {
    const map = copy.why || {};
    return map[why] || map.busy || copy.error || "Something went wrong.";
  }

  function keepDv() {
    let e = null;
    try {
      e = localStorage.getItem(KEEP_DV_KEY);
    } catch {
      /* ignore */
    }
    if (!/^[0-9a-f]{16}$/.test(e || "")) {
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      e = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
      try {
        localStorage.setItem(KEEP_DV_KEY, e);
      } catch {
        /* ignore */
      }
    }
    return e;
  }

  function keepPut(patch) {
    let cur = {};
    try {
      cur = JSON.parse(localStorage.getItem(KEEP_KEY) || "{}") || {};
    } catch {
      cur = {};
    }
    const next = Object.assign({}, cur, patch, { at: Date.now() });
    try {
      localStorage.setItem(KEEP_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function authPut(session) {
    try {
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({ session, at: Date.now() }),
      );
    } catch {
      /* ignore */
    }
  }

  async function post(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    return res.json();
  }

  function setChannel(next) {
    channel = next;
    document.querySelectorAll(".seg button").forEach((btn) => {
      btn.setAttribute(
        "aria-pressed",
        btn.dataset.channel === channel ? "true" : "false",
      );
    });
    if (identLabel) {
      identLabel.textContent =
        channel === "phone" ? copy.phoneLabel : copy.emailLabel;
    }
    if (identInput) {
      identInput.type = channel === "phone" ? "tel" : "email";
      identInput.inputMode = channel === "phone" ? "tel" : "email";
      identInput.autocomplete = channel === "phone" ? "tel" : "email";
      identInput.placeholder =
        channel === "phone" ? copy.phonePlaceholder : copy.emailPlaceholder;
      identInput.value = "";
    }
    setMsg("");
  }

  function showPanel(name) {
    [startPanel, codePanel, donePanel].forEach((el) => {
      if (el) el.classList.toggle("on", el.id === name);
    });
  }

  async function onStart(ev) {
    ev.preventDefault();
    if (busy) return;
    const raw = (identInput?.value || "").trim();
    if (!raw) {
      setMsg(whyText(channel === "phone" ? "phone" : "email"), "bad");
      return;
    }
    busy = true;
    setMsg(copy.sending || "…");
    try {
      const body =
        channel === "phone"
          ? { channel: "phone", phone: raw }
          : { channel: "email", email: raw };
      const data = await post("/api/auth/start", body);
      if (!data.ok) {
        setMsg(whyText(data.why), "bad");
        return;
      }
      challengeId = data.challengeId;
      if (data.devCode && codeInput) codeInput.value = data.devCode;
      showPanel("codePanel");
      setMsg(copy.codeSent || "", "ok");
      codeInput?.focus();
    } catch {
      setMsg(whyText("net"), "bad");
    } finally {
      busy = false;
    }
  }

  async function onVerify(ev) {
    ev.preventDefault();
    if (busy) return;
    const code = (codeInput?.value || "").replace(/\D/g, "");
    if (code.length !== 5) {
      setMsg(whyText("code"), "bad");
      return;
    }
    busy = true;
    setMsg(copy.verifying || "…");
    try {
      const data = await post("/api/auth/verify", {
        challengeId,
        code,
        dv: keepDv(),
      });
      if (!data.ok) {
        setMsg(whyText(data.why), "bad");
        return;
      }
      authPut(data.session);
      keepPut({ tok: data.tok, left: data.left, ml: 0 });
      showPanel("donePanel");
      setMsg(copy.done || "", "ok");
    } catch {
      setMsg(whyText("net"), "bad");
    } finally {
      busy = false;
    }
  }

  document.querySelectorAll(".seg button").forEach((btn) => {
    btn.addEventListener("click", () => setChannel(btn.dataset.channel));
  });
  $("startForm")?.addEventListener("submit", onStart);
  $("codeForm")?.addEventListener("submit", onVerify);
  $("backBtn")?.addEventListener("click", () => {
    challengeId = "";
    if (codeInput) codeInput.value = "";
    showPanel("startPanel");
    setMsg("");
  });
  $("homeBtn")?.addEventListener("click", () => {
    location.href = homeHref;
  });

  setChannel(copy.defaultChannel || "phone");
  showPanel("startPanel");
})();
