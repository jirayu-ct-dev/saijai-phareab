import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainLiffPrefix = "https://liff.line.me/2008353043-Z6ED4BLd/";
const richMenuRoles = ["admin", "employee", "member", "user"] as const;

describe("main LINE rich menu definitions", () => {
  it.each(richMenuRoles)("keeps %s actions inside the main LIFF app", (role) => {
    const definition = JSON.parse(readFileSync(`richmenu/json/${role}.json`, "utf8")) as {
      areas: Array<{ action?: { type?: string; uri?: string } }>;
    };
    const uriActions = definition.areas
      .map((area) => area.action?.uri)
      .filter((uri): uri is string => Boolean(uri));

    expect(uriActions.length).toBeGreaterThan(0);
    expect(uriActions.every((uri) => uri.startsWith(mainLiffPrefix))).toBe(true);
    expect(uriActions.some((uri) => uri.includes("2011430155-SqmA5vMF"))).toBe(false);
  });
});
