import { auth } from "@/auth";
import { headers } from "next/headers";import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const updatedUser = await db
      .update(users)
      .set({ name: name.trim() })
      .where(eq(users.id, session.user.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
      });

    return NextResponse.json({ user: updatedUser[0] });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
