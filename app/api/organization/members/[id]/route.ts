import { auth } from "@/auth";
import { headers } from "next/headers";import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users, organizations } from "@/lib/db/schema";

// Update member (toggle admin role)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { isAdmin } = await request.json();
    const memberId = (await params).id;

    // Get current user with organization
    const currentUser = await db
      .select({
        id: users.id,
        isAdmin: users.isAdmin,
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

    if (!currentUser[0]?.organizationId || !currentUser[0].organization) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Only admins or the first user (organization creator) can change admin roles
    if (!currentUser[0].isAdmin) {
      return NextResponse.json({ error: "Only admins can change member roles" }, { status: 403 });
    }

    // Get the member to update
    const member = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
      })
      .from(users)
      .where(eq(users.id, memberId))
      .limit(1);

    if (!member[0]) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Check if member belongs to the same organization
    if (member[0].organizationId !== currentUser[0].organizationId) {
      return NextResponse.json({ error: "Member not in your organization" }, { status: 403 });
    }

    // Update the member's admin status
    const updatedMember = await db
      .update(users)
      .set({ isAdmin: typeof isAdmin === "boolean" ? isAdmin : false })
      .where(eq(users.id, memberId))
      .returning();

    return NextResponse.json({ member: updatedMember[0] });
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Remove member from organization
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberId = (await params).id;

    // Get current user with organization
    const currentUser = await db
      .select({
        id: users.id,
        isAdmin: users.isAdmin,
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

    if (!currentUser[0]?.organizationId || !currentUser[0].organization) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Only admins can remove members
    if (!currentUser[0].isAdmin) {
      return NextResponse.json({ error: "Only admins can remove members" }, { status: 403 });
    }

    // Get the member to remove
    const member = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
      })
      .from(users)
      .where(eq(users.id, memberId))
      .limit(1);

    if (!member[0]) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Check if member belongs to the same organization
    if (member[0].organizationId !== currentUser[0].organizationId) {
      return NextResponse.json({ error: "Member not in your organization" }, { status: 403 });
    }

    // Can't remove yourself
    if (member[0].id === currentUser[0].id) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }

    // Remove member from organization
    await db
      .update(users)
      .set({
        organizationId: null,
        isAdmin: false, // Reset admin status when leaving organization
      })
      .where(eq(users.id, memberId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
