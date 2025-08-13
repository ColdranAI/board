import { auth } from "@/auth";
import { headers } from "next/headers";import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { boards, organizations, users } from "@/lib/db/schema";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { isPublic } = await request.json();
    const boardId = (await params).id;

    // Check if board exists and user has access
    const board = await db
      .select({
        id: boards.id,
        name: boards.name,
        description: boards.description,
        isPublic: boards.isPublic,
        sendSlackUpdates: boards.sendSlackUpdates,
        organizationId: boards.organizationId,
        createdBy: boards.createdBy,
        createdAt: boards.createdAt,
        updatedAt: boards.updatedAt,
        organization: {
          id: organizations.id,
          name: organizations.name,
        },
      })
      .from(boards)
      .leftJoin(organizations, eq(boards.organizationId, organizations.id))
      .where(eq(boards.id, boardId))
      .limit(1);

    if (!board || board.length === 0) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const boardData = board[0];

    // Check if user is member of the organization
    const members = await db
      .select({
        id: users.id,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.organizationId, boardData.organizationId!));

    const currentUser = members.find((member) => member.id === session?.user?.id);

    if (!currentUser) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (boardData.createdBy !== session.user.id && !currentUser.isAdmin) {
      return NextResponse.json(
        { error: "Only the board creator or admin can modify board settings" },
        { status: 403 }
      );
    }

    const updatedBoard = await db
      .update(boards)
      .set({ 
        isPublic: Boolean(isPublic),
        updatedAt: new Date()
      })
      .where(eq(boards.id, boardId))
      .returning();

    return NextResponse.json({ board: updatedBoard[0] });
  } catch (error) {
    console.error("Error updating board public status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
