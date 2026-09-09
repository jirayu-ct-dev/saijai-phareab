import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
}));
const hasActiveMemberPackageMock = vi.hoisted(() => vi.fn());
const linkRichMenuToUserMock = vi.hoisted(() => vi.fn());
const getRichMenuForUserMock = vi.hoisted(() => vi.fn());

vi.mock("~~/server/utils/prisma", () => ({ prisma: prismaMock }));
vi.mock("~~/server/utils/auth", () => ({ hasActiveMemberPackage: hasActiveMemberPackageMock }));
vi.mock("~~/server/utils/line-messaging", () => ({
  linkRichMenuToUser: linkRichMenuToUserMock,
  getRichMenuForUser: getRichMenuForUserMock,
}));

const richMenuIds = {
  admin: "richmenu-admin",
  employee: "richmenu-employee",
  member: "richmenu-member",
  user: "richmenu-user",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LINE_RICHMENU_ADMIN_ID = richMenuIds.admin;
  process.env.LINE_RICHMENU_EMPLOYEE_ID = richMenuIds.employee;
  process.env.LINE_RICHMENU_MEMBER_ID = richMenuIds.member;
  process.env.LINE_RICHMENU_USER_ID = richMenuIds.user;
  prismaMock.user.findFirst.mockResolvedValue({
    id: "user-1",
    role: "EMPLOYEE",
    isActive: true,
    accounts: [{ accountId: "U1234567890" }],
  });
  hasActiveMemberPackageMock.mockResolvedValue(false);
  linkRichMenuToUserMock.mockResolvedValue({ status: 200 });
});

describe("LINE per-user Rich Menu synchronization", () => {
  it("does not report success when LINE accepts POST but GET shows no linked menu", async () => {
    getRichMenuForUserMock.mockResolvedValue({ status: 404, richMenuId: null });

    const { syncLineRichMenuForUser } = await import("../../server/utils/line-richmenu");
    const result = await syncLineRichMenuForUser("user-1");

    expect(linkRichMenuToUserMock).toHaveBeenCalledWith("U1234567890", richMenuIds.employee);
    expect(getRichMenuForUserMock).toHaveBeenCalledWith("U1234567890");
    expect(result).toMatchObject({ linked: false, menuKey: "employee", expectedRichMenuId: richMenuIds.employee });
  });

  it("reports success only when GET confirms the role menu", async () => {
    getRichMenuForUserMock.mockResolvedValue({ status: 200, richMenuId: richMenuIds.employee });

    const { syncLineRichMenuForUser } = await import("../../server/utils/line-richmenu");
    const result = await syncLineRichMenuForUser("user-1");

    expect(result).toMatchObject({ linked: true, menuKey: "employee", expectedRichMenuId: richMenuIds.employee });
  });

  it("selects the member menu only for an active member entitlement", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-1",
      role: "USER",
      isActive: true,
      accounts: [{ accountId: "U1234567890" }],
    });
    hasActiveMemberPackageMock.mockResolvedValue(true);
    getRichMenuForUserMock.mockResolvedValue({ status: 200, richMenuId: richMenuIds.member });

    const { syncLineRichMenuForUser } = await import("../../server/utils/line-richmenu");
    const result = await syncLineRichMenuForUser("user-1");

    expect(linkRichMenuToUserMock).toHaveBeenCalledWith("U1234567890", richMenuIds.member);
    expect(result).toMatchObject({ linked: true, menuKey: "member", expectedRichMenuId: richMenuIds.member });
  });
});
