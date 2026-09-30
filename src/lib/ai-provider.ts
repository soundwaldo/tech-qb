import "server-only";
import { gateway, type LanguageModel } from "ai";
import { getAzureModel, getAzureDeployment, azureResponseOptions, type AiTask } from "./azure-ai";

type Invocation = { model: LanguageModel; providerOptions?: typeof azureResponseOptions };

export function shouldUseAzureBackup(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 4) return false;
  const value = error as { statusCode?: number; name?: string; cause?: unknown; lastError?: unknown; code?: string };
  if (value.statusCode === 429 || (value.statusCode !== undefined && value.statusCode >= 500 && value.statusCode <= 599)) return true;
  if (["TimeoutError", "AI_LoadAPIKeyError", "AI_LoadSettingError"].includes(value.name || "")) return true;
  if (["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND"].includes(value.code || "")) return true;
  return shouldUseAzureBackup(value.lastError || value.cause, depth + 1);
}

export async function withAiBackup<T>(task: AiTask, run: (config: Invocation) => Promise<T>) {
  const primaryModel = task === "pre-dispatch"
    ? process.env.PRE_DISPATCH_AI_MODEL || process.env.AI_DIAGNOSTIC_MODEL || "openai/gpt-5.4"
    : task === "diagnostic" ? process.env.AI_DIAGNOSTIC_MODEL || "openai/gpt-5.4"
    : process.env.AI_INVOICE_MODEL || "openai/gpt-4o";
  try {
    const result = await run({ model: gateway(primaryModel) });
    return { result, provider: "vercel-ai-gateway", modelVersion: primaryModel };
  } catch (error) {
    if (process.env.AZURE_AI_BACKUP_ENABLED !== "true" || !shouldUseAzureBackup(error)) throw error;
    // Log no customer evidence, credentials, or raw provider errors.
    console.warn(`[AI] ${task}: primary unavailable; attempting Azure backup`);
    const modelVersion = getAzureDeployment(task);
    const result = await run({ model: getAzureModel(task), providerOptions: azureResponseOptions });
    return { result, provider: "azure-openai", modelVersion };
  }
}
