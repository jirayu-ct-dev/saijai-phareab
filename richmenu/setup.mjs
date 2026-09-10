import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import sharp from "sharp";

const richMenuDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(richMenuDir, "..");

// Load shared defaults, then local target settings. Never print values.
dotenv.config({ path: path.join(projectDir, ".env") });
dotenv.config({ path: path.join(projectDir, ".env.local"), override: true });
dotenv.config({ path: path.join(richMenuDir, ".env.local"), override: true });

const accessToken = (
  process.env.RICHMENU_LINE_ACCESS_TOKEN?.trim() ||
  process.env.LINE_ACCESS_TOKEN?.trim() ||
  process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim()
);
const liffId = process.env.RICHMENU_LIFF_ID?.trim();
const databaseUrl = process.env.RICHMENU_DATABASE_URL?.trim();
const namePrefix = process.env.RICHMENU_NAME_PREFIX?.trim();

if (!accessToken) {
  throw new Error("Missing RICHMENU_LINE_ACCESS_TOKEN (or a LINE access-token variable)");
}
if (!liffId) {
  throw new Error("Missing RICHMENU_LIFF_ID; set the LIFF app for this LINE channel explicitly");
}

const api = "https://api.line.me";
const dataApi = "https://api-data.line.me";
const imageSize = { width: 2500, height: 1686 };
const definitions = [
  { key: "admin", json: "admin.json", image: "admin.png" },
  // There is no separate employee artwork yet; employee has its own menu ID and safe routes.
  { key: "employee", json: "employee.json", image: "admin.png" },
  { key: "member", json: "member.json", image: "member.png" },
  { key: "user", json: "user.json", image: "user.png" },
];

async function lineRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 200);
  }
  if (!response.ok) {
    throw new Error(`LINE API ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function listRichMenus() {
  return (await lineRequest(`${api}/v2/bot/richmenu/list`))?.richmenus ?? [];
}

async function hasRichMenuImage(richMenuId) {
  const response = await fetch(`${dataApi}/v2/bot/richmenu/${richMenuId}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 200) return true;
  if (response.status === 400 || response.status === 404) return false;
  throw new Error(`LINE image check ${response.status}`);
}

async function createOrReuseRichMenu(definition, existingMenus) {
  const metadata = JSON.parse(await fs.readFile(path.join(richMenuDir, "json", definition.json), "utf8"));
  metadata.name = namePrefix ? `${namePrefix}-${metadata.name}` : metadata.name;
  metadata.areas = metadata.areas.map((area) => {
    if (area.action?.type !== "uri" || typeof area.action.uri !== "string") return area;
    return {
      ...area,
      action: {
        ...area.action,
        uri: area.action.uri.replace(/^https:\/\/liff\.line\.me\/[^/]+/, `https://liff.line.me/${liffId}`),
      },
    };
  });

  const existing = existingMenus.find((menu) => (
    menu.name === metadata.name &&
    menu.selected === metadata.selected &&
    menu.chatBarText === metadata.chatBarText &&
    JSON.stringify(menu.size) === JSON.stringify(metadata.size) &&
    JSON.stringify(menu.areas) === JSON.stringify(metadata.areas)
  ));
  const richMenuId = existing?.richMenuId ?? (await lineRequest(`${api}/v2/bot/richmenu`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  })).richMenuId;

  if (!richMenuId) throw new Error(`LINE did not return an ID for ${definition.key}`);

  if (!existing || !(await hasRichMenuImage(richMenuId))) {
    const image = await sharp(path.join(richMenuDir, "image", definition.image))
      .resize(imageSize.width, imageSize.height, { fit: "cover" })
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();
    await lineRequest(`${dataApi}/v2/bot/richmenu/${richMenuId}/content`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: image,
    });
  }
  return { key: definition.key, richMenuId, reused: Boolean(existing) };
}

function memberIsActive(row) {
  return row.role === "USER" && row.member_status === "ACTIVE";
}

function menuKeyForUser(row) {
  if (row.role === "ADMIN") return "admin";
  if (row.role === "EMPLOYEE") return "employee";
  return memberIsActive(row) ? "member" : "user";
}

async function syncLinkedUsers(menuIds) {
  if (!databaseUrl) {
    console.log("RICHMENU_DATABASE_URL is not configured; skipped linked-user sync.");
    return { total: 0, linked: 0 };
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const { rows } = await pool.query(`
      SELECT
        u.role::text AS role,
        a."accountId" AS line_user_id,
        CASE WHEN EXISTS (
          SELECT 1 FROM "member_entitlement" me
          WHERE me."customerId" = u.id
            AND me.status = 'ACTIVE'
            AND me."deletedAt" IS NULL
            AND (me."startAt" IS NULL OR me."startAt" <= NOW())
            AND (me."endAt" IS NULL OR me."endAt" >= NOW())
        ) THEN 'ACTIVE' ELSE 'NONE' END AS member_status
      FROM "user" u
      JOIN "account" a ON a."userId" = u.id AND a."providerId" = 'line'
      WHERE u."deletedAt" IS NULL AND u."isActive" = true
    `);

    const counts = { admin: 0, employee: 0, member: 0, user: 0 };
    for (const row of rows) {
      const key = menuKeyForUser(row);
      await lineRequest(`${api}/v2/bot/user/${encodeURIComponent(row.line_user_id)}/richmenu/${menuIds[key]}`, {
        method: "POST",
      });
      counts[key] += 1;
    }
    return { total: rows.length, linked: counts };
  } finally {
    await pool.end();
  }
}

const menus = await listRichMenus();
const created = [];
for (const definition of definitions) {
  created.push(await createOrReuseRichMenu(definition, menus));
}

const menuIds = Object.fromEntries(created.map((item) => [item.key, item.richMenuId]));
await lineRequest(`${api}/v2/bot/user/all/richmenu/${menuIds.user}`, { method: "POST" });
const sync = await syncLinkedUsers(menuIds);

console.log(JSON.stringify({
  menus: created.map(({ key, richMenuId, reused }) => ({ key, richMenuId, reused })),
  default: "user",
  linkedUsers: sync,
}, null, 2));
