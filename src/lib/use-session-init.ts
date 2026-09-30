"use client";

import { useEffect } from "react";

/**
 * Hook to initialize session token (sets HttpOnly cookie)
 * Should be called once at app startup
 */
export function useSessionInit() {
    useEffect(() => {
        // Initialize session by calling the init endpoint
        // This sets the HttpOnly cookie on the server
        const initSession = async () => {
            try {
                await fetch("/api/session/init", { method: "GET", credentials: "include" });
            } catch (err) {
                console.error("Failed to initialize session:", err);
                // Session init failure is not critical - will fail on first real request
            }
        };
        
        initSession();
    }, []);
}
