import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  sendSlackMessage,
  formatNoteForSlack,
  hasValidContent,
  shouldSendNotification,
} from "@/lib/slack";
import { NOTE_COLORS } from "@/lib/constants";
import { eq, and, isNull, desc, asc } from "drizzle-orm";
import { boards, notes, users, organizations, checklistItems } from "@/lib/db/schema";

// Get all notes for a board
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const boardId = (await params).id;

    const board = await db
      .select({
        id: boards.id,
        isPublic: boards.isPublic,
        organizationId: boards.organizationId,
      })
      .from(boards)
      .where(eq(boards.id, boardId))
      .limit(1);

    if (!board[0]) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    // Get notes for the board
    const boardNotes = await db
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
      .where(
        and(
          eq(notes.boardId, boardId),
          isNull(notes.deletedAt),
          isNull(notes.archivedAt)
        )
      )
      .orderBy(desc(notes.createdAt));

    // Get checklist items for each note
    const noteIds = boardNotes.map(note => note.id);
    const checklistItemsData = noteIds.length > 0 ? await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.noteId, noteIds[0])) // This would need to be done for each note
      .orderBy(asc(checklistItems.order)) : [];

    // Combine notes with their checklist items
    const notesWithChecklists = boardNotes.map(note => ({
      ...note,
      checklistItems: checklistItemsData.filter(item => item.noteId === note.id),
    }));

    if (board[0].isPublic) {
      return NextResponse.json({ notes: notesWithChecklists });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    if (board[0].organizationId !== user[0].organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ notes: notesWithChecklists });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Create a new note
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, color } = await request.json();
    const boardId = (await params).id;

    // Verify user has access to this board (same organization)
    const user = await db
      .select({
        organizationId: users.organizationId,
        name: users.name,
        email: users.email,
        organization: {
          slackWebhookUrl: organizations.slackWebhookUrl,
        },
      })
      .from(users)
      .leftJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    const board = await db
      .select({
        id: boards.id,
        name: boards.name,
        organizationId: boards.organizationId,
        sendSlackUpdates: boards.sendSlackUpdates,
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

    const randomColor = color || NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];

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

    // Get checklist items (empty for new note)
    const noteWithChecklists = {
      ...noteWithUser[0],
      checklistItems: [],
    };

    if (
      user[0].organization?.slackWebhookUrl &&
      hasValidContent(content) &&
      shouldSendNotification(session.user.id, boardId, board[0].name, board[0].sendSlackUpdates)
    ) {
      const slackMessage = formatNoteForSlack(noteWithChecklists, board[0].name, user[0].name || user[0].email);
      const messageId = await sendSlackMessage(user[0].organization.slackWebhookUrl, {
        text: slackMessage,
        username: "Coldboard",
        icon_emoji: ":clipboard:",
      });

      if (messageId) {
        await db
          .update(notes)
          .set({ slackMessageId: messageId })
          .where(eq(notes.id, note[0].id));
      }
    }

    return NextResponse.json({ note: noteWithChecklists }, { status: 201 });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
