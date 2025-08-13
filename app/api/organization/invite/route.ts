import { auth } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { eq, and } from "drizzle-orm";
import { users, organizations, organizationInvites } from "@/lib/db/schema";

const resend = new Resend(env.AUTH_RESEND_KEY);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Get user with organization
    const user = await db
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

    if (!user[0]?.organizationId || !user[0].organization) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Only admins can invite new members
    if (!user[0].isAdmin) {
      return NextResponse.json({ error: "Only admins can invite new members" }, { status: 403 });
    }

    // Check if user is already in the organization
    const existingUser = await db
      .select({ id: users.id, organizationId: users.organizationId })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (existingUser[0] && existingUser[0].organizationId === user[0].organizationId) {
      return NextResponse.json(
        { error: "User is already a member of this organization" },
        { status: 400 }
      );
    }

    // Check if there's already a pending invite
    const existingInvite = await db
      .select({ id: organizationInvites.id, status: organizationInvites.status })
      .from(organizationInvites)
      .where(
        and(
          eq(organizationInvites.email, cleanEmail),
          eq(organizationInvites.organizationId, user[0].organizationId)
        )
      )
      .limit(1);

    if (existingInvite[0] && existingInvite[0].status === "PENDING") {
      return NextResponse.json({ error: "Invite already sent to this email" }, { status: 400 });
    }

    // Create or update the invite
    let invite;
    if (existingInvite[0]) {
      invite = await db
        .update(organizationInvites)
        .set({
          status: "PENDING",
          createdAt: new Date(),
        })
        .where(eq(organizationInvites.id, existingInvite[0].id))
        .returning();
    } else {
      invite = await db
        .insert(organizationInvites)
        .values({
          id: crypto.randomUUID(),
          email: cleanEmail,
          organizationId: user[0].organizationId,
          invitedBy: session.user.id,
          status: "PENDING",
        })
        .returning();
    }

    // Send invite email
    try {
      await resend.emails.send({
        from: env.EMAIL_FROM,
        to: cleanEmail,
        subject: `${session.user.name} invited you to join ${user[0].organization.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You're invited to join ${user[0].organization.name}!</h2>
            <p>${session.user.name} (${session.user.email}) has invited you to join their organization on Coldboard.</p>
            <p>Click the link below to accept the invitation:</p>
            <a href="${env.AUTH_URL}/invite/accept?token=${invite[0].id}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
            <p style="margin-top: 20px; color: #666;">
              If you don't want to receive these emails, please ignore this message.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send invite email:", emailError);
      // Don't fail the entire request if email sending fails
    }

    return NextResponse.json({ invite: invite[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating invite:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
