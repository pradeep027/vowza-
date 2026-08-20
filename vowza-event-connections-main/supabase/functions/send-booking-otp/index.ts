// ─── Supabase Edge Function: send-booking-otp ────────────────────────────────
// Sends the booking-start OTP via Gmail SMTP to the customer's registered email.
// Secrets required:
//   SMTP_USER=vowza.services@gmail.com
//   SMTP_PASSWORD=<Google App Password>
//
// Deploy:  supabase functions deploy send-booking-otp
// Secrets: supabase secrets set SMTP_USER=vowza.services@gmail.com SMTP_PASSWORD=xxxx

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const ALLOWED_ORIGINS = [
  Deno.env.get("SUPABASE_URL") || "",
  "https://vavfeataqwwbpjonknne.supabase.co",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { customerEmail, customerName, vendorName, serviceName, eventType, eventDate, eventTime, eventLocation, otp, bookingId } = await req.json();

    if (!customerEmail || !otp) {
      return json({ success: false, code: "MISSING_PARAMS", message: "Customer email and OTP are required." }, 400);
    }

    const smtpUser = Deno.env.get("SMTP_USER") || "vowza.services@gmail.com";
    const smtpPass = Deno.env.get("SMTP_PASSWORD");

    if (!smtpPass) {
      console.error("[send-booking-otp] SMTP_PASSWORD secret not configured");
      return json({ success: false, code: "SMTP_NOT_CONFIGURED", message: "Email service is not configured. Please contact Admin." }, 500);
    }

    // Build email HTML
    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #8B1538; font-size: 24px; margin: 0;">Vowza</h1>
          <p style="color: #6b7280; font-size: 12px; margin-top: 4px;">Event Services Marketplace</p>
        </div>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px;">
          <p style="color: #111827; font-size: 15px; margin: 0 0 16px;">Hello ${customerName || 'Customer'},</p>
          <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            Your Vowza service is ready to start. Please share the OTP below with your assigned vendor to authorize the service.
          </p>
          <div style="background: #fff; border: 2px solid #D4AF37; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 20px;">
            <p style="color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Your Start OTP</p>
            <p style="color: #8B1538; font-size: 32px; font-weight: 700; letter-spacing: 8px; margin: 0;">${otp}</p>
            <p style="color: #9ca3af; font-size: 11px; margin: 8px 0 0;">Expires in 10 minutes</p>
          </div>
          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin: 0 0 20px;">
            <p style="color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px; font-weight: 600;">Booking Details</p>
            ${vendorName ? `<p style="color: #374151; font-size: 13px; margin: 4px 0;"><strong>Artist:</strong> ${vendorName}</p>` : ''}
            ${serviceName ? `<p style="color: #374151; font-size: 13px; margin: 4px 0;"><strong>Service:</strong> ${serviceName}</p>` : ''}
            ${eventType ? `<p style="color: #374151; font-size: 13px; margin: 4px 0;"><strong>Event:</strong> ${eventType}</p>` : ''}
            ${eventDate ? `<p style="color: #374151; font-size: 13px; margin: 4px 0;"><strong>Date:</strong> ${eventDate}</p>` : ''}
            ${eventTime ? `<p style="color: #374151; font-size: 13px; margin: 4px 0;"><strong>Time:</strong> ${eventTime}</p>` : ''}
            ${eventLocation ? `<p style="color: #374151; font-size: 13px; margin: 4px 0;"><strong>Location:</strong> ${eventLocation}</p>` : ''}
          </div>
          <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px; margin: 0 0 16px;">
            <p style="color: #92400e; font-size: 12px; margin: 0; line-height: 1.5;">
              ⚠️ Only share this OTP with your assigned Vowza vendor. Do not share it with anyone else.
            </p>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            If you did not request this, please contact Vowza support at vowza.services@gmail.com
          </p>
        </div>
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 20px;">
          © Vowza • Hyderabad, India • vowza.services@gmail.com
        </p>
      </div>
    `;

    // Send via Gmail SMTP
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    await client.send({
      from: `Vowza <${smtpUser}>`,
      to: customerEmail,
      subject: "Vowza — Your Service Start OTP",
      html: htmlBody,
    });

    await client.close();

    console.log(`[send-booking-otp] Email sent to ${customerEmail} for booking ${bookingId}`);

    return json({ success: true, message: "OTP email sent successfully" }, 200);

  } catch (err: any) {
    console.error("[send-booking-otp] Error:", err.message || err);
    return json({
      success: false,
      code: "OTP_EMAIL_SEND_FAILED",
      message: "Unable to send OTP email. Please try again.",
    }, 500);
  }
});
