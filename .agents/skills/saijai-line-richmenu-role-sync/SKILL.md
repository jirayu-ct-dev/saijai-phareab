---
name: saijai-line-richmenu-role-sync
description: Maintain Saijai Phareab LINE Rich Menus for main and exam channels without mixing LIFF IDs, tokens, databases, or role routes.
metadata:
  short-description: Saijai LINE Rich Menu channel and role safety
---

# Saijai LINE Rich Menu channel and role safety

Use this skill for Rich Menu changes in this repository, especially when working on `main`, `exam-v1`, LINE role menus, Vercel environment variables, or the provisioning script.

## Verified channel map

The current verified LIFF IDs are:

- `main` / Saijai production: `2008353043-Z6ED4BLd`
- `exam-v1` / exam channel: `2011430155-SqmA5vMF`

These values are not interchangeable. Re-verify them in the relevant LINE Developers channel before a future provisioning or deployment change. The channel access token must come from that same channel.

The four role keys are mapped as follows:

- `ADMIN` → `admin`
- `EMPLOYEE` → `employee`
- active `USER` entitlement → `member`
- other `USER` → `user`

`LINE_RICHMENU_ADMIN_ID`, `LINE_RICHMENU_EMPLOYEE_ID`, `LINE_RICHMENU_MEMBER_ID`, and `LINE_RICHMENU_USER_ID` are channel-specific deployment variables. Never copy their values between main and exam.

## Repository workflow

- Main definitions: `richmenu/json/*.json` must use the main LIFF prefix.
- Exam definitions: the same role keys on `exam-v1` must use the exam LIFF prefix.
- Provisioning: run `node richmenu/setup.mjs` only with explicit `RICHMENU_LINE_ACCESS_TOKEN` and `RICHMENU_LIFF_ID` for the intended channel; use `RICHMENU_NAME_PREFIX` to avoid confusing assets across channels.
- Bulk linking: set `RICHMENU_DATABASE_URL` only to the matching target database. The script intentionally skips bulk linking when it is absent.
- Runtime sync: `server/utils/line-richmenu.ts` chooses the menu from the authenticated role and active entitlement, then verifies LINE's reported per-user assignment. Role/entitlement changes and login/session refreshes must trigger this path.

## Safe checks

Before external writes, inspect the branch and run a JSON assertion that every URI starts with the target prefix and contains no foreign prefix. After provisioning, read back all four menus and the default menu with the target channel token. Keep old menus until the replacement is verified; per-user links can continue to override the default menu until the application relinks or unlinks that user.

Never print secrets or use the local `.env` database as a substitute for the production target. If the requested target is ambiguous, stop before a LINE/Vercel mutation and resolve the channel, LIFF ID, and database explicitly.
