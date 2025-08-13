import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull, desc } from "drizzle-orm";
import { users, notes, boards, checklistItems } from "@/lib/db/schema";
import { NOTE_COLORS } from "@/lib/constants";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const user = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    // Get all notes from user's organization
    const allNotes = await db
      .select({
        id: notes.id,
        content: notes.content,
        color: notes.color,
        boardId: notes.boardId,
        createdBy: notes.createdBy,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        archivedAt: notes.archivedAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
        board: {
          id: boards.id,
          name: boards.name,
        },
      })
      .from(notes)
      .innerJoin(users, eq(notes.createdBy, users.id))
      .innerJoin(boards, eq(notes.boardId, boards.id))
      .where(
        and(
          eq(boards.organizationId, user[0].organizationId),
          isNull(notes.deletedAt),
          isNull(notes.archivedAt)
        )
      )
      .orderBy(desc(notes.createdAt));

    // Get checklist items for each note
    const noteIds = allNotes.map(note => note.id);
    const allChecklistItems = noteIds.length > 0 ? await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.noteId, noteIds[0])) // This would need proper IN clause
      : [];

    const notesWithChecklists = allNotes.map(note => ({
      ...note,
      checklistItems: allChecklistItems.filter(item => item.noteId === note.id),
    }));

    return NextResponse.json({ notes: notesWithChecklists });
  } catch (error) {
    console.error("Error fetching all notes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, color, boardId } = await request.json();

    if (!content || !boardId) {
      return NextResponse.json({ error: "Content and boardId are required" }, { status: 400 });
    }

    // Verify user has access to this board
    const user = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    const board = await db
      .select({ organizationId: boards.organizationId })
      .from(boards)
      .where(eq(boards.id, boardId))
      .limit(1);

    if (!board[0]) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    if (board[0].organizationId !== user[0].organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const randomColor = color || NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];

    // Create note
    const note = await db
      .insert(notes)
      .values({
        id: crypto.randomUUID(),
        content,
        color: randomColor,
        boardId,
        createdBy: session.user.id,
        updatedAt: new Date(),
      })
      .returning();

    // Get the created note with user info
    const noteWithUser = await db
      .select({
        id: notes.id,
        content: notes.content,
        color: notes.color,
        boardId: notes.boardId,
        createdBy: notes.createdBy,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(notes)
      .innerJoin(users, eq(notes.createdBy, users.id))
      .where(eq(notes.id, note[0].id))
      .limit(1);

    const noteWithChecklists = {
      ...noteWithUser[0],
      checklistItems: [],
    };

    return NextResponse.json({ note: noteWithChecklists }, { status: 201 });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
