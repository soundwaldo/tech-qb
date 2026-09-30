import { Resend } from "resend";
import { formatCurrency, formatCurrencyRange } from "./utils";

function getResend(): Resend | null {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    return new Resend(key);
}

const FROM = process.env.EMAIL_FROM || "GGuard Diagnostics <reports@ggaurdai.com>";

async function sendWithResend(
    resend: Resend,
    params: { from: string; to: string | string[]; subject: string; html: string },
): Promise<void> {
    const response = await resend.emails.send(params);
    if (response.error) {
        throw new Error(`Resend rejected email: ${response.error.message}`);
    }
    if (!response.data?.id) {
        throw new Error("Resend accepted no email and returned no error");
    }
}

export async function sendAssessmentReceived(params: {
    to: string;
    assessmentId: string;
    tier: string;
    slaHours: number;
}): Promise<void> {
    const resend = getResend();
    const subject = `We received your GGuard assessment request`;
    const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
      <h1 style="color:#0f766e">Assessment received</h1>
      <p>Thanks for trusting GGuard. A human expert will review your media and quote.</p>
      <ul>
        <li><strong>Reference:</strong> ${params.assessmentId.slice(0, 8).toUpperCase()}</li>
        <li><strong>Tier:</strong> ${params.tier}</li>
        <li><strong>Expected turnaround:</strong> within ${params.slaHours} hour(s)</li>
      </ul>
      <p>You'll get another email when your report is ready.</p>
      <p style="color:#64748b;font-size:12px">GGuard Diagnostics · Neutral. Verified. Unbiased.</p>
    </div>
  `;

    if (!resend) {
        console.log("[email:stub] assessment received →", params.to, subject);
        return;
    }

    await sendWithResend(resend, { from: FROM, to: params.to, subject, html });
}

export async function sendReportReady(params: {
    to: string;
    assessmentId: string;
    summary: string;
    fairLow: number;
    fairHigh: number;
    publicId?: string;
    accessToken: string;
}): Promise<void> {
    const resend = getResend();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ggaurdai.com";
    const subject = `Your GGuard assessment is ready`;
    const verifyLink = params.publicId
        ? `${appUrl}/verify/${params.publicId}`
        : null;

    const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
      <h1 style="color:#0f766e">Your report is ready</h1>
      <p><strong>Summary:</strong> ${params.summary}</p>
      <p><strong>Fair price range:</strong> ${formatCurrencyRange(params.fairLow, params.fairHigh)}</p>
      <p><a href="${appUrl}/report/${params.assessmentId}?access=${encodeURIComponent(params.accessToken)}" style="background:#0f766e;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">View full report</a></p>
      ${verifyLink
            ? `<p style="margin-top:24px;font-size:13px;color:#64748b">A verifiable maintenance record was added to the registry:<br/><a href="${verifyLink}">${verifyLink}</a></p>`
            : ""
        }
      <p style="color:#64748b;font-size:12px">GGuard Diagnostics · The CARFAX for Home Maintenance</p>
    </div>
  `;

    if (!resend) {
        console.log("[email:stub] report ready →", params.to, subject);
        return;
    }

    await sendWithResend(resend, { from: FROM, to: params.to, subject, html });
}

export async function sendPaymentConfirmation(params: {
    to: string;
    amountCents: number;
    tier: string;
}): Promise<void> {
    const resend = getResend();
    const subject = `Payment confirmed — ${formatCurrency(params.amountCents)}`;
    const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
      <h1 style="color:#0f766e">Payment confirmed</h1>
      <p>We received ${formatCurrency(params.amountCents)} for your <strong>${params.tier}</strong> assessment.</p>
      <p>Our experts are on it.</p>
    </div>
  `;

    if (!resend) {
        console.log("[email:stub] payment →", params.to, subject);
        return;
    }

    await sendWithResend(resend, { from: FROM, to: params.to, subject, html });
}

export async function sendRecordAccessEmail(params: {
    to: string;
    records: Array<{ assessmentId: string; accessToken: string }>;
}): Promise<void> {
    const resend = getResend();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://ggaurdai.com").replace(/\/$/, "");
    const subject = "Your private GGuard record links";
    const links = params.records.map((record, index) => {
        const url = `${appUrl}/report/${encodeURIComponent(record.assessmentId)}?access=${encodeURIComponent(record.accessToken)}`;
        return `<li style="margin:12px 0"><a href="${url}">Open record ${index + 1}</a></li>`;
    }).join("");
    const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto"><h1 style="color:#0f766e">Your GGuard records</h1><p>Someone requested private record access for this email address. Use the links below to open completed reports:</p><ol>${links}</ol><p style="color:#64748b;font-size:12px">If you did not request this message, you can ignore it. Do not forward these private links.</p></div>`;

    if (!resend) {
        console.log("[email:stub] record access requested for matching email");
        return;
    }
    await sendWithResend(resend, { from: FROM, to: params.to, subject, html });
}

export async function sendPaidAssessmentToAdmin(params: {
    assessmentId: string;
    customerEmail: string;
    propertyLabel?: string | null;
    customerType: string;
    tier: string;
}): Promise<void> {
    const resend = getResend();
    const to = process.env.ADMIN_NOTIFICATION_EMAIL;
    if (!to) {
        console.warn("[email] ADMIN_NOTIFICATION_EMAIL is not configured");
        return;
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ggaurdai.com";
    const subject = `Paid assessment ready for review · ${params.assessmentId.slice(0, 8).toUpperCase()}`;
    const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto"><h1 style="color:#0f766e">New paid assessment</h1><p>A ${escapeHtml(params.customerType)} customer completed payment and their compressed evidence is ready in your secure admin queue.</p><ul><li><strong>Reference:</strong> ${params.assessmentId.slice(0, 8).toUpperCase()}</li><li><strong>Property reference:</strong> ${escapeHtml(params.propertyLabel || "Not provided")}</li><li><strong>Customer email:</strong> ${escapeHtml(params.customerEmail)}</li><li><strong>Tier:</strong> ${escapeHtml(params.tier)}</li></ul><p><a href="${appUrl}/admin/${params.assessmentId}" style="background:#0f766e;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Open secure review</a></p></div>`;
    if (!resend) { console.log("[email:stub] admin assessment →", to, subject); return; }
    await sendWithResend(resend, { from: FROM, to, subject, html });
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

/**
 * Send multiple emails in a single batch request (more efficient than individual sends)
 * Useful for: HOA notifications, contractor alerts, bulk digest emails
 */
export async function sendBatchEmails(emails: Array<{
    to: string | string[];
    subject: string;
    html: string;
    replyTo?: string;
}>): Promise<{ success: number; errors: { email: string; error: string }[] }> {
    const resend = getResend();
    const results = { success: 0, errors: [] as { email: string; error: string }[] };

    if (!resend) {
        console.log(`[email:stub] batch send → ${emails.length} emails`);
        return { success: emails.length, errors: [] };
    }

    try {
        const response = await resend.batch.send(
            emails.map((email) => ({
                from: FROM,
                to: email.to,
                subject: email.subject,
                html: email.html,
                replyTo: email.replyTo,
            }))
        );

        if (response.error) {
            console.error("[email:batch] Error:", response.error);
            results.errors.push({
                email: "batch",
                error: response.error.message || "Batch send failed",
            });
        } else if (response.data) {
            results.success = response.data.length;
        }
    } catch (error) {
        console.error("[email:batch] Exception:", error);
        results.errors.push({
            email: "batch",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }

    return results;
}

/**
 * List all sent emails with optional filtering
 * Useful for: admin dashboard delivery stats, troubleshooting failures, compliance audit
 */
export async function listEmails(options?: {
    limit?: number;
    from?: string;
    to?: string;
}): Promise<{
    emails: Array<{
        id: string;
        from: string;
        to: string[] | string;
        subject: string;
        createdAt: string;
        status: string;
        error?: string;
    }>;
    error?: string;
}> {
    const resend = getResend();

    if (!resend) {
        console.log("[email:stub] list emails");
        return { emails: [], error: "Resend API key not configured" };
    }

    try {
        const response = await resend.emails.list({
            limit: options?.limit || 50,
        });

        if (response.error) {
            console.error("[email:list] Error:", response.error);
            return {
                emails: [],
                error: response.error.message || "Failed to list emails",
            };
        }

        type ResendEmail = {
            id: string;
            from: string;
            to: string[] | string;
        subject: string;
        created_at: string;
        last_event: string;
        error?: { message?: string };
        };

        const emailList = Array.isArray(response.data)
            ? (response.data as ResendEmail[])
            : ((response as { data?: { data?: ResendEmail[] } }).data?.data || []);

        const emails = emailList
            .filter((email) => {
                if (options?.from && email.from !== options.from) return false;
                if (options?.to) {
                    const recipients = Array.isArray(email.to) ? email.to : [email.to];
                    if (!recipients.includes(options.to)) return false;
                }
                return true;
            })
            .map((email) => ({
                id: email.id,
                from: email.from,
                to: email.to,
                subject: email.subject,
                createdAt: email.created_at,
                status: email.last_event,
                error: email.error?.message,
            }));

        return { emails };
    } catch (error) {
        console.error("[email:list] Exception:", error);
        return {
            emails: [],
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
