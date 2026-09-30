# Azure AI backup activation

Status: code integrated; resource not provisioned; no live failover test or deployment completed.

## Routing

Vercel AI Gateway is primary for Pre-Dispatch analysis, diagnostic drafts, and invoice extraction. Azure OpenAI receives the same evidence only when the primary fails with a timeout, network failure, rate limit, server error, or missing primary provider configuration. Authentication rejection, content-policy rejection, invalid input, caller cancellation, and invalid structured output do not intentionally trigger fallback.

Each invocation has at most one primary and one backup attempt, with a separate 50-second timeout. No fallback to another provider occurs after Azure fails. Outbox retry policy still applies to widget jobs. Successful widget analysis records the actual provider and Azure deployment alias. Diagnostic drafts record the provider and deployment/model identifier.

## Required setup

1. Choose an owner-controlled Azure subscription, resource group, supported region, and spending limit. No subscription or region has been selected by this code change.
2. Provision an Azure OpenAI resource and a deployment supporting Responses API, image inputs, and structured output. Diagnostic drafts also attach PDFs, so verify PDF support for that deployment. Azure deployment aliases are not Gateway IDs.
3. Configure server-only settings in the existing Vercel project:
   - `AZURE_RESOURCE_NAME`: resource name, not a URL.
   - `AZURE_OPENAI_DEPLOYMENT`: default deployment alias.
   - Optional overrides: `AZURE_PRE_DISPATCH_DEPLOYMENT`, `AZURE_DIAGNOSTIC_DEPLOYMENT`, `AZURE_INVOICE_DEPLOYMENT`.
   - `AZURE_API_KEY`: provision through the approved secret-management workflow; never commit it, expose it through `NEXT_PUBLIC_*`, or paste it in chat.
   - Keep `AZURE_AI_BACKUP_ENABLED=false` until staging checks pass.
4. Review Azure access controls, network access from Vercel, quotas, content filters, regional processing/data policies, budgets and alerts. `store:false` disables Responses conversation persistence, not all Azure service-level retention.
5. Test with synthetic media: primary success; forced primary 429/503/timeout; valid Azure structured output; Azure failure; no fallback on policy rejection; tenant isolation; recorded provider; eventual notification delivery.
6. Enable `AZURE_AI_BACKUP_ENABLED=true` and redeploy only after those checks pass. Roll back backup routing by disabling the flag and redeploying.

## Current access blocker

No Azure CLI or Azure management connector was available in this session. The workspace-required `aws-secrets-manager` skill could not be retrieved, so no real credentials were read or changed. Connect the owner-controlled Azure subscription and restore the required secret-management workflow before provisioning/activation.

Implementation was checked against the installed `@ai-sdk/azure` provider source and its matching AI SDK. Local unit tests mock providers; they do not establish live Azure connectivity or model capability.
