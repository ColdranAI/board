import { auth } from "@/auth";
import { headers } from "next/headers";import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users, organizationInvites } from "@/lib/db/schema";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const user = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Get all invites for the organization
    const invites = await db
      .select()
      .from(organizationInvites)
      .where(eq(organizationInvites.organizationId, user[0].organizationId));

    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Error fetching invites:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
