import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { eq, count, desc } from "drizzle-orm";
import { users, boards, notes } from "@/lib/db/schema";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Get all boards for the organization with note count
    const boardsWithCounts = await db
      .select({
        id: boards.id,
        name: boards.name,
        description: boards.description,
        isPublic: boards.isPublic,
        createdBy: boards.createdBy,
        createdAt: boards.createdAt,
        updatedAt: boards.updatedAt,
        noteCount: count(notes.id),
      })
      .from(boards)
      .leftJoin(notes, eq(boards.id, notes.boardId))
      .where(eq(boards.organizationId, user[0].organizationId))
      .groupBy(boards.id)
      .orderBy(desc(boards.createdAt));

    // Transform to match expected format
    const boardsFormatted = boardsWithCounts.map(board => ({
      ...board,
      _count: {
        notes: board.noteCount,
      },
    }));

    return NextResponse.json({ boards: boardsFormatted });
  } catch (error) {
    console.error("Error fetching boards:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, description, isPublic } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Board name is required" }, { status: 400 });
    }

    const user = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Create new board
    const board = await db
      .insert(boards)
      .values({
        id: crypto.randomUUID(),
        name,
        description,
        isPublic: Boolean(isPublic || false),
        organizationId: user[0].organizationId,
        createdBy: session.user.id,
        updatedAt: new Date(),
      })
      .returning({
        id: boards.id,
        name: boards.name,
        description: boards.description,
        isPublic: boards.isPublic,
        createdBy: boards.createdBy,
        createdAt: boards.createdAt,
        updatedAt: boards.updatedAt,
        organizationId: boards.organizationId,
      });

    // Add note count (0 for new board)
    const boardWithCount = {
      ...board[0],
      _count: {
        notes: 0,
      },
    };

    return NextResponse.json({ board: boardWithCount }, { status: 201 });
  } catch (error) {
    console.error("Error creating board:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
