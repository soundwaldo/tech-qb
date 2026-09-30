"use client";
import { useState } from "react";
import styles from "../pre-dispatch.module.css";
export function CustomerAccessControl({requestId}:{requestId:string}){const[message,setMessage]=useState("");async function revoke(){if(!confirm("Revoke every active customer status link for this request?"))return;const response=await fetch(`/api/pre-dispatch/portal/customer-access?requestId=${encodeURIComponent(requestId)}`,{method:"DELETE"});const body=await response.json();setMessage(response.ok?`${body.revoked} active status link(s) revoked.`:body.error)}return <div><button type="button" className={styles.buttonGhost} onClick={()=>void revoke()}>Revoke customer status links</button><span aria-live="polite"> {message}</span></div>}
