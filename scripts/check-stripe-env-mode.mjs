#!/usr/bin/env node

const classifyKey = (value, livePrefix, testPrefix) => {
  if (!value) return "missing";
  if (value.startsWith(livePrefix)) return "live";
  if (value.startsWith(testPrefix)) return "test";
  return "unknown";
};

const assessmentPriceNames = [
  "STRIPE_PRICE_STANDARD",
  "STRIPE_PRICE_EXPRESS",
  "STRIPE_PRICE_COMPREHENSIVE",
];

console.log(JSON.stringify({
  secretKeyMode: classifyKey(process.env.STRIPE_SECRET_KEY, "sk_live_", "sk_test_"),
  publishableKeyMode: classifyKey(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, "pk_live_", "pk_test_"),
  webhookSecretPresent: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")),
  assessmentPricesConfigured: assessmentPriceNames.every((name) => process.env[name]?.startsWith("price_")),
}));
