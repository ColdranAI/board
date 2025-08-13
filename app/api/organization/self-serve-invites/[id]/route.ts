import { auth } from "@/auth";
import { headers } from "next/headers";import { db } from "@/lib/db";
import { users, organizations, organizationSelfServeInvites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

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
    const userResult = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        isAdmin: users.isAdmin,
        organization: {
          id: organizations.id,
          name: organizations.name,
        },
      })
      .from(users)
      .leftJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.id, session.user.id))
      .limit(1);

    const user = userResult[0];

    if (!user?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Only admins can delete self-serve invites
    if (!user.isAdmin) {
      return NextResponse.json(
        { error: "Only admins can delete self-serve invites" },
        { status: 403 }
      );
    }

    // Verify the invite belongs to this organization
    const inviteResult = await db
      .select({
        token: organizationSelfServeInvites.token,
        organizationId: organizationSelfServeInvites.organizationId,
      })
      .from(organizationSelfServeInvites)
      .where(eq(organizationSelfServeInvites.token, inviteId))
      .limit(1);

    const invite = inviteResult[0];

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Delete the invite
    await db
      .delete(organizationSelfServeInvites)
      .where(eq(organizationSelfServeInvites.token, inviteId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting self-serve invite:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
