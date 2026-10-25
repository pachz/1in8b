import { ensureTurso, sessionTtlMs, dayKey } from "./turso.mjs";

const ACTIVE_SCREENS = new Set(["life", "decide", "birth", "end", "home"]);

function str(v, max = 32) {
  if (v == null) return "";
  return String(v).slice(0, max);
}

function int(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/**
 * Ingest a client beacon and optionally return a live world snapshot.
 * @param {Record<string, unknown>} payload
 * @param {{ posts?: object[] }} [extras]
 */
export async function handleBeacon(payload, extras = {}) {
  const db = await ensureTurso();
  if (!db) {
    return { ok: true, stored: false };
  }

  const event = str(payload.e, 40);
  const sid = str(payload.s, 24) || "anon";
  const now = Date.now();
  const wantWorld = Boolean(payload.ww);

  try {
    if (event === "bye") {
      await db.execute({
        sql: "DELETE FROM sessions WHERE sid = ?",
        args: [sid],
      });
    } else if (event && event !== "err") {
      await upsertSession(db, payload, now);
    }

    if (event === "life_begin" || event === "life_start") {
      const country = str(payload.c || payload.k, 8) || "???";
      if (country && country !== "???") {
        await db.execute({
          sql: "INSERT INTO life_events (at, kind, country, age, sid) VALUES (?, 'b', ?, 0, ?)",
          args: [Math.floor(now / 1000), country, sid],
        });
      }
    }

    if (event === "life_end") {
      const country = str(payload.c, 8) || "???";
      const age = int(payload.a, 0);
      await db.execute({
        sql: "INSERT INTO life_events (at, kind, country, age, sid) VALUES (?, 'd', ?, ?, ?)",
        args: [Math.floor(now / 1000), country, age, sid],
      });
      await bumpToday(db, payload.tq);
    }

    if (event) {
      await bumpDaily(db, event, str(payload.k, 48));
    }

    // Opportunistic cleanup of stale sessions (cheap enough)
    if (wantWorld || event === "ping" || Math.random() < 0.05) {
      await db.execute({
        sql: "DELETE FROM sessions WHERE updated_at < ?",
        args: [now - sessionTtlMs()],
      });
    }
  } catch (err) {
    console.error("turso beacon write failed", err);
    if (!wantWorld) return { ok: true, stored: false };
  }

  if (!wantWorld) return { ok: true, stored: true };

  try {
    const world = await buildWorld(db, payload, extras);
    return world;
  } catch (err) {
    console.error("turso world read failed", err);
    return { ok: true, n: 0, lv: 0, home: 0, now: [], recent: [] };
  }
}

async function upsertSession(db, payload, now) {
  const sid = str(payload.s, 24);
  if (!sid) return;
  const screen = str(payload.w, 16) || "home";
  if (!ACTIVE_SCREENS.has(screen) && screen) {
    // still store unknown screens
  }
  await db.execute({
    sql: `INSERT INTO sessions (sid, screen, country, here, age, speed, era, auto, lang, src, device, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(sid) DO UPDATE SET
            screen=excluded.screen,
            country=excluded.country,
            here=excluded.here,
            age=excluded.age,
            speed=excluded.speed,
            era=excluded.era,
            auto=excluded.auto,
            lang=excluded.lang,
            src=excluded.src,
            device=excluded.device,
            updated_at=excluded.updated_at`,
    args: [
      sid,
      screen,
      str(payload.c, 8) || null,
      str(payload.k, 8) || null,
      payload.a == null ? null : int(payload.a),
      payload.sp == null ? null : Number(payload.sp) || null,
      str(payload.x, 4) || null,
      payload.au ? 1 : 0,
      str(payload.l, 8) || null,
      str(payload.src, 40) || null,
      str(payload.d, 16) || null,
      now,
    ],
  });
}

async function bumpDaily(db, event, key) {
  const day = dayKey();
  await db.execute({
    sql: `INSERT INTO daily_stats (day, event, key, n) VALUES (?, ?, ?, 1)
          ON CONFLICT(day, event, key) DO UPDATE SET n = n + 1`,
    args: [day, event, key || ""],
  });
}

async function bumpToday(db, tq) {
  // tdWire: `${y}${md}.${topic}.${m|f}` — client compares today.k to tq.slice(0, -2)
  if (!tq || typeof tq !== "string" || tq.length < 3) return;
  const k = tq.slice(0, -2);
  const which = tq.endsWith("m") ? "m" : "f";
  if (!k) return;
  await db.execute({
    sql: `INSERT INTO today_tallies (k, m, f) VALUES (?, ?, ?)
          ON CONFLICT(k) DO UPDATE SET ${which} = ${which} + 1`,
    args: [k, which === "m" ? 1 : 0, which === "f" ? 1 : 0],
  });
}

async function buildWorld(db, payload, extras) {
  const cutoff = Date.now() - sessionTtlMs();

  const [alive, byCountry, recent, birthStats, deathForMe, todayRow, postRows] =
    await Promise.all([
      db.execute({
        sql: `SELECT screen, COUNT(*) AS n FROM sessions WHERE updated_at >= ? GROUP BY screen`,
        args: [cutoff],
      }),
      db.execute({
        sql: `SELECT COALESCE(NULLIF(here, ''), country) AS iso, COUNT(*) AS n
              FROM sessions
              WHERE updated_at >= ? AND screen IN ('life', 'decide')
                AND COALESCE(NULLIF(here, ''), country) IS NOT NULL
              GROUP BY iso
              ORDER BY n DESC
              LIMIT 12`,
        args: [cutoff],
      }),
      db.execute({
        sql: `SELECT at, kind, country, age FROM life_events ORDER BY at DESC LIMIT 40`,
      }),
      db.execute({
        sql: `SELECT country, COUNT(*) AS n FROM life_events WHERE kind = 'b' GROUP BY country ORDER BY n DESC LIMIT 12`,
      }),
      payload.c
        ? db.execute({
            sql: `SELECT COUNT(*) AS n, AVG(age) AS avg_age FROM life_events WHERE kind = 'd' AND country = ?`,
            args: [str(payload.c, 8)],
          })
        : Promise.resolve({ rows: [] }),
      payload.tq
        ? db.execute({
            sql: `SELECT k, m, f FROM today_tallies WHERE k = ?`,
            args: [String(payload.tq).slice(0, -2)],
          })
        : Promise.resolve({ rows: [] }),
      extras.posts
        ? Promise.resolve({ rows: [] })
        : db.execute({
            sql: `SELECT id, at, iso, sex, age, name, story, rem FROM posts
                  WHERE lang = ? ORDER BY at DESC LIMIT 12`,
            args: [str(payload.l, 8) || "en"],
          }),
    ]);

  let home = 0;
  let life = 0;
  let total = 0;
  for (const row of alive.rows) {
    const n = Number(row.n) || 0;
    total += n;
    if (row.screen === "home") home += n;
    if (row.screen === "life" || row.screen === "decide") life += n;
  }

  const now = byCountry.rows
    .filter((r) => r.iso)
    .map((r) => [String(r.iso), Number(r.n) || 0]);

  const recentList = recent.rows.map((r) => [
    Number(r.at) || 0,
    String(r.kind) === "b" ? "b" : "d",
    String(r.country || ""),
    Number(r.age) || 0,
  ]);

  const top = birthStats.rows.map((r) => [
    String(r.country),
    Number(r.n) || 0,
  ]);
  const totalBirths = top.reduce((s, [, n]) => s + n, 0);

  let le = [];
  if (top.length) {
    const deathAges = await db.execute({
      sql: `SELECT country, COUNT(*) AS n, AVG(age) AS avg_age
            FROM life_events WHERE kind = 'd' AND country IN (${top
              .map(() => "?")
              .join(",")})
            GROUP BY country`,
      args: top.map(([c]) => c),
    });
    le = deathAges.rows.map((r) => [
      String(r.country),
      Number(r.n) || 0,
      Math.round(Number(r.avg_age) || 0),
    ]);
  }

  const meRow = deathForMe.rows[0];
  const me =
    payload.c && meRow && Number(meRow.n) > 0
      ? [
          str(payload.c, 8),
          Number(meRow.n) || 0,
          Math.round(Number(meRow.avg_age) || 0),
        ]
      : undefined;

  const td = todayRow.rows[0];
  const today = td
    ? { k: String(td.k), m: Number(td.m) || 0, f: Number(td.f) || 0 }
    : undefined;

  const posts =
    extras.posts ||
    postRows.rows.map((r) => ({
      id: Number(r.id),
      at: Number(r.at),
      iso: String(r.iso || ""),
      sex: String(r.sex || ""),
      age: Number(r.age) || 0,
      name: String(r.name || ""),
      story: String(r.story || ""),
      text: String(r.story || ""),
      rem: Number(r.rem) || 0,
    }));

  return {
    ok: true,
    n: total,
    lv: life,
    home,
    now,
    recent: recentList,
    tot: totalBirths
      ? { s: totalBirths, top, le }
      : undefined,
    me,
    today,
    posts,
  };
}

export async function listPosts(lang, limit = 40) {
  const db = await ensureTurso();
  if (!db) return null;
  const { rows } = await db.execute({
    sql: `SELECT id, at, iso, sex, age, name, story, rem FROM posts
          WHERE lang = ? ORDER BY at DESC LIMIT ?`,
    args: [lang, limit],
  });
  return rows.map((r) => ({
    id: Number(r.id),
    at: Number(r.at),
    iso: String(r.iso || ""),
    sex: String(r.sex || ""),
    age: Number(r.age) || 0,
    name: String(r.name || ""),
    story: String(r.story || ""),
    text: String(r.story || ""),
    rem: Number(r.rem) || 0,
  }));
}

export async function insertPost(post) {
  const db = await ensureTurso();
  if (!db) return false;
  await db.execute({
    sql: `INSERT INTO posts (id, lang, at, iso, sex, age, name, story, rem)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      post.id,
      post.lang,
      post.at,
      post.iso,
      post.sex,
      post.age,
      post.name,
      post.story,
      post.rem || 0,
    ],
  });
  return true;
}

/** One-time seed of community posts from the local JSON mirror. */
export async function seedPostsIfEmpty(seedPostsByLang) {
  const db = await ensureTurso();
  if (!db) return;
  const { rows } = await db.execute(
    "SELECT value FROM meta WHERE key = 'posts_seeded'",
  );
  if (rows.length) return;
  const count = await db.execute("SELECT COUNT(*) AS n FROM posts");
  if (Number(count.rows[0]?.n) > 0) {
    await db.execute({
      sql: "INSERT OR REPLACE INTO meta (key, value) VALUES ('posts_seeded', '1')",
      args: [],
    });
    return;
  }
  const stmts = [];
  for (const [lang, posts] of Object.entries(seedPostsByLang || {})) {
    for (const p of posts.slice(0, 40)) {
      stmts.push({
        sql: `INSERT OR IGNORE INTO posts (id, lang, at, iso, sex, age, name, story, rem)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          p.id,
          lang,
          p.at || Date.now(),
          p.iso || "?",
          p.sex || "?",
          p.age || 0,
          p.name || "",
          p.story || p.text || "",
          p.rem || 0,
        ],
      });
    }
  }
  if (stmts.length) {
    stmts.push({
      sql: "INSERT OR REPLACE INTO meta (key, value) VALUES ('posts_seeded', '1')",
      args: [],
    });
    await db.batch(stmts, "write");
  }
}
