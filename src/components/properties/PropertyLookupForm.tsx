"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function PropertyLookupForm() {
    const router = useRouter();
    const [address, setAddress] = useState("");
    const [zipCode, setZipCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/properties/lookup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address, zipCode }),
            });
            const body = await response.json() as { propertyUrl?: string; error?: string };
            if (!response.ok || !body.propertyUrl) throw new Error(body.error || "Registry lookup failed.");
            router.push(body.propertyUrl);
        } catch (lookupError) {
            setError(lookupError instanceof Error ? lookupError.message : "Registry lookup failed.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={submit} className="mt-6 space-y-4">
            <Input label="Street address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="123 Main St, Unit 2" autoComplete="street-address" required />
            <Input label="ZIP code" value={zipCode} onChange={(event) => setZipCode(event.target.value)} placeholder="85001" inputMode="numeric" autoComplete="postal-code" required />
            {error ? <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
            <Button type="submit" loading={loading} className="w-full">Find property UUID</Button>
        </form>
    );
}
