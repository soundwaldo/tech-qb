export const preDispatchFlags = {
  enabled: process.env.PRE_DISPATCH_ENABLED === "true",
  onboarding: process.env.PRE_DISPATCH_ONBOARDING_ENABLED === "true",
  submissions: process.env.PRE_DISPATCH_SUBMISSIONS_ENABLED === "true",
  webhooks: process.env.PRE_DISPATCH_WEBHOOKS_ENABLED === "true",
  aiAnalysis: process.env.PRE_DISPATCH_AI_ANALYSIS_ENABLED === "true",
  email: process.env.PRE_DISPATCH_EMAIL_ENABLED === "true",
  maintenanceRecords: process.env.PRE_DISPATCH_MAINTENANCE_RECORDS_ENABLED === "true",
  worker: process.env.PRE_DISPATCH_WORKER_ENABLED === "true",
};

export const uploadLimits = {
  maxPhotos: 5,
  maxVideos: 1,
  maxPhotoBytes: Number(process.env.PRE_DISPATCH_MAX_PHOTO_BYTES || 10 * 1024 * 1024),
  maxVideoBytes: Number(process.env.PRE_DISPATCH_MAX_VIDEO_BYTES || 100 * 1024 * 1024),
  sessionMinutes: 30,
} as const;

export const acceptedMediaTypes = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"] as const;
