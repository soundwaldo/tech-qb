import { SubmitRepairForm } from "./SubmitRepairForm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";

export default async function SubmitRepairPage({
    searchParams,
}: {
    searchParams?: Promise<{ invite?: string }>;
}) {
    const query = await searchParams;
    const user = await getCurrentUser();
    if (!user?.id) {
        const destination = query?.invite
            ? `/submit-repair?invite=${encodeURIComponent(query.invite)}`
            : "/submit-repair";
        redirect(`/auth/sign-in?next=${encodeURIComponent(destination)}`);
    }
    return <SubmitRepairForm initialInviteToken={query?.invite || ""} />;
}
