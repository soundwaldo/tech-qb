# Resend Email Setup Guide for GGuard

## Quick Start (3 Steps)

### Step 1: Create API Key
1. Go to [resend.com/dashboard/api-keys](https://resend.com/dashboard/api-keys)
2. Click **Create API Key**
3. Name it: `GGuard`
4. Select permission: **Sending access**
5. Copy the key (you'll only see it once!)

### Step 2: Add & Verify Domain
1. Go to [resend.com/dashboard/domains](https://resend.com/dashboard/domains)
2. Click **Add Domain**
3. Enter subdomain: **`notifications.ggaurdai.com`** (or `noreply.ggaurdai.com`)
4. Select region closest to your users
5. Resend will generate DNS records:
   - **SPF** (TXT record)
   - **DKIM** (TXT records)
   - **MX** (Mail exchange record)

6. Add these records to your domain registrar (Namecheap, GoDaddy, Route 53, etc.):
   - Go to your DNS settings
   - Create new TXT records with SPF and DKIM values from Resend
   - Create MX record pointing to Resend
   - Wait 15 minutes to 72 hours for DNS propagation
   - Resend will auto-verify when records are detected

7. (Optional but recommended) Add DMARC record for extra security:
   ```
   v=DMARC1; p=quarantine; rua=mailto:your-email@ggaurdai.com
   ```

### Step 3: Configure Environment Variables
Create `.env.local` in your project root:

```bash
# Resend API Key (from Step 1)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx

# From address (use verified domain subdomain)
EMAIL_FROM=GGuard <notifications@ggaurdai.com>

# Admin notification email (for internal alerts)
ADMIN_NOTIFICATION_EMAIL=your-email@ggaurdai.com
```

**⚠️ Important:** Add `.env.local` to `.gitignore` to keep secrets safe.

---

## How It Works in GGuard

Your email library (`src/lib/email.ts`) is already configured:

- **sendAssessmentReceived** — Notify customer when assessment is received
- **sendReportReady** — Send final diagnostic report with fair price range
- **sendPaymentConfirmation** — Confirm payment received
- **sendPaidAssessmentToAdmin** — Alert admin to review new paid assessment

### Example: Sending Email from API

```typescript
import { sendReportReady } from '@/lib/email';

await sendReportReady({
  to: 'customer@example.com',
  assessmentId: '123-456-789',
  summary: 'Garage door off track - requires professional realignment',
  fairLow: 29900, // cents ($299)
  fairHigh: 45000, // cents ($450)
  publicId: 'verify-abc123',
  accessToken: 'tok_xyz789'
});
```

### Testing in Development

While `RESEND_API_KEY` is not set, emails will log to console:
```
[email:stub] report ready → customer@example.com
```

Once you add `RESEND_API_KEY`, all emails send automatically.

---

## Email Templates Used

All emails include:
- ✅ HTML formatting (responsive, mobile-friendly)
- ✅ Plain text fallback (auto-generated)
- ✅ Brand branding (GGuard logo, colors)
- ✅ Links with tracking (optional)
- ✅ HTML injection protection (XSS safe)

### From Address
- **Format:** `Display Name <verified-email@domain.com>`
- **Current:** `GGuard Diagnostics <reports@ggaurdai.com>`
- **Must match verified domain** — change `EMAIL_FROM` env var if needed

---

## Deliverability Checklist

- [ ] API key created and added to `.env.local`
- [ ] Domain verified in Resend dashboard
- [ ] SPF record added to DNS
- [ ] DKIM records added to DNS
- [ ] DNS records propagated (use [dns.email](https://dns.email/) to verify)
- [ ] DMARC record added (recommended)
- [ ] `EMAIL_FROM` env var matches verified domain
- [ ] Test with `sendAssessmentReceived()` from admin portal
- [ ] Check spam folder if email arrives there
- [ ] Monitor [Resend dashboard](https://resend.com/dashboard) for delivery stats

---

## Common Issues

### "API key not set" → Emails log to console only
**Fix:** Add `RESEND_API_KEY` to `.env.local` and restart dev server

### Emails going to spam folder
**Fix:** 
1. Verify all DNS records with [dns.email](https://dns.email/)
2. Add DMARC record
3. Check Resend dashboard for authentication errors

### Domain verification stuck
**Fix:**
1. Wait 72 hours for DNS propagation (use [dns.email](https://dns.email/) to check)
2. Click "Restart verification" in Resend dashboard
3. Ensure DNS records match exactly (no typos!)

### 429 Rate limit error
**Default limit:** 5 emails/second
**Fix:** Contact [Resend support](https://resend.com/contact) for increase

---

## Next Steps

1. ✅ Create API key (this session)
2. ✅ Verify domain (this session)
3. ✅ Add environment variables (this session)
4. **📧 Send test email** — Go to admin portal and create test assessment
5. **📊 Monitor** — Check [Resend dashboard](https://resend.com/dashboard/emails) for delivery stats
6. **🔧 Production** — Replace test API key with production key when live

---

## Resend Dashboard Links

- 🔐 **API Keys:** https://resend.com/dashboard/api-keys
- 🌐 **Domains:** https://resend.com/dashboard/domains
- 📧 **Emails:** https://resend.com/dashboard/emails (delivery stats)
- 🪝 **Webhooks:** https://resend.com/dashboard/webhooks
- 📊 **DNS Checker:** https://dns.email/

## Documentation

- **Full Resend Docs:** https://resend.com/docs
- **Next.js Guide:** https://resend.com/docs/send-with-nextjs
- **Email Templates:** https://resend.com/docs/templates
- **API Reference:** https://resend.com/api-reference

---

## Architecture

```
User submits assessment
         ↓
Stripe webhook confirms payment
         ↓
API calls sendPaidAssessmentToAdmin()
         ↓
email.ts → Resend SDK → Resend API
         ↓
Resend processes & sends via verified domain
         ↓
Customer inbox (or spam folder if auth fails)
```

**Note:** If `RESEND_API_KEY` is missing, emails stub log instead of failing.
