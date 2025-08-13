import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user with organization and members
    const userResult = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
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

    const user = userResult[0];

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get organization members if user has an organization
    let organizationMembers: {
      id: string;
      name: string | null;
      image: string | null;
      email: string;
      isAdmin: boolean;
    }[] = [];
    if (user.organizationId) {
      const membersResult = await db
        .select({
          id: users.id,
          name: users.name,
          image: users.image,
          email: users.email,
          isAdmin: users.isAdmin,
        })
        .from(users)
        .where(eq(users.organizationId, user.organizationId));
      
      organizationMembers = membersResult;
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      isAdmin: user.isAdmin,
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            slackWebhookUrl: user.organization.slackWebhookUrl,
            members: organizationMembers,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
