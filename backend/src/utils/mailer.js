import { Resend } from "resend";
import { ENV } from "../config/env.js";
import ApiError from "./ApiError.js";

// Resend SDK — https://resend.com/docs/send-with-nodejs
const resend = new Resend(ENV.RESEND_API_KEY);

export const OTP_EXPIRY_MINUTES = 10;

// Branded HTML body matching the app's teal design language
const buildOtpEmailHtml = ({ name, otp }) => `
  <div style="margin:0;padding:32px 16px;background:#f5f9f8;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid rgba(13,42,37,0.07);">
      <div style="background:linear-gradient(135deg,#14b8a6 0%,#0d9488 50%,#0f766e 100%);padding:28px 32px;">
        <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em;">Invoice Tracker</span>
      </div>
      <div style="padding:32px;">
        <h1 style="margin:0 0 8px;font-size:22px;color:#0c1a17;letter-spacing:-0.02em;">Verify your email</h1>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5c7570;">
          Hi ${name}, use the code below to verify your email address.
          It expires in ${OTP_EXPIRY_MINUTES} minutes.
        </p>
        <div style="text-align:center;margin:0 0 24px;">
          <span style="display:inline-block;padding:14px 28px;border-radius:16px;background:#f2f8f6;border:1px solid rgba(13,148,136,0.3);font-size:32px;font-weight:700;letter-spacing:10px;color:#0f766e;font-variant-numeric:tabular-nums;">${otp}</span>
        </div>
        <p style="margin:0;font-size:12px;line-height:1.6;color:#5c7570;">
          If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
      <div style="padding:16px 32px;border-top:1px solid rgba(13,42,37,0.07);">
        <p style="margin:0;font-size:11px;color:#5c7570;">
          Invoice Tracker · Beautiful invoices, client tracking, and AI-powered insights.
        </p>
      </div>
    </div>
  </div>
`;

export const sendOtpEmail = async ({ to, name, otp }) => {
  const { data, error } = await resend.emails.send({
    from: ENV.EMAIL_FROM,
    to: [to],
    subject: `Your verification code: ${otp}`,
    html: buildOtpEmailHtml({ name, otp }),
    text: `Hi ${name}, your Invoice Tracker verification code is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
  });

  if (error) {
    console.error("Resend email error:", error);
    throw ApiError.internal(
      "Could not send the verification email. Please try again.",
      "EMAIL_SEND_FAILED",
    );
  }

  return data;
};
