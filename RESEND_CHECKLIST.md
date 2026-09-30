# Resend Email Setup Checklist

## 🔑 Step 1: API Key
- [ ] Go to https://resend.com/dashboard/api-keys
- [ ] Click "Create API Key"
- [ ] Name: `GGuard`
- [ ] Permission: "Sending access"
- [ ] Copy the key: `re_xxxxxxxxx...`

## 🌐 Step 2: Domain Verification
- [ ] Go to https://resend.com/dashboard/domains
- [ ] Click "Add Domain"
- [ ] Enter: `notifications.ggaurdai.com`
- [ ] Select region: (closest to your users)
- [ ] Get DNS records from Resend:
  - [ ] SPF (TXT record)
  - [ ] DKIM (TXT records, typically 2-3)
  - [ ] MX (Mail exchange)

## 📝 Step 3: Add DNS Records
Go to your domain registrar (GoDaddy, Namecheap, Route 53, etc.)

- [ ] Add SPF TXT record: `v=spf1 include:resend.com ~all`
- [ ] Add DKIM TXT records (from Resend dashboard)
- [ ] Add MX record pointing to Resend
- [ ] Wait 15 min - 72 hours for DNS propagation

### Verify DNS records:
- [ ] Use https://dns.email/ to check if records are public
- [ ] SPF visible?
- [ ] DKIM visible?
- [ ] Resend should auto-verify when detected

## 🔐 Step 4: Configure Environment Variables

Create `.env.local` in your GGuard project root:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=GGuard Diagnostics <notifications@ggaurdai.com>
ADMIN_NOTIFICATION_EMAIL=your-admin-email@ggaurdai.com
```

**⚠️ Do NOT commit `.env.local` to git** (it's in .gitignore)

## 📧 Step 5: Test Email Sending

Option A: Send test from admin portal
1. Go to https://ggaurdai.com/admin (or dev: http://localhost:3000/admin)
2. Create a test assessment
3. Pay with test Stripe card: `4242 4242 4242 4242`
4. Check your email for "Payment confirmed"

Option B: Send test via Node.js REPL
```bash
cd gguard
node --env-file=.env.local
```
```javascript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
await resend.emails.send({
  from: process.env.EMAIL_FROM,
  to: 'your-email@example.com',
  subject: 'Test email',
  html: '<strong>It works!</strong>'
});
```

## 📊 Step 6: Monitor Delivery

- [ ] Check [Resend Dashboard](https://resend.com/dashboard/emails)
- [ ] Monitor delivery success rate
- [ ] Check spam score
- [ ] Add DMARC record for extra trust (optional but recommended)

## 🚀 Production Setup

When ready for live:
1. Create production API key
2. Update `RESEND_API_KEY` in Vercel dashboard
3. Replace test domain with production domain (if different)
4. Update `EMAIL_FROM` and `ADMIN_NOTIFICATION_EMAIL` in production
5. Monitor delivery metrics in Resend dashboard

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "API key not set" | Add `RESEND_API_KEY` to `.env.local` and restart dev server |
| Emails go to spam | Check DNS records with https://dns.email/, ensure SPF/DKIM/DMARC are correct |
| Domain verification stuck | Wait 72h or click "Restart verification" in Resend dashboard |
| Rate limit (429) | Resend allows 5 emails/second by default; request increase if needed |
| Email not received | Check admin dashboard → assess → check logs; verify recipient email is correct |

---

## 📚 Documentation
- Full guide: [RESEND_SETUP.md](./RESEND_SETUP.md)
- Resend docs: https://resend.com/docs
- Next.js guide: https://resend.com/docs/send-with-nextjs
- DNS tool: https://dns.email/
