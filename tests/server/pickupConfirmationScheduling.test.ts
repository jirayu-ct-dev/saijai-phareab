import { describe, expect, it } from "vitest";
import {
  computePickupNotificationSchedule,
  isInitialBeforeReminder,
  isPickupConfirmationEligible,
  parsePickupWallClock,
  pickupRetryAt,
  shouldSkipPickupReminder,
} from "../../server/utils/pickupConfirmationScheduling";

describe("pickup confirmation scheduling", () => {
  const defaults = {
    initialDaysBefore: 1,
    initialTime: "12:15",
    reminderEnabled: true,
    reminderDaysBefore: 0,
    reminderTime: "12:15",
    minimumLeadMinutes: 120,
  };

  it("uses Bangkok calendar days for the default initial notification", () => {
    const schedule = computePickupNotificationSchedule(
      new Date("2026-08-10T02:00:00.000Z"), // 09:00 Bangkok
      defaults,
      new Date("2026-08-08T00:00:00.000Z"),
    );

    expect(schedule.configuredInitialAt.toISOString()).toBe("2026-08-09T05:15:00.000Z");
  });

  it("schedules a late-created order for the next worker run", () => {
    const now = new Date("2026-08-09T06:00:00.000Z");
    const schedule = computePickupNotificationSchedule(new Date("2026-08-10T02:00:00.000Z"), defaults, now);

    expect(schedule.initialScheduledFor).toEqual(now);
  });

  it("moves a morning reminder before the minimum lead boundary", () => {
    const schedule = computePickupNotificationSchedule(
      new Date("2026-08-10T02:00:00.000Z"),
      defaults,
      new Date("2026-08-08T00:00:00.000Z"),
    );

    expect(schedule.configuredReminderAt.toISOString()).toBe("2026-08-10T05:15:00.000Z");
    expect(schedule.latestUsefulReminderAt.toISOString()).toBe("2026-08-10T00:00:00.000Z");
    expect(schedule.reminderScheduledFor?.toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });

  it("round-trips canonical edge wall-clock values and rejects non-canonical input", () => {
    expect(parsePickupWallClock("00:00")).toEqual({ hour: 0, minute: 0 });
    expect(parsePickupWallClock("12:15")).toEqual({ hour: 12, minute: 15 });
    expect(parsePickupWallClock("23:59")).toEqual({ hour: 23, minute: 59 });
    expect(parsePickupWallClock("9:5")).toBeNull();
    expect(parsePickupWallClock("24:00")).toBeNull();
    expect(parsePickupWallClock("12:15Z")).toBeNull();
  });

  it("requires the initial notification to be earlier than the reminder", () => {
    expect(isInitialBeforeReminder(defaults)).toBe(true);
    expect(isInitialBeforeReminder({ ...defaults, initialDaysBefore: 0 })).toBe(false);
  });

  it("skips reminders after a response or when no useful time remains", () => {
    const base = {
      reminderScheduledFor: new Date("2026-08-10T00:00:00.000Z"),
      initialSentAt: new Date("2026-08-09T05:15:00.000Z"),
      now: new Date("2026-08-09T06:00:00.000Z"),
      dueAt: new Date("2026-08-10T02:00:00.000Z"),
      hasResponse: false,
      orderStatus: "PROCESSING",
      confirmationStatus: "ACTIVE",
    };

    expect(shouldSkipPickupReminder(base)).toBe(false);
    expect(shouldSkipPickupReminder({ ...base, hasResponse: true })).toBe(true);
    expect(shouldSkipPickupReminder({ ...base, initialSentAt: base.reminderScheduledFor })).toBe(true);
  });

  it("uses the normalized delivery usage snapshot as an eligibility requirement", () => {
    const eligible = {
      deletedAt: null,
      status: "PROCESSING",
      hasDeliveryUsage: true,
      customerIsActive: true,
      customerDeletedAt: null,
      customerLineNotifyEnabled: true,
      customerHasLineAccount: true,
      pickupConfirmationEnabled: true,
    };

    expect(isPickupConfirmationEligible(eligible)).toBe(true);
    expect(isPickupConfirmationEligible({ ...eligible, hasDeliveryUsage: false })).toBe(false);
  });

  it("backs off failed delivery attempts with a cap", () => {
    const now = new Date("2026-08-09T00:00:00.000Z");
    expect(pickupRetryAt(now, 1).toISOString()).toBe("2026-08-09T00:05:00.000Z");
    expect(pickupRetryAt(now, 3).toISOString()).toBe("2026-08-09T00:20:00.000Z");
    expect(pickupRetryAt(now, 99).toISOString()).toBe("2026-08-09T01:00:00.000Z");
  });
});
