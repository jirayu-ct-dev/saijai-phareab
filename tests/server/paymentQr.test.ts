import { describe, expect, it } from "vitest";
import {
  InvalidAmountError,
  PROMPTPAY_AID,
  PromptPayEncodeError,
  PromptPayParseError,
  THB_CURRENCY_CODE,
  buildPromptPayPayload,
  crc16CcittFalse,
  decimalStringToMinor,
  extractPromptPayReceiver,
  minorToDecimalString,
  normalizePromptPayReceiver,
  parsePromptPayPayload,
  validatePromptPayPayload,
  verifyPayloadCrc,
} from "../../server/utils/paymentQr";

// ---------------------------------------------------------------------------
// Golden vectors
//
// Expected full payload strings below were constructed independently from the
// Thai QR Payment Standard / EMVCo Merchant-Presented Mode structure
// (tags 00/01/29/30/53/54/58/59/60, CRC-16/CCITT-FALSE with poly 0x1021,
// init 0xFFFF) using a separate reference implementation, then frozen here so
// the TypeScript encoder is verified against the spec rather than against
// itself.
// ---------------------------------------------------------------------------

const GOLDEN_VECTORS = [
  {
    // Mobile receiver 0899999999 (-> 0066899999999), reusable QR without amount.
    description: "mobile receiver, no amount (static)",
    input: { receiverType: "MOBILE" as const, receiverValue: "0899999999", amountMinor: null },
    expected:
      "00020101021129370016A0000006770101110113006689999999953037645802TH63042195",
  },
  {
    // Mobile receiver 0812345678 (-> 0066812345678), amount 0.01 (smallest satang).
    description: "mobile receiver, amount 0.01",
    input: { receiverType: "MOBILE" as const, receiverValue: "0812345678", amountMinor: 1 },
    expected:
      "00020101021229370016A00000067701011101130066812345678530376454040.015802TH6304A0E7",
  },
  {
    // National ID / tax ID receiver, integer amount 1234.00.
    description: "national ID receiver, integer amount 1234.00",
    input: {
      receiverType: "NATIONAL_OR_TAX_ID" as const,
      receiverValue: "1234567890123",
      amountMinor: 123400,
    },
    expected:
      "00020101021229370016A00000067701011102131234567890123530376454071234.005802TH63046884",
  },
  {
    // E-wallet receiver, large valid amount 999999.99.
    description: "e-wallet receiver, large amount 999999.99",
    input: {
      receiverType: "EWALLET" as const,
      receiverValue: "123456789012345",
      amountMinor: 99999999,
    },
    expected:
      "00020101021229390016A000000677010111031512345678901234553037645409999999.995802TH63047796",
  },
  {
    // Bill payment tag 30 with merchant name/city, amount 1234.56.
    description: "bill payment tag 30 with merchant name/city, amount 1234.56",
    input: {
      receiverType: "NATIONAL_OR_TAX_ID" as const,
      receiverValue: "1234567890123",
      amountMinor: 123456,
      merchantAccountTag: "30" as const,
      merchantName: "SAIJAI",
      merchantCity: "BANGKOK",
    },
    expected:
      "00020101021230370016A00000067701011102131234567890123530376454071234.565802TH5906SAIJAI6007BANGKOK63040DBD",
  },
] as const;

describe("CRC-16/CCITT-FALSE", () => {
  it("matches the well-known check value for '123456789' (0x29B1)", () => {
    expect(crc16CcittFalse("123456789")).toBe("29B1");
  });

  it("returns uppercase 4-hex-digit output", () => {
    const crc = crc16CcittFalse("000201010211");
    expect(crc).toMatch(/^[0-9A-F]{4}$/);
  });

  it("rejects non-ASCII input", () => {
    expect(() => crc16CcittFalse("สวัสดี")).toThrow();
  });
});

describe("exact amountMinor money boundary", () => {
  it("converts decimal strings with pure string math", () => {
    expect(decimalStringToMinor("0.01")).toBe(1);
    expect(decimalStringToMinor("1234")).toBe(123400);
    expect(decimalStringToMinor("1234.5")).toBe(123450);
    expect(decimalStringToMinor("1234.56")).toBe(123456);
    expect(decimalStringToMinor("999999.99")).toBe(99999999);
    expect(decimalStringToMinor("9999999999.99")).toBe(999999999999);
  });

  it("formats minor units back to a two-decimal decimal string", () => {
    expect(minorToDecimalString(1)).toBe("0.01");
    expect(minorToDecimalString(0)).toBe("0.00");
    expect(minorToDecimalString(123400)).toBe("1234.00");
    expect(minorToDecimalString(123456)).toBe("1234.56");
    expect(minorToDecimalString(99999999)).toBe("999999.99");
  });

  it("round-trips through exact integer minor units", () => {
    for (const value of ["0.01", "1.23", "1234.56", "999999.99", "9999999999.99"]) {
      expect(minorToDecimalString(decimalStringToMinor(value))).toBe(value);
    }
  });

  it("rejects zero amounts", () => {
    for (const value of ["0", "0.00", "0.0"]) {
      expect(() => decimalStringToMinor(value)).toThrow(InvalidAmountError);
    }
  });

  it("rejects negative amounts and signs", () => {
    for (const value of ["-1.00", "-0.01", "+1.00"]) {
      expect(() => decimalStringToMinor(value)).toThrow(InvalidAmountError);
    }
  });

  it("rejects NaN/Infinity and other non-numeric text", () => {
    for (const value of ["NaN", "Infinity", "-Infinity", "abc", "", "1,234.56", "1e3", " 1.00", "1.00 "]) {
      expect(() => decimalStringToMinor(value)).toThrow(InvalidAmountError);
    }
  });

  it("rejects more than two decimal places and malformed decimals", () => {
    for (const value of ["1.234", "0.005", "1234.567", ".5", "1."]) {
      expect(() => decimalStringToMinor(value)).toThrow(InvalidAmountError);
    }
  });

  it("rejects amounts beyond the safe integer range", () => {
    // 90071992547409.93 -> 9007199254740993 minor units > MAX_SAFE_INTEGER
    expect(() => decimalStringToMinor("90071992547409.93")).toThrow(InvalidAmountError);
  });

  it("rejects non-integer or negative minor units when formatting", () => {
    expect(() => minorToDecimalString(-1)).toThrow(InvalidAmountError);
    expect(() => minorToDecimalString(1.5)).toThrow(InvalidAmountError);
  });
});

describe("receiver normalization", () => {
  it("normalizes domestic mobile numbers to 0066XXXXXXXXX", () => {
    expect(normalizePromptPayReceiver("MOBILE", "0899999999")).toBe("0066899999999");
    expect(normalizePromptPayReceiver("MOBILE", "+66899999999")).toBe("0066899999999");
    expect(normalizePromptPayReceiver("MOBILE", "66899999999")).toBe("0066899999999");
  });

  it("keeps national/tax IDs and e-wallet IDs as digits", () => {
    expect(normalizePromptPayReceiver("NATIONAL_OR_TAX_ID", "1234567890123")).toBe("1234567890123");
    expect(normalizePromptPayReceiver("NATIONAL_OR_TAX_ID", "1-234567890123")).toBe("1234567890123");
    expect(normalizePromptPayReceiver("EWALLET", "123456789012345")).toBe("123456789012345");
  });

  it("rejects malformed receivers", () => {
    expect(() => normalizePromptPayReceiver("MOBILE", "12345")).toThrow(PromptPayEncodeError);
    expect(() => normalizePromptPayReceiver("MOBILE", "081234567")).toThrow(PromptPayEncodeError);
    expect(() => normalizePromptPayReceiver("MOBILE", "08123456780")).toThrow(PromptPayEncodeError);
    expect(() => normalizePromptPayReceiver("MOBILE", "081234567a")).toThrow(PromptPayEncodeError);
    expect(() => normalizePromptPayReceiver("NATIONAL_OR_TAX_ID", "123456789012")).toThrow(PromptPayEncodeError);
    expect(() => normalizePromptPayReceiver("NATIONAL_OR_TAX_ID", "12345678901234")).toThrow(PromptPayEncodeError);
    expect(() => normalizePromptPayReceiver("EWALLET", "12345678901234")).toThrow(PromptPayEncodeError);
  });
});

describe("Thai QR encoder golden vectors", () => {
  for (const vector of GOLDEN_VECTORS) {
    it(`encodes: ${vector.description}`, () => {
      expect(buildPromptPayPayload(vector.input)).toBe(vector.expected);
    });
  }

  it("uses point of initiation 11 without amount and 12 with amount", () => {
    expect(GOLDEN_VECTORS[0]?.expected.slice(6, 10)).toBe("0102");
    expect(GOLDEN_VECTORS[0]?.expected.slice(10, 12)).toBe("11");
    expect(GOLDEN_VECTORS[1]?.expected.slice(10, 12)).toBe("12");
  });

  it("encodes currency 764 (THB) and country TH in every vector", () => {
    for (const vector of GOLDEN_VECTORS) {
      expect(vector.expected).toContain(`5303${THB_CURRENCY_CODE}`);
      expect(vector.expected).toContain("5802TH");
    }
  });

  it("rejects zero, negative and non-integer amounts", () => {
    const input = { receiverType: "MOBILE" as const, receiverValue: "0899999999" };
    for (const amountMinor of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => buildPromptPayPayload({ ...input, amountMinor })).toThrow();
    }
  });

  it("rejects non-ASCII merchant fields", () => {
    expect(() =>
      buildPromptPayPayload({
        receiverType: "MOBILE",
        receiverValue: "0899999999",
        amountMinor: 100,
        merchantName: "สายไสว์",
      }),
    ).toThrow();
  });
});

describe("Thai QR parser (independent)", () => {
  it("round-trips every golden vector back to receiver type, amount and currency", () => {
    for (const vector of GOLDEN_VECTORS) {
      const parsed = parsePromptPayPayload(vector.expected);
      expect(parsed.payloadFormatIndicator).toBe("01");
      expect(parsed.currency).toBe(THB_CURRENCY_CODE);
      expect(parsed.countryCode).toBe("TH");
      expect(parsed.merchantAccount?.aid).toBe(PROMPTPAY_AID);
      const receiver = extractPromptPayReceiver(parsed.merchantAccount!);
      expect(receiver).not.toBeNull();
      const normalized = normalizePromptPayReceiver(
        vector.input.receiverType,
        vector.input.receiverValue,
      );
      expect(receiver!.receiverType).toBe(vector.input.receiverType);
      expect(receiver!.receiverValue).toBe(normalized);
      if (vector.input.amountMinor === null) {
        expect(parsed.amount).toBeNull();
        expect(parsed.pointOfInitiationMethod).toBe("11");
      } else {
        expect(decimalStringToMinor(parsed.amount!)).toBe(vector.input.amountMinor);
        expect(parsed.pointOfInitiationMethod).toBe("12");
      }
    }
  });

  it("exposes merchant name/city when present", () => {
    const vector = GOLDEN_VECTORS[4]!;
    const parsed = parsePromptPayPayload(vector.expected);
    expect(parsed.merchantName).toBe("SAIJAI");
    expect(parsed.merchantCity).toBe("BANGKOK");
    expect(parsed.merchantAccount?.tag).toBe("30");
  });

  it("preserves all top-level elements in order", () => {
    const parsed = parsePromptPayPayload(GOLDEN_VECTORS[1]!.expected);
    expect(parsed.elements.map((element) => element.tag)).toEqual([
      "00", "01", "29", "53", "54", "58", "63",
    ]);
  });

  it("parses a conforming payload it never generated (unknown extra tag tolerated)", () => {
    // Hand-built payload with a valid structure and an extra tag 62 (reserved).
    const payload =
      "00020101021129370016A00000067701011101130066899999999" +
      "53037645802TH6206A123456304" + crc16CcittFalse(
        "00020101021129370016A0000006770101110113006689999999953037645802TH6206A12345",
      );
    const parsed = parsePromptPayPayload(payload);
    expect(parsed.currency).toBe("764");
    expect(parsed.amount).toBeNull();
  });

  it("rejects malformed payloads", () => {
    const valid = GOLDEN_VECTORS[1]!.expected;
    expect(() => parsePromptPayPayload("")).toThrow(PromptPayParseError);
    expect(() => parsePromptPayPayload("00020")).toThrow(PromptPayParseError); // truncated
    expect(() => parsePromptPayPayload(`${valid}FF`)).toThrow(PromptPayParseError); // trailing junk
    expect(() => parsePromptPayPayload("000301")).toThrow(PromptPayParseError); // length overrun
    expect(() => parsePromptPayPayload("ZZ0201")).toThrow(PromptPayParseError); // bad tag
    expect(() => parsePromptPayPayload("00zz01")).toThrow(PromptPayParseError); // bad length
  });

  it("rejects duplicate top-level tags", () => {
    const duplicated =
      "000201000201" +
      crc16CcittFalse("000201000201");
    expect(() => parsePromptPayPayload(duplicated)).toThrow(PromptPayParseError);
  });
});

describe("Thai QR validator", () => {
  it("accepts every golden vector for its own receiver and amount", () => {
    for (const vector of GOLDEN_VECTORS) {
      const result = validatePromptPayPayload({
        payload: vector.expected,
        expectedReceiverType: vector.input.receiverType,
        expectedReceiverValue: vector.input.receiverValue,
        expectedAmountMinor: vector.input.amountMinor,
      });
      expect(result).toEqual({ valid: true, errors: [] });
    }
  });

  it("rejects a tampered amount", () => {
    const vector = GOLDEN_VECTORS[1]!;
    const tampered = vector.expected.replace("54040.01", "54040.05");
    const result = validatePromptPayPayload({
      payload: tampered,
      expectedReceiverType: vector.input.receiverType,
      expectedReceiverValue: vector.input.receiverValue,
      expectedAmountMinor: vector.input.amountMinor,
    });
    expect(result.valid).toBe(false);
    // Amount changed -> recomputed CRC no longer matches, amount mismatches.
    expect(result.errors).toContain("CRC_INVALID");
    expect(result.errors).toContain("AMOUNT_MISMATCH");
  });

  it("rejects a wrong CRC even when the structure is intact", () => {
    const vector = GOLDEN_VECTORS[2]!;
    const badCrc = `${vector.expected.slice(0, -4)}0000`;
    const result = validatePromptPayPayload({
      payload: badCrc,
      expectedReceiverType: vector.input.receiverType,
      expectedReceiverValue: vector.input.receiverValue,
      expectedAmountMinor: vector.input.amountMinor,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["CRC_INVALID"]);
  });

  it("rejects a different receiver", () => {
    const result = validatePromptPayPayload({
      payload: GOLDEN_VECTORS[1]!.expected,
      expectedReceiverType: "MOBILE",
      expectedReceiverValue: "0811111111",
      expectedAmountMinor: 1,
    });
    expect(result.errors).toContain("RECEIVER_MISMATCH");
  });

  it("rejects a receiver of the wrong type", () => {
    const result = validatePromptPayPayload({
      payload: GOLDEN_VECTORS[2]!.expected,
      expectedReceiverType: "EWALLET",
      expectedReceiverValue: "123456789012345",
      expectedAmountMinor: 123400,
    });
    expect(result.errors).toContain("RECEIVER_MISMATCH");
  });

  it("rejects a non-THB currency", () => {
    const vector = GOLDEN_VECTORS[1]!;
    const tampered = vector.expected.replace("5303764", "5303840");
    const result = validatePromptPayPayload({
      payload: tampered,
      expectedReceiverType: vector.input.receiverType,
      expectedReceiverValue: vector.input.receiverValue,
      expectedAmountMinor: vector.input.amountMinor,
    });
    expect(result.errors).toContain("CURRENCY_MISMATCH");
    expect(result.errors).toContain("CRC_INVALID");
  });

  it("rejects an unexpected amount on a static payload", () => {
    const vector = GOLDEN_VECTORS[0]!;
    const result = validatePromptPayPayload({
      payload: vector.expected,
      expectedReceiverType: vector.input.receiverType,
      expectedReceiverValue: vector.input.receiverValue,
      expectedAmountMinor: 1,
    });
    expect(result.errors).toContain("AMOUNT_MISSING");
  });

  it("rejects a mismatched AID", () => {
    const vector = GOLDEN_VECTORS[1]!;
    const tampered = vector.expected.replace(PROMPTPAY_AID, "A000000677010112");
    const result = validatePromptPayPayload({
      payload: tampered,
      expectedReceiverType: vector.input.receiverType,
      expectedReceiverValue: vector.input.receiverValue,
      expectedAmountMinor: vector.input.amountMinor,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("AID_MISMATCH");
  });

  it("rejects malformed payloads with a single error code", () => {
    const result = validatePromptPayPayload({
      payload: "not-a-payload",
      expectedReceiverType: "MOBILE",
      expectedReceiverValue: "0899999999",
      expectedAmountMinor: null,
    });
    expect(result).toEqual({ valid: false, errors: ["MALFORMED_PAYLOAD"] });
  });
});

describe("payload CRC verification helper", () => {
  it("accepts encoder output and rejects edits", () => {
    const payload = buildPromptPayPayload({
      receiverType: "MOBILE",
      receiverValue: "0812345678",
      amountMinor: 5500,
    });
    expect(verifyPayloadCrc(payload)).toBe(true);
    expect(verifyPayloadCrc(`${payload.slice(0, -1)}0`)).toBe(false);
    expect(verifyPayloadCrc("6304")).toBe(false);
  });
});
