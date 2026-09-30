"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "../pre-dispatch.module.css";

type Result = {
  company: { slug: string; display_name: string };
  hostedUploadUrl: string;
  embedCode: string | null;
  originConfigured: boolean;
};
type OnboardingData = {
  companyName: string; contactName: string; workEmail: string; notificationEmail: string;
  phone: string; websiteUrl: string; logoUrl: string; brandColor: string;
  displayName: string; slug: string; termsAccepted: boolean;
};
const emptyData: OnboardingData = { companyName:"",contactName:"",workEmail:"",notificationEmail:"",phone:"",websiteUrl:"",logoUrl:"",brandColor:"#0f766e",displayName:"",slug:"",termsAccepted:false };

export function OnboardingForm() {
  const [step,setStep]=useState(1); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const [result,setResult]=useState<Result|null>(null);
  const [data,setData]=useState<OnboardingData>(()=>{if(typeof window==="undefined")return emptyData;const saved=sessionStorage.getItem("gg-pd-onboarding");if(!saved)return emptyData;try{return{...emptyData,...JSON.parse(saved)} as OnboardingData}catch{return emptyData}});
  useEffect(()=>{sessionStorage.setItem("gg-pd-onboarding",JSON.stringify(data))},[data]);
  const field=(key:keyof OnboardingData)=>(event:React.ChangeEvent<HTMLInputElement>)=>setData(current=>({...current,[key]:event.target.type==="checkbox"?event.target.checked:event.target.value}));
  function validate(targetStep=step){
    if(targetStep===1&&(!data.companyName.trim()||!data.contactName.trim()||!/^\S+@\S+\.\S+$/.test(data.workEmail)||!/^\S+@\S+\.\S+$/.test(data.notificationEmail)||data.phone.replace(/\D/g,"").length<7))return "Complete the company, contact, email, and phone fields.";
    if(targetStep===2&&(!data.displayName.trim()||(data.websiteUrl&&!/^https:\/\//i.test(data.websiteUrl))||(data.logoUrl&&!/^https:\/\//i.test(data.logoUrl))))return "Enter a customer-facing name. Website and logo URLs must use HTTPS.";
    if(targetStep===3&&(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)||!data.termsAccepted))return "Enter a lowercase company slug and accept the terms.";
    return "";
  }
  function next(){const message=validate();if(message){setError(message);return}setError("");setStep(current=>Math.min(3,current+1))}
  async function submit(event:FormEvent){event.preventDefault();const message=validate(3);if(message){setError(message);return}setBusy(true);setError("");try{const response=await fetch("/api/pre-dispatch/companies",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});const body=await response.json();if(!response.ok)throw new Error(body.error||"Unable to finish onboarding");setResult(body);sessionStorage.removeItem("gg-pd-onboarding")}catch(reason){setError(reason instanceof Error?reason.message:"Unable to finish onboarding")}finally{setBusy(false)}}
  if(result)return <div className={styles.success}><h2>Your hosted upload link is ready</h2><p><a href={result.hostedUploadUrl}>{location.origin}{result.hostedUploadUrl}</a></p>{result.originConfigured&&result.embedCode?<><h3>Embed code</h3><pre className={styles.code}>{result.embedCode}</pre><button className={styles.button} onClick={()=>void navigator.clipboard.writeText(result.embedCode!)}>Copy embed code</button><p>Next: install the snippet, then verify it from Widget settings.</p></>:<p>Add an exact HTTPS website origin in Widget settings before using the embed. The hosted link works now.</p>}</div>;
  return <form onSubmit={submit} noValidate><p>Step {step} of 3</p><div className={styles.progress}><span style={{width:`${step*33.34}%`}}/></div>{error?<p className={styles.error} role="alert">{error}</p>:null}<div className={styles.formGrid}>
    {step===1?<><div className={styles.field}><label>Company name<input required value={data.companyName} onChange={field("companyName")}/></label></div><div className={styles.field}><label>Contact name<input required autoComplete="name" value={data.contactName} onChange={field("contactName")}/></label></div><div className={styles.field}><label>Work email<input required type="email" autoComplete="email" value={data.workEmail} onChange={field("workEmail")}/></label></div><div className={styles.field}><label>Notification email<input required type="email" value={data.notificationEmail} onChange={field("notificationEmail")}/></label></div><div className={styles.field}><label>Company phone<input required type="tel" autoComplete="tel" value={data.phone} onChange={field("phone")}/></label></div></>:null}
    {step===2?<><div className={styles.field}><label>Website URL (required for embed)<input type="url" placeholder="https://www.example.com" value={data.websiteUrl} onChange={field("websiteUrl")}/></label></div><div className={styles.field}><label>Logo URL (approved HTTPS storage)<input type="url" placeholder="https://" value={data.logoUrl} onChange={field("logoUrl")}/></label></div><div className={styles.field}><label>Brand color<input type="color" value={data.brandColor} onChange={field("brandColor")}/></label></div><div className={styles.field}><label>Customer-facing name<input required value={data.displayName} onChange={field("displayName")}/></label></div></>:null}
    {step===3?<><div className={styles.field}><label>Company slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="acme-garage-doors" value={data.slug} onChange={field("slug")}/></label></div><div className={`${styles.field} ${styles.full}`}><label><input type="checkbox" required checked={data.termsAccepted} onChange={field("termsAccepted")}/> I agree to the <a href="/terms" target="_blank">terms</a> and acknowledge the <a href="/privacy" target="_blank">privacy policy</a>.</label></div></>:null}
  </div><div className={styles.actions}>{step>1?<button type="button" className={styles.buttonGhost} onClick={()=>{setError("");setStep(current=>current-1)}}>Back</button>:null}{step<3?<button type="button" className={styles.button} onClick={next}>Continue</button>:<button type="submit" className={styles.button} disabled={busy}>{busy?"Creating…":"Create company link"}</button>}</div></form>;
}
