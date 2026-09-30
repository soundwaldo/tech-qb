import type{PreDispatchEvent}from"./events";
export type IntegrationDeliveryResult={success:boolean;responseCode?:number;providerReference?:string;retryable:boolean};
export interface PreDispatchIntegrationAdapter<TConfiguration=unknown>{readonly type:string;validateConfiguration(configuration:TConfiguration):Promise<void>;testConnection(configuration:TConfiguration):Promise<IntegrationDeliveryResult>;deliver(event:PreDispatchEvent,configuration:TConfiguration):Promise<IntegrationDeliveryResult>}
