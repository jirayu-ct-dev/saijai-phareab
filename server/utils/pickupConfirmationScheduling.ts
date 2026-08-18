const BANGKOK_OFFSET_MINUTES = 7 * 60;
const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;

export const PICKUP_WALL_CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const PICKUP_MINIMUM_LEAD_OPTIONS = [30, 60, 120, 180, 360] as const;

export type PickupWallClock = {
  hour: number;
  minute: number;
};

export type PickupScheduleSettings = {
  initialDaysBefore: number;
  initialTime: string;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  reminderTime: string;
  minimumLeadMinutes: number;
};

export type PickupEligibilityInput = {
  deletedAt: Date | null;
  status: string;
  hasDeliveryUsage: boolean;
  customerIsActive: boolean;
  customerDeletedAt: Date | null;
  customerLineNotifyEnabled: boolean;
  customerHasLineAccount: boolean;
  pickupConfirmationEnabled: boolean;
};

export function parsePickupWallClock(value: string): PickupWallClock | null {
  const match = value.match(PICKUP_WALL_CLOCK_PATTERN);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function requirePickupWallClock(value: string): PickupWallClock {
  const parsed = parsePickupWallClock(value);
  if (!parsed) throw new RangeError(`Invalid pickup wall-clock time: ${value}`);
  return parsed;
}

function bangkokCalendarTime(dueAt: Date, daysBefore: number, wallClock: string): Date {
  const { hour, minute } = requirePickupWallClock(wallClock);
  const bangkokInstant = new Date(dueAt.getTime() + BANGKOK_OFFSET_MINUTES * MINUTE_MS);
  return new Date(
    Date.UTC(
      bangkokInstant.getUTCFullYear(),
      bangkokInstant.getUTCMonth(),
      bangkokInstant.getUTCDate() - daysBefore,
      hour,
      minute,
    ) - BANGKOK_OFFSET_MINUTES * MINUTE_MS,
  );
}

export function isInitialBeforeReminder(settings: Pick<
  PickupScheduleSettings,
  "initialDaysBefore" | "initialTime" | "reminderDaysBefore" | "reminderTime"
>): boolean {
  const initial = requirePickupWallClock(settings.initialTime);
  const reminder = requirePickupWallClock(settings.reminderTime);
  const initialRelativeMinute = -settings.initialDaysBefore * DAY_MINUTES + initial.hour * 60 + initial.minute;
  const reminderRelativeMinute = -settings.reminderDaysBefore * DAY_MINUTES + reminder.hour * 60 + reminder.minute;
  return initialRelativeMinute < reminderRelativeMinute;
}

export function computePickupNotificationSchedule(
  dueAt: Date,
  settings: PickupScheduleSettings,
  now: Date = new Date(),
) {
  const configuredInitialAt = bangkokCalendarTime(dueAt, settings.initialDaysBefore, settings.initialTime);
  const initialScheduledFor = configuredInitialAt < now && now < dueAt ? now : configuredInitialAt;
  const configuredReminderAt = bangkokCalendarTime(dueAt, settings.reminderDaysBefore, settings.reminderTime);
  const latestUsefulReminderAt = new Date(dueAt.getTime() - settings.minimumLeadMinutes * MINUTE_MS);
  const reminderScheduledFor = configuredReminderAt < latestUsefulReminderAt
    ? configuredReminderAt
    : latestUsefulReminderAt;

  return {
    configuredInitialAt,
    initialScheduledFor,
    configuredReminderAt,
    latestUsefulReminderAt,
    reminderScheduledFor: settings.reminderEnabled ? reminderScheduledFor : null,
  };
}

export function shouldSkipPickupReminder(input: {
  reminderScheduledFor: Date;
  initialSentAt: Date;
  now: Date;
  dueAt: Date;
  hasResponse: boolean;
  orderStatus: string;
  confirmationStatus: string;
}): boolean {
  return input.reminderScheduledFor <= input.initialSentAt
    || input.hasResponse
    || input.now >= input.dueAt
    || input.orderStatus === "COMPLETED"
    || input.orderStatus === "CANCELLED"
    || input.confirmationStatus !== "ACTIVE";
}

export function isPickupConfirmationEligible(input: PickupEligibilityInput): boolean {
  return input.pickupConfirmationEnabled
    && input.deletedAt === null
    && ["RECEIVED", "PROCESSING", "DELIVERING"].includes(input.status)
    && input.hasDeliveryUsage
    && input.customerIsActive
    && input.customerDeletedAt === null
    && input.customerLineNotifyEnabled
    && input.customerHasLineAccount;
}

export function pickupRetryAt(now: Date, attempts: number): Date {
  const delayMinutes = Math.min(60, 5 * 2 ** Math.max(0, attempts - 1));
  return new Date(now.getTime() + delayMinutes * MINUTE_MS);
}
