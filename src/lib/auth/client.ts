"use client";

import { createAuthClient } from "@neondatabase/auth";

function getAuthBaseUrl(): string {
  const origin = typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${origin.replace(/\/$/, "")}/api/auth`;
}

export const authClient = createAuthClient(getAuthBaseUrl());
