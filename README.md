# GGuard AI: Diagnostics & Pre-Dispatch

## Product separation

- `/`: neutral two-product selector.
- `/diagnostics`: expert-reviewed repair assessments for homeowners, HOAs, and property managers; assessment pricing and the existing `/upload` purchase flow.
- `/pre-dispatch`: contractor website intake widget; its own subscription pricing, onboarding, and `/portal/pre-dispatch` workspace.

These are distinct offers. Buying a diagnostic assessment does not activate a widget; a widget subscription does not include independent expert-reviewed reports. The shared property registry does not grant contractors access to another company's customer records.

## Current sales product

The contractor website widget collects customer details, photos, and short video before dispatch. The current offer is a controlled 30-day pilot, followed by **$149/month or $1,490/year** for one company brand. This is a widget subscription, not a purchase of diagnostic reports. Confirm matching Stripe prices before taking payment.

AI observations are preliminary and require technician verification. Native CRM integrations, SMS, and custom development are not included in the standard offer. Contact: clayton@ggaurdai.com.

**Release status:** Not yet cleared for production sales. See [Broker Launch Readiness](BROKER_LAUNCH_READINESS.md) for verified checks and unresolved release gates.

### Sales-product routes

- `/pre-dispatch`: offer and pricing
- `/pre-dispatch/demo`: sample-only demonstration
- `/pre-dispatch/get-started`: contractor onboarding
- `/portal/pre-dispatch`: contractor workspace
- `/portal/pre-dispatch/settings`: installation and billing settings
- `/broker`: authorized broker workspace
- `/widget/pre-dispatch.js`: embedded widget loader

### AI routing

Vercel AI Gateway remains primary. Azure OpenAI is an opt-in backup for transient service failures. It is **not provisioned or enabled yet**. See [Azure Backup Setup](docs/AZURE_AI_BACKUP.md).

### Local verification

```sh
npm run test:unit
npx playwright test --config playwright.domain.config.ts
npm run lint
npx tsc --noEmit
npm run build
```

The domain tests do not replace a real browser, payment, upload, delivery, and refund acceptance test.

## Diagnostics application

The following describes the separate assessment/HOA/property-manager product. These tiers are not the widget subscription offer and must not be used in widget sales materials. Presence of a page is not production launch clearance.

The **CARFAX for Home Maintenance** — neutral, human-in-the-loop garage door repair assessments.

## Vision

- **D2C (Homeowners):** "Don't get ripped off." We review contractor quotes and door photos/video, tell you what's actually wrong, provide fair cost estimates, and give you the exact questions to ask the tech.
- **B2B (HOAs & Property Managers):** "Portfolio Budget Protection." We validate every repair quote before you approve it, preventing contractor overbilling across hundreds of units.
- **The Moat:** Every assessment feeds into a central, verifiable registry. Homes build a documented maintenance history that increases resale value and satisfies HOA compliance audits.

## Tech Stack

- **Framework:** Next.js 16 (React, TypeScript, Tailwind CSS)
- **Database:** Neon Postgres
- **Auth/session:** App-managed session cookies
- **Storage:** Cloudflare R2 or AWS S3 (Private, Presigned URLs)
- **Payments:** Stripe (Checkout sessions, Webhooks)
- **Notifications:** Resend (Email)
- **Hosting:** Vercel

## Getting Started

1. **Clone and install**
   ```bash
   cd gguard
   npm install
   ```

2. **Set up Neon Postgres**
   - Create a Neon project
   - Run `neon/schema.sql`
   - Copy your connection string into `DATABASE_URL`

3. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Fill in your values
   ```

4. **Run dev server**
   ```bash
   npm run dev
   ```

5. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Dark-themed marketing landing with value proposition |
| `/upload` | D2C intake flow (4-step form) |
| `/portal` | B2B portal selector |
| `/portal/hoa` | HOA setup (annual billing) |
| `/portal/pm` | Property Manager setup (monthly billing) |
| `/admin` | Expert dashboard (admin only) |
| `/verify/[id]` | Public maintenance record verification |
| `/success` | Payment confirmation page |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/assessments` | POST | Create assessment record |
| `/api/checkout` | POST | Create Stripe checkout session |
| `/api/webhook/stripe` | POST | Handle Stripe webhooks |

## Legacy assessment pricing (not widget pricing)

| Tier | Price | SLA |
|------|-------|-----|
| Standard | $39 | 24 hours |
| Express | $79 | 2 hours |
| Comprehensive | $99 | 24 hours |

## HOA Plans (Annual)

| Plan | Price | Units | Extra Report |
|------|-------|-------|--------------|
| HOA Basic | $199/yr | 25 | $18 |
| HOA Premium | $399/yr | 75 | $15 |
| HOA Enterprise | $799/yr | 200 | $12 |

## Property Manager Plans (Monthly)

| Plan | Price | Properties | Extra Report |
|------|-------|------------|--------------|
| PM Starter | $149/mo | 10 | $16 |
| PM Professional | $299/mo | 30 | $14 |
| PM Enterprise | $599/mo | 100 | $12 |

## License and confidentiality

Proprietary and confidential. No license is granted except under a signed written agreement with the owner. See `LICENSE` and `NOTICE`.
