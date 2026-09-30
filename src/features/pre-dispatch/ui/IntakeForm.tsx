"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { prepareMediaForUpload } from "../media-compression";
import styles from "../pre-dispatch.module.css";
import camera from "../camera.module.css";

type Session = {
  sessionToken: string;
  idempotencyKey: string;
  limits: { maxPhotos: number; maxVideos: number; maxPhotoBytes: number; maxVideoBytes: number };
};

function readEmbeddedSession(): Session | null {
  if (typeof window === "undefined" || !window.location.hash.startsWith("#session=")) return null;
  try {
    const encoded = decodeURIComponent(window.location.hash.slice(9));
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    const value = JSON.parse(new TextDecoder().decode(bytes)) as Session;
    history.replaceState(null, "", location.pathname + location.search);
    return value;
  } catch {
    return null;
  }
}

export function IntakeForm({ companySlug }: { companySlug: string }) {
  const [session, setSession] = useState<Session | null>(readEmbeddedSession);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{reference:string;statusUrl:string}|null>(null);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [preferredContact, setPreferredContact] = useState("phone");
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [mediaLocked, setMediaLocked] = useState(false);
  const [cameraStream,setCameraStream]=useState<MediaStream|null>(null);
  const [cameraError,setCameraError]=useState("");
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const uploadedMedia = useRef(new Map<File, { id: string; url: string; headers?: Record<string, string>; uploaded: boolean; verified: boolean }>());

  useEffect(() => {
    if (session) return;
    const controller = new AbortController();
    fetch("/api/pre-dispatch/widget/sessions", {
      signal: controller.signal,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ companySlug }),
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setSession(body);
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Widget unavailable"); });
    return () => controller.abort();
  }, [companySlug, session, sessionAttempt]);

  useEffect(()=>{const video=videoRef.current;if(!video||!cameraStream)return;const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")setCameraStream(null)};video.srcObject=cameraStream;void video.play();window.addEventListener("keydown",onKeyDown);return()=>{window.removeEventListener("keydown",onKeyDown);video.srcObject=null;cameraStream.getTracks().forEach(track=>track.stop())}},[cameraStream]);
  async function openCamera(){setCameraError("");try{setCameraStream(await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false}))}catch{setCameraError("Camera access was unavailable. Use the photo-library button instead.")}}
  function closeCamera(){cameraStream?.getTracks().forEach(track=>track.stop());setCameraStream(null)}
  async function capturePhoto(){if(!videoRef.current||!session)return;const video=videoRef.current;const canvas=document.createElement("canvas");canvas.width=video.videoWidth;canvas.height=video.videoHeight;const context=canvas.getContext("2d");if(!context||!canvas.width||!canvas.height){setCameraError("The camera is not ready yet.");return}context.drawImage(video,0,0);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.9));if(!blob)return;const captured=new File([blob],`guided-door-${Date.now()}.jpg`,{type:"image/jpeg"});setPreparing(true);try{const prepared=await prepareMediaForUpload([captured],session.limits.maxPhotoBytes,session.limits.maxVideoBytes);setFiles(current=>{const photos=current.filter(file=>file.type.startsWith("image/")).length;if(photos>=session.limits.maxPhotos){setError(`Choose up to ${session.limits.maxPhotos} photos.`);return current}return[...current,...prepared]});closeCamera()}catch(reason){setCameraError(reason instanceof Error?reason.message:"Could not prepare the photo")}finally{setPreparing(false)}}

  async function select(next: FileList | null) {
    if (!next || !next.length || !session || busy || preparing || mediaLocked) return;
    const selected = Array.from(next);
    const photos = selected.filter((file) => file.type.startsWith("image/"));
    const videos = selected.filter((file) => file.type.startsWith("video/"));
    if (photos.length > session.limits.maxPhotos || videos.length > session.limits.maxVideos) {
      setError(`Choose up to ${session.limits.maxPhotos} photos and ${session.limits.maxVideos} video.`);
      return;
    }
    if (photos.length + videos.length !== selected.length) {
      setError("Only JPG, PNG, WebP, MP4, MOV, and WebM files are accepted.");
      return;
    }
    setPreparing(true);
    setError("");
    try {
      setFiles(await prepareMediaForUpload(selected, session.limits.maxPhotoBytes, session.limits.maxVideoBytes,session.limits.maxPhotos));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Media preparation failed");
    } finally {
      setPreparing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || preparing) return;
    // React clears currentTarget after the handler yields. Snapshot the form
    // before uploads, and preserve completed upload steps for safe retries.
    const form = new FormData(event.currentTarget);
    if (!session || !files.length) {
      setError("Add at least one photo or video.");
      return;
    }
    setBusy(true);
    setMediaLocked(true);
    setError("");
    setProgress(0);
    abortRef.current = new AbortController();
    try {
      const mediaAssetIds: string[] = [];
      for (const [index, file] of files.entries()) {
        let asset = uploadedMedia.current.get(file);
        if (!asset) {
        const declarationResponse = await fetch("/api/pre-dispatch/uploads", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${session.sessionToken}` },
          body: JSON.stringify({
            originalFilename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            type: file.type.startsWith("image/") ? "image" : "video",
          }),
          signal: abortRef.current.signal,
        });
        const declaration = await declarationResponse.json();
        if (!declarationResponse.ok) throw new Error(declaration.error);
        asset = { id: declaration.mediaAssetId, url: declaration.uploadUrl, headers: declaration.uploadHeaders, uploaded: false, verified: false };
        uploadedMedia.current.set(file, asset);
        }
        if (!asset.uploaded) {
        const uploadResponse = await fetch(asset.url, {
          method: "PUT",
          headers: { "content-type": file.type, ...(asset.headers || {}) },
          body: file,
          signal: abortRef.current.signal,
        });
        if (!uploadResponse.ok) throw new Error(uploadResponse.status === 403
          ? "The upload link may have expired. Start a new upload session and try again."
          : "Media upload failed. Check your connection and try again.");
        asset.uploaded = true;
        }
        if (!asset.verified) {
        const verificationResponse = await fetch("/api/pre-dispatch/uploads", {
          method: "PATCH",
          headers: { "content-type": "application/json", authorization: `Bearer ${session.sessionToken}` },
          body: JSON.stringify({ mediaAssetId: asset.id }),
          signal: abortRef.current.signal,
        });
        if (!verificationResponse.ok) {
          const detail = await verificationResponse.json();
          throw new Error(detail.error || "Media verification failed");
        }
        asset.verified = true;
        }
        mediaAssetIds.push(asset.id);
        setProgress(Math.round(((index + 1) / files.length) * 100));
      }

      const response = await fetch("/api/pre-dispatch/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionToken: session.sessionToken,
          idempotencyKey: session.idempotencyKey,
          honeypot: form.get("website_confirm") || "",
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          mobilePhone: form.get("mobilePhone"),
          email: form.get("email"),
          serviceAddress1: form.get("serviceAddress1"),
          serviceAddress2: form.get("serviceAddress2"),
          city: form.get("city"),
          state: form.get("state"),
          postalCode: form.get("postalCode"),
          preferredContactMethod: form.get("preferredContactMethod") || undefined,
          problemDescription: form.get("problemDescription"),
          consentAccepted: form.get("consentAccepted") === "on",
          aiProcessingConsent: form.get("aiProcessingConsent") === "on",
          mediaAssetIds,
        }),
        signal: abortRef.current.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDone({reference:body.publicReference,statusUrl:body.customerStatusUrl});
    } catch (reason) {
      setError(reason instanceof DOMException && reason.name === "AbortError"
        ? "Upload cancelled. Your form information is still here."
        : reason instanceof Error ? reason.message : "Submission failed");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  if (done) return <div className={styles.success} role="status"><h2>Your request has been saved.</h2><p>Reference: <strong>{done.reference}</strong></p><p><a href={done.statusUrl}>Save this private status link</a>. It expires after seven days and can be revoked by the service company.</p><p>Your information and media are saved for the service company. Processing and notifications may still be pending. This is not an appointment confirmation. Any AI description is preliminary and must be verified by a qualified technician.</p></div>;

  return <form onSubmit={submit}>
    <fieldset disabled={busy || preparing} className={styles.formGrid} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className={styles.field}><label>First name<input name="firstName" required autoComplete="given-name" /></label></div>
      <div className={styles.field}><label>Last name<input name="lastName" required autoComplete="family-name" /></label></div>
      <div className={styles.field}><label>Mobile phone<input name="mobilePhone" required type="tel" autoComplete="tel" /></label></div>
      <div className={styles.field}><label>Email {preferredContact === "email" ? "(required)" : "(optional)"}<input name="email" type="email" autoComplete="email" required={preferredContact === "email"} /></label></div>
      <div className={`${styles.field} ${styles.full}`}><label>Service address<input name="serviceAddress1" required autoComplete="address-line1" /></label></div>
      <div className={`${styles.field} ${styles.full}`}><label>Unit or suite (if applicable)<input name="serviceAddress2" autoComplete="address-line2" aria-describedby="unit-help" /></label><small id="unit-help">Include your unit to keep its property history separate from other units.</small></div>
      <div className={styles.field}><label>City<input name="city" required autoComplete="address-level2" /></label></div>
      <div className={styles.field}><label>State<input name="state" required maxLength={2} autoComplete="address-level1" /></label></div>
      <div className={styles.field}><label>ZIP code<input name="postalCode" required inputMode="numeric" autoComplete="postal-code" /></label></div>
      <div className={styles.field}><label>Preferred contact<select name="preferredContactMethod" value={preferredContact} onChange={event => setPreferredContact(event.target.value)}><option value="phone">Phone</option><option value="text">Text</option><option value="email">Email</option></select></label></div>
      <div className={`${styles.field} ${styles.full}`}><label>Tell us what’s happening<textarea name="problemDescription" required minLength={10} maxLength={3000} rows={6} placeholder="Describe what the door or opener is doing, when it started, and anything visible or unusual." /></label></div>
      <div className={`${styles.field} ${styles.full}`}>
        <label>Photos and/or one short video<input type="file" disabled={mediaLocked || !session} accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" multiple onChange={(change) => void select(change.target.files)} aria-describedby="selected-media" /></label>
        <button type="button" disabled={mediaLocked || !session} className={styles.buttonGhost} onClick={() => void openCamera()}>Take guided equipment photo</button>
        <small id="selected-media" aria-live="polite">{preparing ? "Compressing and removing image metadata…" : files.length ? files.map(file => `${file.name} (${Math.ceil(file.size / 1024)} KB)`).join(", ") : "At least one photo or video is required before sending."}</small>
        {mediaLocked ? <small>Media selection is held for safe retries. Retry sending the same files if your connection was interrupted.</small> : null}
        {cameraError ? <span className={styles.error} role="alert">{cameraError}</span> : null}
      </div>
      <input className={styles.srOnly} tabIndex={-1} autoComplete="off" name="website_confirm" aria-hidden="true" />
      <div className={`${styles.field} ${styles.full}`}>
        <label><input type="checkbox" name="consentAccepted" required /> I consent to share these details and media with this garage door company.</label>
        <label><input type="checkbox" name="aiProcessingConsent" required /> I consent to AI processing that may provide a preliminary issue description. A qualified technician must verify it.</label>
        <small><a href="/privacy" target="_blank">Privacy</a> · <a href="/terms" target="_blank">Terms</a></small>
      </div>
    </fieldset>
    {files.length ? <ul aria-label="Selected media">{files.map((file, index) => <li key={`${file.name}-${index}`}>{file.name} <button type="button" disabled={busy || preparing || mediaLocked} onClick={() => setFiles(current => current.filter((_, position) => position !== index))} aria-label={`Remove ${file.name}`}>Remove</button></li>)}</ul> : null}
    {session ? <p><small>Up to {session.limits.maxPhotos} photos ({Math.floor(session.limits.maxPhotoBytes / 1048576)} MB each) and {session.limits.maxVideos} video ({Math.floor(session.limits.maxVideoBytes / 1048576)} MB, up to 60 seconds). Review your address and unit before sending.</small></p> : <p role="status">Connecting to the service company…</p>}
    {progress > 0 ? <div aria-live="polite"><p>{progress === 100 ? "Media verified. Saving your request…" : `Media verified: ${progress}%`}</p><div className={styles.progress}><span style={{ width: `${progress}%` }} /></div></div> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {error && !session ? <button type="button" className={styles.buttonGhost} onClick={() => { setError(""); setSessionAttempt(current => current + 1); }}>Retry connection</button> : null}
    {error && /expired/i.test(error) ? <button type="button" className={styles.buttonGhost} disabled={busy} onClick={() => { uploadedMedia.current.clear(); setMediaLocked(false); setSession(null); setSessionAttempt(current => current + 1); setProgress(0); setError(""); }}>Start a new upload session; keep my form</button> : null}
    <div className={styles.actions}><button className={styles.button} disabled={busy || preparing || !session}>{preparing ? "Preparing media…" : busy ? "Sending…" : "Send request"}</button>{busy ? <button type="button" className={styles.buttonGhost} onClick={() => abortRef.current?.abort()}>Cancel</button> : null}</div>
    {cameraStream?<div className={camera.cameraModal} role="dialog" aria-modal="true" aria-label="Guided garage door camera"><div className={camera.cameraStage}><video ref={videoRef} playsInline muted/><div className={camera.cameraGuide} aria-hidden="true"><div className={camera.doorGuide}><span>Fit the full door and every section inside this box</span></div><div className={camera.railGuide}><span>Include opener head → complete rail → header</span></div></div></div><p>Include the complete door, opener motor, entire rail, and spring system. Do not touch or move damaged equipment.</p><div className={styles.actions}><button type="button" className={styles.button} onClick={()=>void capturePhoto()}>Capture photo</button><button type="button" className={styles.buttonGhost} onClick={closeCamera}>Cancel</button></div></div>:null}
  </form>;
}
