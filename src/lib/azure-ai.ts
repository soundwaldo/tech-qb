import "server-only";
import { createAzure } from "@ai-sdk/azure";

export type AiTask = "pre-dispatch" | "diagnostic" | "invoice";

const deploymentVariables: Record<AiTask, string> = {
  "pre-dispatch": "AZURE_PRE_DISPATCH_DEPLOYMENT",
  diagnostic: "AZURE_DIAGNOSTIC_DEPLOYMENT",
  invoice: "AZURE_INVOICE_DEPLOYMENT",
};

export function getAzureDeployment(task: AiTask): string {
  const deployment = (process.env[deploymentVariables[task]] || process.env.AZURE_OPENAI_DEPLOYMENT || "").trim();
  if (!deployment || !/^[a-zA-Z0-9_.-]+$/.test(deployment)) {
    throw new Error(`Configure ${deploymentVariables[task]} or AZURE_OPENAI_DEPLOYMENT with an Azure deployment name`);
  }
  return deployment;
}

// Construct lazily so build-time imports do not need production configuration.
// Credentials are resolved by the Azure SDK provider on the server at runtime.
// There is intentionally no fallback to another AI provider.
export function getAzureModel(task: AiTask) {
  const resourceName = process.env.AZURE_RESOURCE_NAME?.trim();
  if (!resourceName || !/^[a-zA-Z0-9-]+$/.test(resourceName)) {
    throw new Error("Configure AZURE_RESOURCE_NAME with the Azure OpenAI resource name");
  }
  return createAzure({ resourceName }).responses(getAzureDeployment(task));
}

// Do not persist Responses API conversations. Azure service-level policies
// still apply; this setting is not a zero-retention guarantee.
export const azureResponseOptions = { openai: { store: false } };
