import { auth } from "@/auth";
import { headers } from "next/headers";import { db } from "@/lib/db";
import { users, organizations, organizationSelfServeInvites } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";

// Generate a cryptographically secure token using nanoid
function generateSecureToken(): string {
  return nanoid(32); // 32 characters, URL-safe
}

// Get all active self-serve invites for the organization
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user with organization
    const userResult = await db
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

    const user = userResult[0];

    if (!user?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Get all active self-serve invites for this organization
    const selfServeInvitesResult = await db
      .select({
        token: organizationSelfServeInvites.token,
        name: organizationSelfServeInvites.name,
        organizationId: organizationSelfServeInvites.organizationId,
        createdBy: organizationSelfServeInvites.createdBy,
        expiresAt: organizationSelfServeInvites.expiresAt,
        usageLimit: organizationSelfServeInvites.usageLimit,
        usageCount: organizationSelfServeInvites.usageCount,
        isActive: organizationSelfServeInvites.isActive,
        createdAt: organizationSelfServeInvites.createdAt,
        user: {
          name: users.name,
          email: users.email,
        },
      })
      .from(organizationSelfServeInvites)
      .leftJoin(users, eq(organizationSelfServeInvites.createdBy, users.id))
      .where(
        and(
          eq(organizationSelfServeInvites.organizationId, user.organizationId),
          eq(organizationSelfServeInvites.isActive, true)
        )
      )
      .orderBy(desc(organizationSelfServeInvites.createdAt));

    return NextResponse.json({ selfServeInvites: selfServeInvitesResult });
  } catch (error) {
    console.error("Error fetching self-serve invites:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Create a new self-serve invite
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, expiresAt, usageLimit } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Invite name is required" }, { status: 400 });
    }

    // Get user with organization
    const userResult = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
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

    const user = userResult[0];

    if (!user?.organizationId || !user.organization) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Only admins can create self-serve invites
    if (!user.isAdmin) {
      return NextResponse.json(
        { error: "Only admins can create self-serve invites" },
        { status: 403 }
      );
    }

    // Parse expiration date if provided
    let expirationDate = null;
    if (expiresAt) {
      // Parse as date and set to end of day (23:59:59.999)
      expirationDate = new Date(expiresAt);
      expirationDate.setHours(23, 59, 59, 999);

      if (isNaN(expirationDate.getTime()) || expirationDate <= new Date()) {
        return NextResponse.json(
          { error: "Expiration date must be in the future" },
          { status: 400 }
        );
      }
    }

    // Validate usage limit if provided
    let validUsageLimit = null;
    if (usageLimit !== undefined && usageLimit !== null) {
      const limit = parseInt(usageLimit);
      if (isNaN(limit) || limit < 1) {
        return NextResponse.json(
          { error: "Usage limit must be a positive number" },
          { status: 400 }
        );
      }
      validUsageLimit = limit;
    }

    // Generate token and id
    const token = generateSecureToken();
    const inviteId = crypto.randomUUID();

    // Create the self-serve invite
    const selfServeInviteResult = await db
      .insert(organizationSelfServeInvites)
      .values({
        id: inviteId,
        token: token,
        name: name.trim(),
        organizationId: user.organizationId,
        createdBy: session.user.id,
        expiresAt: expirationDate,
        usageLimit: validUsageLimit,
        usageCount: 0,
        isActive: true,
        createdAt: new Date(),
      })
      .returning();


    // Get the created invite with user info
    const inviteWithUserResult = await db
      .select({
        token: organizationSelfServeInvites.token,
        name: organizationSelfServeInvites.name,
        organizationId: organizationSelfServeInvites.organizationId,
        createdBy: organizationSelfServeInvites.createdBy,
        expiresAt: organizationSelfServeInvites.expiresAt,
        usageLimit: organizationSelfServeInvites.usageLimit,
        usageCount: organizationSelfServeInvites.usageCount,
        isActive: organizationSelfServeInvites.isActive,
        createdAt: organizationSelfServeInvites.createdAt,
        user: {
          name: users.name,
          email: users.email,
        },
      })
      .from(organizationSelfServeInvites)
      .leftJoin(users, eq(organizationSelfServeInvites.createdBy, users.id))
      .where(eq(organizationSelfServeInvites.token, token))
      .limit(1);

    return NextResponse.json({ selfServeInvite: inviteWithUserResult[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating self-serve invite:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
