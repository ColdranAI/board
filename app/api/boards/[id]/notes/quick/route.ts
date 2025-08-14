import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { NOTE_COLORS } from "@/lib/constants";
import { eq } from "drizzle-orm";
import { boards, notes, users } from "@/lib/db/schema";

// Quick note creation endpoint for fast UI interactions
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const boardId = (await params).id;

    // Verify user has access to this board (same organization)
    const user = await db
      .select({
        organizationId: users.organizationId,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    const board = await db
      .select({
        id: boards.id,
        organizationId: boards.organizationId,
      })
      .from(boards)
      .where(eq(boards.id, boardId))
      .limit(1);

    if (!board[0]) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    if (board[0].organizationId !== user[0].organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Create note with minimal data for fast creation
    const randomColor = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
    const noteId = crypto.randomUUID();

    const note = await db
      .insert(notes)
      .values({
        id: noteId,
        content: "", // Empty content for quick creation
        color: randomColor,
        boardId,
        createdBy: session.user.id,
        updatedAt: new Date(),
      })
      .returning();

    // Return minimal note data for immediate UI update
    const noteWithUser = {
      id: note[0].id,
      content: note[0].content,
      color: note[0].color,
      boardId: note[0].boardId,
      createdBy: note[0].createdBy,
      createdAt: note[0].createdAt,
      updatedAt: note[0].updatedAt,
      archivedAt: note[0].archivedAt,
      user: {
        id: session.user.id,
        name: user[0].name,
        email: user[0].email,
      },
      checklistItems: [],
    };

    return NextResponse.json({ note: noteWithUser }, { status: 201 });
  } catch (error) {
    console.error("Error creating quick note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}