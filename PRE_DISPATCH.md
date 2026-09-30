# GGuard Pre-Dispatch

An isolated, feature-flagged customer media intake vertical slice for garage door contractors. It adds a public sales page, local-only interactive demo, contractor onboarding, hosted intake, dependency-free iframe launcher, email notification, and tenant-scoped intake inbox. It does not modify SpringSight, homeowner, technician, billing, or assessment flows.

## Architecture and routes

- Public: `/pre-dispatch`, `/pre-dispatch/demo`
- Gated onboarding: `/pre-dispatch/get-started`
- Public-but-noindex intake: `/upload/[companySlug]`
- Authenticated inbox: `/portal/pre-dispatch`, `/portal/pre-dispatch/requests/[requestId]`
- Widget: `/widget/pre-dispatch.js`
- APIs: `/api/pre-dispatch/widget/sessions`, `/uploads`, `/requests`, `/companies`, `/portal/requests/*`

Neon owns all internal UUID defaults; the server also supplies cryptographically secure UUIDs so untrusted clients never choose company, customer, request, session, media, delivery, or audit IDs. Public references are random display codes only. The widget creates a 30-minute HMAC-signed session scoped to one company/session. Finalization checks every media row against both IDs and uses a company/session-scoped idempotency key. Portal access derives the authenticated user’s company membership and every request query includes `company_id`.

Media keys are private and isolated below `pre-dispatch/{company UUID}/{session UUID}/`. Production should use R2 direct presigned PUTs; this avoids proxying large videos through Vercel Functions. Vercel Blob’s existing proxy flow is not used as the recommended production path. When storage is absent outside production, a non-persistent mock endpoint supports UI development.

Before upload, JPG, PNG, and WebP photos are decoded, resized to a maximum 1920-pixel edge, and re-encoded as quality-0.78 WebP. This reduces transfer size and strips embedded EXIF/GPS metadata. The server still validates the compressed file's declared size, extension, MIME signature, stored byte count, and SHA-256 hash. HEIC is rejected when the browser cannot safely decode it. Arbitrary selected videos are currently size-gated rather than silently transcoded because dependable browser-side video codecs are not universal; production-grade video compression requires a native capture constraint or a dedicated transcoding worker.

Finalization uses one serializable Neon transaction to create/link the property, customer, request, verified media, finalized session, audit event, and initial outbox event. A database-backed worker claims events atomically and reclaims abandoned locks. It creates the distinct UUID maintenance record before AI processing, so AI failure cannot erase the intake record. When enabled and consented, the Vercel AI Gateway produces a schema-validated preliminary issue description and equipment observations for opener brand, estimated door width/height, and counterbalance system (`standard_torsion`, `reverse_wound_torsion`, `wayne_dalton_torquemaster`, `extension_springs`, `other`, or `unknown`). Every equipment value carries its own confidence and visible evidence; unsupported dimensions remain null. The AI contract prohibits parts, inventory, tools, repair instructions, pricing, and duration recommendations; the technician makes those decisions from the evidence and on-site inspection.

Email uses Resend when configured and records retryable pending/sent/failed state. Primary, forwarding/CRM, and additional recipients are supported. Generic CRM delivery sends request-created events independently of AI and sends analyzed or analysis-failed follow-ups. Contractor-configured HTTPS webhooks use public-destination validation, encrypted secrets, HMAC-SHA256 signatures, timestamp replay protection, versioned canonical events, idempotent delivery rows, bounded real retries, and response history. Native CRM adapters remain planned.

## Setup

1. Create a feature environment; never start with production flags enabled.
2. Set `DATABASE_URL`, Neon Auth variables, R2 variables, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`, random 32+ character signing/worker secrets, and the AI model.
3. Run `npm run db:migrate`. The schema statements are additive and idempotent.
4. Enable `PRE_DISPATCH_ENABLED`, then onboarding and submissions independently.
5. Sign in as an owner or administrator whose profile belongs to a contractor organization, visit `/pre-dispatch/get-started`, and configure at least one exact HTTPS website origin. Embedded mode fails closed when no origin is configured.
6. Test the widget with `/pre-dispatch-embed-example.html`, replacing the placeholder with the public widget key.

## Testing

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- For upload QA, use JPEG/PNG/WebP and MP4/QuickTime/WebM; verify image compression, metadata removal, count, size, retry, mobile camera/library, and an expired session.
- For email QA, omit Resend to inspect mocked delivery state, then use a verified Resend test recipient and confirm exactly one message after a repeated idempotent submission.
- Verify webhook signatures as lowercase hex HMAC-SHA256 over `${timestamp}.${rawBody}` and reject timestamps older than five minutes. Headers are `x-gguard-event-id`, `x-gguard-event-version`, `x-gguard-timestamp`, and `x-gguard-signature: sha256=...`.

## Security and privacy

Uploads require server declarations and signed session authorization, filenames are replaced server-side, paths are fixed, MIME/size/count checks run server-side, requests are rate limited, and a honeypot is present. Hosted/private pages are noindex. Media is never public by design. CSP permits framing only for `/upload/*`; all other existing routes retain frame denial. Analytics must never include PII; no new analytics provider was added.

Default retention is 90 days and can be configured to 30, 60, 90, 180, or 365 days. The worker expires abandoned sessions, removes one-day-old orphan uploads, deletes retained objects after the tenant policy, and purges old customer-link tokens. Production uploads fail closed unless a malware scanner confirms the object is clean. Consent/privacy language still requires legal review before commercial launch.

## Deployment checklist

1. Review and approve retention, limits, email sender, and product name.
2. Back up Neon; run the additive migration in preview, then production.
3. Configure secrets in Vercel (never in Git) and private R2 CORS for the production origin.
4. Keep submission/onboarding flags off; deploy and smoke-test existing routes plus sales/demo.
5. Enable onboarding for an internal contractor, verify tenant isolation and real email.
6. Enable submissions gradually; monitor notification failures, upload rejects, and audit events.

## Rollback

Set every `PRE_DISPATCH_*` flag to `false` for immediate rollback. This restores existing behavior without deleting data. Remove any navigation added later. After exporting/deleting private media according to policy, run `neon/rollback-pre-dispatch.sql` only if permanent schema removal is approved. Existing tables and routes are not touched by that rollback.

## Remaining external dependencies / extension points

- Production requires private direct R2/S3 storage and a compatible HTTPS malware-scanner service. Vercel Blob is deliberately rejected for Pre-Dispatch production verification because it proxies large files through a function.
- Browser-decodable videos are limited to 60 seconds and yield up to three compressed analysis frames. A dedicated transcoder is still recommended for codecs the customer browser cannot decode and for bitrate reduction of arbitrary library videos.
- Logo onboarding accepts an approved HTTPS URL rather than uploading a logo file.
- Generic signed webhooks and forwarding email provide CRM-neutral integration; vendor-specific OAuth adapters and SMS remain optional product extensions.
- Customer records are deliberately new per submission. No cross-company matching occurs; any future matching must use the existing company-scoped keyed phone/email indexes.
