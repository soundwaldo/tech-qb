const MAX_IMAGE_DIMENSION = 1920;

export async function compressForUpload(file: File): Promise<File> {
    if (file.type.startsWith("image/")) return compressImage(file);
    if (file.type.startsWith("video/")) return compressVideo(file);
    return file;
}

async function compressImage(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image compression is unavailable in this browser");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const outputType = file.type === "image/png" ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.78));
    if (!blob) throw new Error("Image compression failed");
    const extension = outputType === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${baseName(file.name)}.${extension}`, { type: outputType, lastModified: file.lastModified });
}

async function compressVideo(file: File): Promise<File> {
    if (typeof MediaRecorder === "undefined") throw new Error("Your browser cannot safely compress video. Please upload photos instead.");
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.src = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error("Could not read video")); });
    if (video.duration > 45) { URL.revokeObjectURL(video.src); throw new Error("Videos must be 45 seconds or shorter"); }
    const capture = video as HTMLVideoElement & { captureStream?: () => MediaStream };
    if (!capture.captureStream) { URL.revokeObjectURL(video.src); throw new Error("Your browser cannot safely compress video. Please upload photos instead."); }
    const stream = capture.captureStream();
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_200_000, audioBitsPerSecond: 64_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const done = new Promise<void>((resolve, reject) => { recorder.onstop = () => resolve(); recorder.onerror = () => reject(new Error("Video compression failed")); });
    recorder.start(1000); await video.play(); await new Promise<void>((resolve) => { video.onended = () => resolve(); }); recorder.stop(); await done;
    stream.getTracks().forEach((track) => track.stop()); URL.revokeObjectURL(video.src);
    return new File(chunks, `${baseName(file.name)}.webm`, { type: "video/webm", lastModified: file.lastModified });
}

function baseName(name: string) { return name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80); }
