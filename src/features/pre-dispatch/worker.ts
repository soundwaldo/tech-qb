import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { decryptPII } from "@/lib/pii-encryption";
import { GatewayPreDispatchAnalysisProvider, loadAnalysisMedia } from "./analysis-provider";
import { preDispatchAnalysisSchema } from "./analysis-contract";
import { preDispatchFlags } from "./config";
import { sendPreDispatchEmail } from "./email";
import { retryDelayMs, signWebhookPayload, type PreDispatchEvent } from "./events";
import { postSafeWebhook } from "./webhook-security";
import { deleteStoredObject } from "@/lib/storage";

type Outbox = { id:string;company_id:string;request_id:string;event_type:string;attempts:number;payload:Record<string,unknown> };

export async function processPreDispatchOutbox(workerId=randomUUID()) {
  if (!preDispatchFlags.worker) return { processed:false,reason:"disabled" };
  const sql=getDb();
  const claimed=await sql`UPDATE pre_dispatch_outbox_events SET status='processing',locked_at=now(),locked_by=${workerId},attempts=attempts+1 WHERE id=(SELECT id FROM pre_dispatch_outbox_events WHERE ((status IN ('pending','retry') AND available_at<=now()) OR (status='processing' AND locked_at<now()-interval '10 minutes')) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`;
  const event=claimed[0] as Outbox|undefined;if(!event)return{processed:false,reason:"empty"};
  try {
    await handleEvent(event);
    await sql`UPDATE pre_dispatch_outbox_events SET status='completed',completed_at=now(),locked_at=null,locked_by=null WHERE id=${event.id}`;
    return { processed:true,eventType:event.event_type,eventId:event.id };
  } catch(error) {
    const terminal=event.attempts>=3;
    await sql`UPDATE pre_dispatch_outbox_events SET status=${terminal?'dead_letter':'retry'},available_at=${new Date(Date.now()+retryDelayMs(event.attempts))},locked_at=null,locked_by=null,last_error_code=${error instanceof Error?error.name:'worker_error'} WHERE id=${event.id}`;
    if(terminal&&event.event_type==='predispatch.ai.requested'){
      await sql`UPDATE pre_dispatch_analyses SET status='failed',error_code='analysis_failed',updated_at=now() WHERE request_id=${event.request_id} AND company_id=${event.company_id}`;
      await sql`UPDATE pre_dispatch_requests SET analysis_status='failed',updated_at=now() WHERE id=${event.request_id} AND company_id=${event.company_id}`;
      if(preDispatchFlags.email)await enqueue(event.company_id,event.request_id,'predispatch.notification.requested',{analysisFailed:true});
      if(preDispatchFlags.webhooks)await enqueue(event.company_id,event.request_id,'predispatch.webhook.analysis_failed');
    }
    return { processed:true,failed:true,terminal,errorCode:error instanceof Error?error.name:'worker_error' };
  }
}

export async function drainPreDispatchOutbox(maxEvents=8) {
  const results: Awaited<ReturnType<typeof processPreDispatchOutbox>>[]=[];
  for(let index=0;index<maxEvents;index++){
    const result=await processPreDispatchOutbox();
    results.push(result);
    if(!result.processed)break;
  }
  return {
    processed:results.filter(result=>result.processed).length,
    failed:results.filter(result=>"failed" in result&&result.failed).length,
    drained:results.at(-1)?.processed===false,
  };
}

export async function processPreDispatchRetention(){
  const sql=getDb();
  const expiredTrials=await sql`WITH expired AS (UPDATE pre_dispatch_companies SET product_status='expired',widget_enabled=false,updated_at=now() WHERE product_status='trial' AND trial_ends_at<=now() RETURNING id) INSERT INTO pre_dispatch_audit_events(id,company_id,event_type,actor_type,sanitized_metadata) SELECT gen_random_uuid(),id,'pilot.expired','system','{}'::jsonb FROM expired RETURNING company_id`;
  await sql`UPDATE pre_dispatch_upload_sessions SET status='expired' WHERE status='pending' AND expires_at<=now()`;
  await sql`DELETE FROM api_rate_limit_buckets WHERE reset_at<now()-interval '1 day'`;
  await sql`DELETE FROM pre_dispatch_customer_access_tokens WHERE expires_at<now()-interval '30 days'`;
  const rows=await sql`SELECT m.id,m.company_id,m.storage_key FROM pre_dispatch_media_assets m JOIN pre_dispatch_companies c ON c.id=m.company_id WHERE (m.processing_status='pending' AND m.created_at<now()-interval '1 day') OR (m.processing_status IN ('verified','rejected') AND m.created_at<now()-(c.retention_days||' days')::interval) ORDER BY m.created_at LIMIT 25` as Array<{id:string;company_id:string;storage_key:string}>;
  let deleted=0;
  for(const item of rows){try{await deleteStoredObject(item.storage_key);await sql`UPDATE pre_dispatch_media_assets SET processing_status='deleted',deleted_at=now() WHERE id=${item.id} AND company_id=${item.company_id}`;deleted++}catch{/* retry on the next worker invocation */}}
  return{expiredSessions:true,expiredTrials:expiredTrials.length,deletedMedia:deleted};
}

async function handleEvent(event:Outbox) {
  switch(event.event_type){
    case'predispatch.request.finalized':return finalizeWorkflow(event);
    case'predispatch.ai.requested':return analyze(event);
    case'predispatch.notification.requested':return notify(event);
    case'predispatch.webhook.created':return deliverWebhooks(event,'predispatch.request.created');
    case'predispatch.webhook.analyzed':return deliverWebhooks(event,'predispatch.request.analyzed');
    case'predispatch.webhook.analysis_failed':return deliverWebhooks(event,'predispatch.analysis.failed');
    default:throw new Error(`Unsupported outbox event: ${event.event_type}`);
  }
}

async function enqueue(companyId:string,requestId:string,eventType:string,payload:Record<string,unknown>={}) {
  await getDb()`INSERT INTO pre_dispatch_outbox_events(id,company_id,request_id,event_type,payload) VALUES(${randomUUID()},${companyId},${requestId},${eventType},${JSON.stringify(payload)}::jsonb) ON CONFLICT(request_id,event_type) DO NOTHING`;
}

async function ensureMaintenanceRecord(event:Outbox) {
  const sql=getDb();
  const rows=await sql`SELECT r.*,array_remove(array_agg(m.sha256),null) media_hashes FROM pre_dispatch_requests r LEFT JOIN pre_dispatch_media_assets m ON m.request_id=r.id AND m.company_id=r.company_id WHERE r.id=${event.request_id} AND r.company_id=${event.company_id} GROUP BY r.id`;
  const request=rows[0] as Record<string,unknown>|undefined;if(!request)throw new Error('Request missing');
  const canonical=JSON.stringify({type:'pre_dispatch_intake',requestId:event.request_id,customerDescription:request.problem_description,mediaHashes:request.media_hashes,verificationState:'technician_verification_pending'});
  const hash=createHash('sha256').update(canonical).digest('hex');
  const inserted=await sql`INSERT INTO maintenance_records(id,public_id,repair_type,city,zip_code,content_hash,company_id,property_id,customer_id,pre_dispatch_request_id,source_media_hashes,verification_state,human_review_state) VALUES(${randomUUID()},${`PD-${String(request.public_reference).replace('GG-','')}`},'pre_dispatch_intake',${request.city},${request.postal_code},${hash},${event.company_id},${request.property_id},${request.customer_id},${event.request_id},${request.media_hashes as string[]},'technician_verification_pending','pending') ON CONFLICT(pre_dispatch_request_id) DO UPDATE SET content_hash=EXCLUDED.content_hash RETURNING id`;
  return String(inserted[0].id);
}

async function finalizeWorkflow(event:Outbox) {
  await ensureMaintenanceRecord(event);
  if(preDispatchFlags.webhooks)await enqueue(event.company_id,event.request_id,'predispatch.webhook.created');
  const rows=await getDb()`SELECT ai_processing_consent FROM pre_dispatch_requests WHERE id=${event.request_id} AND company_id=${event.company_id}`;
  if(!rows[0])throw new Error('Request missing');
  if(preDispatchFlags.aiAnalysis&&rows[0].ai_processing_consent){
    await getDb()`INSERT INTO pre_dispatch_analyses(id,company_id,request_id,status) VALUES(${randomUUID()},${event.company_id},${event.request_id},'pending') ON CONFLICT(request_id) DO NOTHING`;
    await enqueue(event.company_id,event.request_id,'predispatch.ai.requested');
  }else if(preDispatchFlags.email)await enqueue(event.company_id,event.request_id,'predispatch.notification.requested',{analysisDisabled:true});
}

async function analyze(event:Outbox) {
  const sql=getDb();
  const requestRows=await sql`SELECT * FROM pre_dispatch_requests WHERE id=${event.request_id} AND company_id=${event.company_id}`;
  const request=requestRows[0] as Record<string,unknown>|undefined;if(!request)throw new Error('Request missing');
  const mediaRows=await sql`SELECT id,storage_key,mime_type,original_filename,sha256,type FROM pre_dispatch_media_assets WHERE request_id=${event.request_id} AND company_id=${event.company_id} AND processing_status='verified'`;
  await sql`UPDATE pre_dispatch_analyses SET status='processing',attempts=attempts+1,updated_at=now() WHERE request_id=${event.request_id} AND company_id=${event.company_id}`;
  const media=await loadAnalysisMedia(mediaRows as Array<{id:string;storage_key:string;mime_type:string;original_filename:string}>);
  const provider = new GatewayPreDispatchAnalysisProvider();
  const result=preDispatchAnalysisSchema.parse(await provider.analyze({requestId:event.request_id,media,customerDescription:String(request.problem_description)}));
  const observations=result.evidenceObservations.join('\n');
  const analysisRows=await sql`UPDATE pre_dispatch_analyses SET status='completed',summary=${result.potentialIssueDescription},possible_issues='[]'::jsonb,parts_categories='{}',urgency=${result.urgency},safety_flags=${result.safetyFlags},dispatch_notes=${observations},equipment_observations=${JSON.stringify(result.equipmentObservations)}::jsonb,inventory_categories='{}',estimated_minutes_min=null,estimated_minutes_max=null,overall_confidence=${result.overallConfidence},evidence_references=${JSON.stringify(result.evidenceReferences)}::jsonb,limitations=${result.limitations},provider=${provider.name},model_version=${provider.modelVersion},completed_at=now(),updated_at=now() WHERE request_id=${event.request_id} AND company_id=${event.company_id} RETURNING id,model_version`;
  const analysis=analysisRows[0] as {id:string;model_version:string};
  const canonical=JSON.stringify({type:'pre_dispatch_intake',requestId:event.request_id,analysisId:analysis.id,potentialIssueDescription:result.potentialIssueDescription,equipmentObservations:result.equipmentObservations,safetyFlags:result.safetyFlags,mediaHashes:mediaRows.map(row=>row.sha256).sort(),verificationState:'technician_verification_pending'});
  await sql`UPDATE maintenance_records SET analysis_id=${analysis.id},content_hash=${createHash('sha256').update(canonical).digest('hex')},preliminary_findings=${JSON.stringify({potentialIssueDescription:result.potentialIssueDescription,evidenceObservations:result.evidenceObservations,equipmentObservations:result.equipmentObservations,limitations:result.limitations})}::jsonb,safety_flags=${result.safetyFlags},model_version=${analysis.model_version} WHERE pre_dispatch_request_id=${event.request_id} AND company_id=${event.company_id}`;
  await sql`UPDATE pre_dispatch_requests SET analysis_status='completed',updated_at=now() WHERE id=${event.request_id} AND company_id=${event.company_id}`;
  if(preDispatchFlags.email)await enqueue(event.company_id,event.request_id,'predispatch.notification.requested');
  if(preDispatchFlags.webhooks)await enqueue(event.company_id,event.request_id,'predispatch.webhook.analyzed');
}

async function loadDeliveryData(companyId:string,requestId:string):Promise<Record<string,unknown>> {
  const rows=await getDb()`SELECT r.*,cu.first_name customer_first_name,cu.last_name customer_last_name,cu.phone customer_phone,cu.email customer_email,c.*,a.id analysis_id,a.summary analysis_summary,a.urgency,a.safety_flags,a.dispatch_notes,a.equipment_observations,a.overall_confidence,a.limitations,m.id maintenance_record_id FROM pre_dispatch_requests r JOIN pre_dispatch_customers cu ON cu.id=r.customer_id AND cu.company_id=r.company_id JOIN pre_dispatch_companies c ON c.id=r.company_id LEFT JOIN pre_dispatch_analyses a ON a.request_id=r.id AND a.company_id=r.company_id LEFT JOIN maintenance_records m ON m.pre_dispatch_request_id=r.id AND m.company_id=r.company_id WHERE r.id=${requestId} AND r.company_id=${companyId}`;
  if(!rows[0])throw new Error('Delivery data missing');const row=rows[0] as Record<string,unknown>;return{...row,customer_name:`${decryptPII(String(row.customer_first_name))} ${decryptPII(String(row.customer_last_name))}`,customer_phone:decryptPII(String(row.customer_phone)),customer_email:row.customer_email?decryptPII(String(row.customer_email)):null,service_address1:decryptPII(String(row.service_address1)),service_address2:row.service_address2?decryptPII(String(row.service_address2)):null} as Record<string,unknown>;
}

async function notify(event:Outbox) {
  const d=await loadDeliveryData(event.company_id,event.request_id);
  const count=await getDb()`SELECT count(*) count FROM pre_dispatch_media_assets WHERE request_id=${event.request_id} AND company_id=${event.company_id}`;
  await sendPreDispatchEmail({id:event.company_id,notification_email:String(d.notification_email),forwarding_email:d.forwarding_email?String(d.forwarding_email):null,additional_notification_emails:Array.isArray(d.additional_notification_emails)?d.additional_notification_emails.map(String):[]},{id:event.request_id,publicReference:String(d.public_reference),customerName:String(d.customer_name),phone:String(d.customer_phone),email:d.customer_email?String(d.customer_email):undefined,address:`${d.service_address1}, ${d.city}, ${d.state} ${d.postal_code}`,category:'Customer description',description:String(d.problem_description),summary:d.analysis_summary?String(d.analysis_summary):'AI analysis was unavailable. Review the customer description and evidence.',mediaCount:Number(count[0].count)});
}

async function buildEvent(event:Outbox,eventType:PreDispatchEvent['eventType']):Promise<PreDispatchEvent> {
  const d=await loadDeliveryData(event.company_id,event.request_id);
  const counts=await getDb()`SELECT count(*) FILTER(WHERE type='image') photos,count(*) FILTER(WHERE type='video') videos FROM pre_dispatch_media_assets WHERE request_id=${event.request_id} AND company_id=${event.company_id}`;
  const analysis=d.analysis_id?{id:String(d.analysis_id),potentialIssueDescription:String(d.analysis_summary),urgency:String(d.urgency),confidence:Number(d.overall_confidence),safetyFlags:Array.isArray(d.safety_flags)?d.safety_flags.map(String):[],evidenceObservations:d.dispatch_notes?String(d.dispatch_notes).split('\n').filter(Boolean):[],equipmentObservations:(d.equipment_observations&&typeof d.equipment_observations==='object'?d.equipment_observations:{}) as Record<string,unknown>,limitations:Array.isArray(d.limitations)?d.limitations.map(String):[],technicianVerificationRequired:true as const}:null;
  return {eventId:event.id,eventType,eventVersion:'1.0',createdAt:new Date().toISOString(),company:{externalReference:String(d.slug)},request:{id:event.request_id,publicReference:String(d.public_reference),status:String(d.status)},customer:{name:String(d.customer_name),phone:String(d.customer_phone),email:d.customer_email?String(d.customer_email):null},serviceLocation:{address1:String(d.service_address1),address2:d.service_address2?String(d.service_address2):null,city:String(d.city),state:String(d.state),postalCode:String(d.postal_code)},intake:{description:String(d.problem_description)},analysis,maintenanceRecord:{id:String(d.maintenance_record_id),status:'technician_verification_pending'},media:{photoCount:Number(counts[0].photos),videoCount:Number(counts[0].videos)}};
}

async function deliverWebhooks(event:Outbox,eventType:PreDispatchEvent['eventType']) {
  const sql=getDb();const configs=await sql`SELECT * FROM pre_dispatch_webhook_configs WHERE company_id=${event.company_id} AND active=true`;const body=JSON.stringify(await buildEvent(event,eventType));
  for(const row of configs){
    const config=row as {id:string;encrypted_secret:string;endpoint_url:string};
    const candidateId=randomUUID();
    const deliveryRows=await sql`INSERT INTO pre_dispatch_webhook_deliveries(id,company_id,webhook_config_id,integration_event_id,request_id,status) VALUES(${candidateId},${event.company_id},${config.id},${event.id},${event.request_id},'pending') ON CONFLICT(webhook_config_id,integration_event_id) DO UPDATE SET updated_at=now() RETURNING id,status`;
    const deliveryId=String(deliveryRows[0].id);if(String(deliveryRows[0].status)==='delivered')continue;
    const timestamp=String(Math.floor(Date.now()/1000));let responseCode:number|null=null;let excerpt='';
    try{
      const response=await postSafeWebhook(config.endpoint_url,{'content-type':'application/json','x-gguard-event-id':event.id,'x-gguard-event-version':'1.0','x-gguard-timestamp':timestamp,'x-gguard-signature':`sha256=${signWebhookPayload(decryptPII(config.encrypted_secret),timestamp,body)}`},body);
      responseCode=response.status;excerpt=response.text.replace(/[\r\n]/g,' ');if(!response.ok)throw new Error(`Webhook HTTP ${response.status}`);
      await sql`UPDATE pre_dispatch_webhook_deliveries SET status='delivered',attempts=attempts+1,response_code=${responseCode},response_excerpt=${excerpt},error_code=null,last_attempt_at=now(),updated_at=now() WHERE id=${deliveryId}`;
    }catch(error){
      await sql`UPDATE pre_dispatch_webhook_deliveries SET status='failed',attempts=attempts+1,response_code=${responseCode},response_excerpt=${excerpt},error_code='delivery_failed',last_attempt_at=now(),updated_at=now() WHERE id=${deliveryId}`;throw error;
    }
  }
}
