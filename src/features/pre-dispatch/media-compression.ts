const MAX_IMAGE_EDGE = 1920;
const WEBP_QUALITY = 0.78;

function compressedName(name: string) {
  const stem = name.replace(/\.[^.]+$/, "") || "garage-door-photo";
  return `${stem}.webp`;
}

/**
 * Re-encodes browser-decodable images before upload. Besides reducing transfer
 * size, drawing into a fresh canvas removes embedded EXIF/GPS metadata.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/heic" || file.type === "image/heif") {
    throw new Error("HEIC photos cannot yet be compressed securely in this browser. Choose JPG, PNG, or WebP.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`Could not prepare ${file.name}. Choose a valid JPG, PNG, or WebP image.`);
  }

  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Image compression is unavailable in this browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
    if (!blob) throw new Error("Image compression is unavailable in this browser.");
    return new File([blob], compressedName(file.name), { type: "image/webp", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

async function extractVideoFrames(file:File,count:number):Promise<File[]>{if(!count)return[];const url=URL.createObjectURL(file);const video=document.createElement("video");video.preload="metadata";video.muted=true;video.playsInline=true;video.src=url;try{await new Promise<void>((resolve,reject)=>{video.onloadedmetadata=()=>resolve();video.onerror=()=>reject(new Error("Video preview unavailable"))});if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>60)throw new Error(`${file.name} must be 60 seconds or shorter.`);const frames:File[]=[];for(let index=0;index<count;index++){video.currentTime=Math.max(.1,video.duration*((index+1)/(count+1)));await new Promise<void>((resolve,reject)=>{video.onseeked=()=>resolve();video.onerror=()=>reject(new Error("Video frame unavailable"))});const scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));const context=canvas.getContext("2d",{alpha:false});if(!context)break;context.drawImage(video,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",.76));if(blob)frames.push(new File([blob],`${file.name.replace(/\.[^.]+$/,"")}-analysis-frame-${index+1}.webp`,{type:"image/webp",lastModified:Date.now()}))}return frames}finally{URL.revokeObjectURL(url);video.removeAttribute("src");video.load()}}

export async function prepareMediaForUpload(files: File[], maxPhotoBytes: number, maxVideoBytes: number, maxPhotos=5) {
  const prepared: File[] = [];
  const selectedPhotos=files.filter(file=>file.type.startsWith("image/")).length;let frameSlots=Math.max(0,maxPhotos-selectedPhotos);
  for (const file of files) {
    if (file.type.startsWith("image/")) {
      const compressed = await compressImageForUpload(file);
      if (compressed.size > maxPhotoBytes) throw new Error(`${file.name} is still too large after compression.`);
      prepared.push(compressed);
      continue;
    }
    // Arbitrary library videos cannot be transcoded consistently in all widget
    // browsers. Enforce the upload ceiling rather than silently sending an
    // oversized file; native/server transcoding is the next production step.
    if (file.size > maxVideoBytes) throw new Error(`${file.name} is too large. Record a shorter video and try again.`);
    prepared.push(file);
    if(frameSlots){try{const frames=await extractVideoFrames(file,Math.min(3,frameSlots));prepared.push(...frames);frameSlots-=frames.length}catch(error){if(error instanceof Error&&error.message.includes("60 seconds"))throw error}}
  }
  return prepared;
}
