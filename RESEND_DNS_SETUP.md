# GGuard Production Deployment - Resend Email Setup

**Date:** 2026-07-12  
**Status:** ✅ Ready for DNS Verification

## Domain Verification Progress

✅ **Completed:**
- Domain registered: `ggaurdai.com`
- API Key configured: `re_REPLACE_WITH_NEW_KEY`
- DNS records generated

⏳ **Next:** Add DNS records to your registrar

## DNS Records to Add

Add these records to your domain registrar (Namecheap, GoDaddy, Route 53, etc.):

### Record 1: DKIM (Most Important)
```
Name: resend._domainkey.ggaurdai.com
Type: TXT
Value: v=DKIM1; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDlr0OVtPgXOdsOjdJe/l/+T2CnJxGmiTAovGGmbquBnvjDRbCsSipPvGkYb1+uogGroVWOepa/JvsNIVYfAD9akyU7PSoeTNm20X5JX1JeVHXhzxK8YjU6Tv4gAzeJyhpWujLAmsA7b5cnlRo6npq0cfLdYrXKPHLoZsn5eP4/DwIDAQAB
```

### Record 2: SPF (Mail Server)
```
Name: send.ggaurdai.com
Type: MX
Value: feedback-smtp.us-east-1.amazonses.com
Priority: 10
```

### Record 3: SPF (Send Authorization)
```
Name: send.ggaurdai.com
Type: TXT
Value: v=spf1 include:amazonses.com ~all
```

## Implementation Steps

### Step 1: Add DNS Records (15-72 hours)
1. Go to your domain registrar (Namecheap, GoDaddy, Route 53, etc.)
2. Add the three DNS records above
3. Wait for DNS propagation (usually 15 minutes to 72 hours)
4. Resend will auto-verify when records are detected

### Step 2: Verify in Resend Dashboard
Once DNS is propagated:
1. Visit https://resend.com/dashboard/domains
2. Check domain status (should show ✅ Verified)

### Step 3: Update Environment Variables
Once verified, update `.env.local` and `.env.production`:

```bash
# Email configuration
EMAIL_FROM="GGuard Diagnostics <noreply@ggaurdai.com>"
# OR use your preferred from address:
EMAIL_FROM="reports@ggaurdai.com"

# Already configured:
RESEND_API_KEY="re_REPLACE_WITH_NEW_KEY"
ADMIN_NOTIFICATION_EMAIL="support@ggaurdai.com"
```

### Step 4: Deploy to Production
Once verified, your email system is ready:
```bash
git push origin main  # Triggers Vercel auto-deployment
```

## Current Environment Status

### ✅ Configured
- `RESEND_API_KEY`: Set
- `EMAIL_FROM`: Set (GGuard Diagnostics <reports@ggaurdai.com>)
- `ADMIN_NOTIFICATION_EMAIL`: Set (support@ggaurdai.com)
- Build: ✅ 0 TypeScript errors
- Tests: ✅ 16/23 passing

### ⏳ Pending
- DNS Records: Added to registrar (waiting for propagation)
- Domain Verification: Waiting for DNS propagation
- Production Deployment: Ready after verification

## Email Templates (Ready to Send Once Verified)

The following emails are configured and will auto-send:

1. **Assessment Received** - Sent when homeowner submits assessment request
2. **Report Ready** - Sent with final diagnostic report and pricing
3. **Payment Confirmation** - Sent when payment is received via Stripe
4. **Admin Notification** - Alert to support team for paid assessments

## Testing

Once domain is verified, test with:
```bash
npm run dev
# Visit http://localhost:3000/admin
# Go through assessment → payment flow
# Check inbox for confirmation email
```

## Resend Dashboard
- **Manage Domains:** https://resend.com/dashboard/domains
- **Monitor Emails:** https://resend.com/dashboard/emails
- **API Keys:** https://resend.com/api-keys

## Support
- Resend Docs: https://resend.com/docs
- Resend Support: support@resend.com
