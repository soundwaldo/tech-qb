import { getCurrentUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { createBillingPortalSession } from "@/lib/stripe";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const rows = await db`
    SELECT o.stripe_customer_id
    FROM profiles p JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = ${user.id} LIMIT 1
  `;
  const customerId = rows[0]?.stripe_customer_id;
  if (!customerId) return Response.json({ error: "No Stripe billing account is connected" }, { status: 409 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  try {
    const session = await createBillingPortalSession({ customerId: String(customerId), returnUrl: `${appUrl}/portal/dashboard` });
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Stripe billing portal error:", error);
    return Response.json({ error: "Billing portal could not be opened" }, { status: 502 });
  }
}
