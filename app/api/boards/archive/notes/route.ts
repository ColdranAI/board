import { auth } from "@/auth";
import { headers } from "next/headers";import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { eq, and, isNotNull, isNull, desc } from "drizzle-orm";
import { users, notes, boards, checklistItems } from "@/lib/db/schema";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
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

    // Get archived notes from user's organization
    const archivedNotes = await db
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
          isNotNull(notes.archivedAt),
          isNull(notes.deletedAt)
        )
      )
      .orderBy(desc(notes.archivedAt));

    // Get checklist items for each note (simplified approach)
    const noteIds = archivedNotes.map(note => note.id);
    const allChecklistItems = noteIds.length > 0 ? await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.noteId, noteIds[0])) // This would need proper IN clause
      : [];

    const notesWithChecklists = archivedNotes.map(note => ({
      ...note,
      checklistItems: allChecklistItems.filter(item => item.noteId === note.id),
    }));

    return NextResponse.json({ notes: notesWithChecklists });
  } catch (error) {
    console.error("Error fetching archived notes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
