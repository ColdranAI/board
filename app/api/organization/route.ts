import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users, organizations } from "@/lib/db/schema";

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, slackWebhookUrl } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    // Get user with organization access check
    const user = await db
      .select({
        id: users.id,
        isAdmin: users.isAdmin,
        organizationId: users.organizationId,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    if (!user[0].isAdmin) {
      return NextResponse.json({ error: "Only admins can update organization settings" }, { status: 403 });
    }

    // Update organization
    await db
      .update(organizations)
      .set({
        name: name.trim(),
        slackWebhookUrl: slackWebhookUrl?.trim() || null,
      })
      .where(eq(organizations.id, user[0].organizationId));

    // Get updated user with organization
    const updatedUser = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isAdmin: users.isAdmin,
        organizationId: users.organizationId,
        organization: {
          id: organizations.id,
          name: organizations.name,
          slackWebhookUrl: organizations.slackWebhookUrl,
        },
      })
      .from(users)
      .leftJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.id, session.user.id))
      .limit(1);

    return NextResponse.json({ user: updatedUser[0] });
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
