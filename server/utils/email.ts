import { Resend } from "resend";

let client: Resend | null = null;

const getClient = (): Resend => {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw createError({ statusCode: 500, statusMessage: "RESEND_API_KEY is not configured" });
    }
    client = new Resend(apiKey);
  }
  return client;
};

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export const sendEmail = async (options: SendEmailOptions): Promise<void> => {
  const from = process.env.RESEND_FROM ?? "SaiJai Laundry <onboarding@resend.dev>";
  const { error } = await getClient().emails.send({ from, ...options });
  if (error) {
    throw createError({ statusCode: 502, statusMessage: `Email send failed: ${error.message}` });
  }
};

// User-controlled display names are interpolated into HTML email bodies;
// escape them so profile names cannot inject markup into transactional email.
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const renderResetPasswordEmail = (params: { name: string | null; url: string }): { subject: string; html: string; text: string } => {
  const displayName = escapeHtml(params.name?.trim() || "คุณลูกค้า");
  const subject = "รีเซ็ตรหัสผ่าน — SaiJai Laundry";
  const text = `สวัสดี ${displayName}\n\nคุณได้ขอรีเซ็ตรหัสผ่าน คลิกลิงก์นี้เพื่อตั้งรหัสผ่านใหม่:\n${params.url}\n\nลิงก์นี้จะหมดอายุใน 1 ชั่วโมง หากคุณไม่ได้ขอ สามารถละเว้นอีเมลนี้ได้`;
  const html = `<!doctype html>
<html lang="th"><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f6f7f9; padding:24px;">
  <div style="max-width:480px; margin:0 auto; background:#fff; border-radius:12px; padding:32px; border:1px solid #e5e7eb;">
    <h1 style="font-size:18px; margin:0 0 12px;">รีเซ็ตรหัสผ่าน</h1>
    <p style="color:#4b5563; line-height:1.6; margin:0 0 20px;">สวัสดี ${displayName} กรุณาคลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่</p>
    <p style="margin:0 0 24px;">
      <a href="${params.url}" style="display:inline-block; background:#0ea5e9; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600;">ตั้งรหัสผ่านใหม่</a>
    </p>
    <p style="color:#6b7280; font-size:12px; line-height:1.6; margin:0;">หากปุ่มใช้งานไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br/><span style="word-break:break-all;">${params.url}</span></p>
    <p style="color:#9ca3af; font-size:12px; margin:24px 0 0;">ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง หากคุณไม่ได้ขอ สามารถละเว้นอีเมลนี้ได้</p>
  </div>
</body></html>`;
  return { subject, html, text };
};

export const renderVerificationEmail = (params: { name: string | null; url: string }): { subject: string; html: string; text: string } => {
  const displayName = escapeHtml(params.name?.trim() || "คุณลูกค้า");
  const subject = "ยืนยันอีเมลของคุณ — SaiJai Laundry";
  const text = `สวัสดี ${displayName}\n\nกรุณาคลิกลิงก์นี้เพื่อยืนยันอีเมลของคุณ:\n${params.url}\n\nหากคุณไม่ได้ร้องขอ สามารถละเว้นอีเมลนี้ได้`;
  const html = `<!doctype html>
<html lang="th"><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f6f7f9; padding:24px;">
  <div style="max-width:480px; margin:0 auto; background:#fff; border-radius:12px; padding:32px; border:1px solid #e5e7eb;">
    <h1 style="font-size:18px; margin:0 0 12px;">ยืนยันอีเมลของคุณ</h1>
    <p style="color:#4b5563; line-height:1.6; margin:0 0 20px;">สวัสดี ${displayName} กรุณาคลิกปุ่มด้านล่างเพื่อยืนยันอีเมล</p>
    <p style="margin:0 0 24px;">
      <a href="${params.url}" style="display:inline-block; background:#0ea5e9; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600;">ยืนยันอีเมล</a>
    </p>
    <p style="color:#6b7280; font-size:12px; line-height:1.6; margin:0;">หากปุ่มใช้งานไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br/><span style="word-break:break-all;">${params.url}</span></p>
    <p style="color:#9ca3af; font-size:12px; margin:24px 0 0;">หากคุณไม่ได้ร้องขอ สามารถละเว้นอีเมลนี้ได้</p>
  </div>
</body></html>`;
  return { subject, html, text };
};
