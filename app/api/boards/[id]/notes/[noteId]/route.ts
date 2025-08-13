import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import { notes, users, boards, checklistItems } from "@/lib/db/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: boardId, noteId } = await params;
    const session = await auth();

    // Get the note with user and board info
    const note = await db
      .select({
        id: notes.id,
        content: notes.content,
        color: notes.color,
        boardId: notes.boardId,
        createdBy: notes.createdBy,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        archivedAt: notes.archivedAt,
        deletedAt: notes.deletedAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
        board: {
          id: boards.id,
          isPublic: boards.isPublic,
          organizationId: boards.organizationId,
        },
      })
      .from(notes)
      .innerJoin(users, eq(notes.createdBy, users.id))
      .innerJoin(boards, eq(notes.boardId, boards.id))
      .where(
        and(
          eq(notes.id, noteId),
          eq(notes.boardId, boardId),
          isNull(notes.deletedAt)
        )
      )
      .limit(1);

    if (!note[0]) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Check access permissions
    if (!note[0].board.isPublic) {
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const user = await db
        .select({ organizationId: users.organizationId })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      if (!user[0]?.organizationId || note[0].board.organizationId !== user[0].organizationId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Get checklist items
    const noteChecklistItems = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.noteId, noteId))
      .orderBy(checklistItems.order);

    const noteWithChecklists = {
      ...note[0],
      checklistItems: noteChecklistItems,
    };

    return NextResponse.json({ note: noteWithChecklists });
  } catch (error) {
    console.error("Error fetching note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: boardId, noteId } = await params;
    const { content, color, archivedAt, checklistItems: checklistData } = await request.json();

    // Verify user has access to this note
    const user = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    // Check note exists and user has access
    const noteWithBoard = await db
      .select({
        id: notes.id,
        boardId: notes.boardId,
        board: {
          organizationId: boards.organizationId,
        },
      })
      .from(notes)
      .innerJoin(boards, eq(notes.boardId, boards.id))
      .where(
        and(
          eq(notes.id, noteId),
          eq(notes.boardId, boardId),
          isNull(notes.deletedAt)
        )
      )
      .limit(1);

    if (!noteWithBoard[0]) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (noteWithBoard[0].board.organizationId !== user[0].organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Update note
    interface ChecklistItemInput {
      text: string;
      completed?: boolean;
    }

    const updateData: Partial<{
      content: string;
      color: string;
      archivedAt: Date | null;
    }> = {};
    if (content !== undefined) updateData.content = content;
    if (color !== undefined) updateData.color = color;
    if (archivedAt !== undefined) updateData.archivedAt = archivedAt;

    await db
      .update(notes)
      .set(updateData)
      .where(eq(notes.id, noteId));

    // Handle checklist items if provided
    if (checklistData && Array.isArray(checklistData)) {
      // Delete existing checklist items
      await db
        .delete(checklistItems)
        .where(eq(checklistItems.noteId, noteId));

      // Insert new checklist items
      if (checklistData.length > 0) {
        await db
          .insert(checklistItems)
          .values(
            checklistData.map((item: ChecklistItemInput, index: number) => ({
              id: crypto.randomUUID(),
              noteId,
              text: item.text,
              completed: item.completed || false,
              order: index,
              updatedAt: new Date(),
              content: item.text // Required field that maps to text
            }))
          );
      }
    }

    // Get updated note with user and checklist items
    const updatedNote = await db
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
      })
      .from(notes)
      .innerJoin(users, eq(notes.createdBy, users.id))
      .where(eq(notes.id, noteId))
      .limit(1);

    const updatedChecklistItems = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.noteId, noteId))
      .orderBy(checklistItems.order);

    const noteWithChecklists = {
      ...updatedNote[0],
      checklistItems: updatedChecklistItems,
    };

    return NextResponse.json({ note: noteWithChecklists });
  } catch (error) {
    console.error("Error updating note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: boardId, noteId } = await params;

    // Verify user has access to this note
    const user = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    // Check note exists and user has access
    const noteWithBoard = await db
      .select({
        id: notes.id,
        board: {
          organizationId: boards.organizationId,
        },
      })
      .from(notes)
      .innerJoin(boards, eq(notes.boardId, boards.id))
      .where(
        and(
          eq(notes.id, noteId),
          eq(notes.boardId, boardId),
          isNull(notes.deletedAt)
        )
      )
      .limit(1);

    if (!noteWithBoard[0]) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (noteWithBoard[0].board.organizationId !== user[0].organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Soft delete the note
    await db
      .update(notes)
      .set({ deletedAt: new Date() })
      .where(eq(notes.id, noteId));

    return NextResponse.json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
