import { auth } from "@/auth";
import { headers } from "next/headers";import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users, organizations, organizationInvites } from "@/lib/db/schema";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inviteId = (await params).id;

    // Get user with organization
    const user = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        organization: {
          id: organizations.id,
          name: organizations.name,
        },
      })
      .from(users)
      .leftJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Verify the invite belongs to this organization
    const invite = await db
      .select({
        id: organizationInvites.id,
        organizationId: organizationInvites.organizationId,
      })
      .from(organizationInvites)
      .where(eq(organizationInvites.id, inviteId))
      .limit(1);

    if (!invite[0]) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite[0].organizationId !== user[0].organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Delete the invite
    await db
      .delete(organizationInvites)
      .where(eq(organizationInvites.id, inviteId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invite:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
