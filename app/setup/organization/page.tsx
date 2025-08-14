import { auth } from "@/auth";
import { headers } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, organizations, organizationInvites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import OrganizationSetupForm from "./form";
import { env } from "@/lib/env";

const resend = new Resend(process.env.AUTH_RESEND_KEY);

async function createOrganization(orgName: string, teamEmails: string[]) {
  "use server";

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
  redirect("/auth/signin");
}

  if (!orgName?.trim()) {
    throw new Error("Organization name is required");
  }

  const organizationResult = await db
    .insert(organizations)
    .values({
      id: crypto.randomUUID(),
      name: orgName.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const organization = organizationResult[0];

  await db
    .update(users)
    .set({
      organizationId: organization.id,
      isAdmin: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  if (teamEmails.length > 0) {
    for (const email of teamEmails) {
      try {
        const inviteResult = await db
          .insert(organizationInvites)
          .values({
            id: crypto.randomUUID(),
            email,
            organizationId: organization.id,
            invitedBy: session.user.id!,
            createdAt: new Date(),
          })
          .returning();

        const invite = inviteResult[0];

        await resend.emails.send({
          from: env.EMAIL_FROM!,
          to: email,
          subject: `${session.user.name} invited you to join ${orgName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You&apos;re invited to join ${orgName}!</h2>
              <p>${session.user.name} (${session.user.email}) has invited you to join their organization on Coldboard.</p>
              <p>Click the link below to accept the invitation:</p>
              <a href="${env.NEXT_PUBLIC_BETTER_AUTH_URL}/invite/accept?token=${invite.id}"
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Accept Invitation
              </a>
              <p style="margin-top: 20px; color: #666;">
                If you don&apos;t want to receive these emails, please ignore this message.
              </p>
            </div>
          `,
        });
      } catch (error) {
        console.error(`Failed to send invite to ${email}:`, error);
      }
    }
  }

  redirect("/dashboard");
}

export default async function OrganizationSetup() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (!session.user.name) {
    redirect("/setup/profile");
  }

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
    .where(eq(users.id, String(session.user.id)))
    .limit(1);

  const user = userResult[0];

  if (user?.organization) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br flex justify-center items-center from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-950">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-sm sm:max-w-md  mx-auto space-y-6 sm:space-y-8">
          <Card className="border bg-white dark:bg-zinc-900 border-neutral-200 dark:border-zinc-800">
            <CardTitle className="px-5">
              Getting Started
            </CardTitle>
            <CardContent>
              <OrganizationSetupForm onSubmit={createOrganization} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
