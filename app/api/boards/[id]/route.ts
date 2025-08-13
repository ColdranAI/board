import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { boards, organizations, users } from "@/lib/db/schema";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const boardId = (await params).id;

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
          createdAt: organizations.createdAt,
          updatedAt: organizations.updatedAt,
          slackWebhookUrl: organizations.slackWebhookUrl,
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

    if (boardData.isPublic) {
      const { organization, ...restBoardData } = boardData;
      return NextResponse.json({
        board: {
          ...restBoardData,
          organization: {
            id: organization?.id,
            name: organization?.name,
          },
        },
      });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is member of the organization
    const members = await db
      .select({
        id: users.id,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.organizationId, boardData.organizationId!));

    const isMember = members.some((member) => member.id === session?.user?.id);

    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Return board data without sensitive organization member details
    const { organization, ...restBoardData } = boardData;

    return NextResponse.json({
      board: {
        ...restBoardData,
        organization: {
          id: organization?.id,
          name: organization?.name,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching board:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const boardId = (await params).id;
    const { name, description, sendSlackUpdates } = await request.json();

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

    // For name/description updates, check if user can edit this board (board creator or admin)
    if (
      (name !== undefined || description !== undefined) &&
      boardData.createdBy !== session.user.id &&
      !currentUser.isAdmin
    ) {
      return NextResponse.json(
        { error: "Only the board creator or admin can edit this board" },
        { status: 403 }
      );
    }

    const updateData: {
      name?: string;
      description?: string;
      sendSlackUpdates?: boolean;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };
    if (name !== undefined) updateData.name = name?.trim() || boardData.name;
    if (description !== undefined)
      updateData.description = description?.trim() || boardData.description;
    if (sendSlackUpdates !== undefined) updateData.sendSlackUpdates = sendSlackUpdates;

    const updatedBoard = await db
      .update(boards)
      .set(updateData)
      .where(eq(boards.id, boardId))
      .returning();

    if (!updatedBoard || updatedBoard.length === 0) {
      return NextResponse.json({ error: "Failed to update board" }, { status: 500 });
    }

    // Get the updated board with organization info
    const boardWithOrg = await db
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

    return NextResponse.json({ board: boardWithOrg[0] });
  } catch (error) {
    console.error("Error updating board:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        name: users.name,
        email: users.email,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.organizationId, boardData.organizationId!));

    const currentUser = members.find((member) => member.id === session?.user?.id);

    if (!currentUser) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Check if user can delete this board (board creator or admin)
    if (boardData.createdBy !== session.user.id && !currentUser.isAdmin) {
      return NextResponse.json(
        { error: "Only the board creator or admin can delete this board" },
        { status: 403 }
      );
    }

    // Delete the board
    await db.delete(boards).where(eq(boards.id, boardId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting board:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
