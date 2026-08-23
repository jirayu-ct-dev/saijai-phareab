import { describe, expect, it } from "vitest";
import { buildCsv } from "../../server/utils/csv";

describe("buildCsv formula-injection neutralization", () => {
  it("prefixes values that would be parsed as spreadsheet formulas", () => {
    const csv = buildCsv(
      ["name", "note"],
      [
        { name: "=SUM(A1:A9)", note: "+cmd|' /C calc'!A0" },
        { name: "-2+1", note: "@webservice(\"http://evil\")" },
      ],
    );
    expect(csv).toContain("'=SUM(A1:A9)");
    expect(csv).toContain("'+cmd|' /C calc'!A0");
    expect(csv).toContain("'-2+1");
    // The @-value contains quotes, so it is additionally CSV-quoted.
    expect(csv).toContain("\"'@webservice(\"\"http://evil\"\")\"");
  });

  it("leaves normal values untouched and still quotes commas/quotes", () => {
    const csv = buildCsv(["name", "note"], [{ name: "สมชาย", note: 'a,b "c"' }]);
    expect(csv).toContain("สมชาย");
    expect(csv).toContain('"a,b ""c"""');
  });

  it("does not alter negative-looking numbers inside longer text", () => {
    const csv = buildCsv(["note"], [{ note: "ราคา -100 บาท ลด 10%" }]);
    expect(csv).toContain("ราคา -100 บาท ลด 10%");
  });
});
