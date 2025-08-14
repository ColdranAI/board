"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { BetaBadge } from "@/components/ui/beta-badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Grid3x3, Copy, Edit3, Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { FullPageLoader } from "@/components/ui/loader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { User, Board } from "@/components/note";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ProfileDropdown } from "@/components/profile-dropdown";

// Dashboard-specific extended types
export type DashboardBoard = Board & {
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  _count: { notes: number };
};

const formSchema = z.object({
  name: z.string().min(1, "Board name is required"),
  description: z.string().optional(),
});

// -------------------------------------------------------------
// Dashed "Create board" card
// -------------------------------------------------------------
function AddBoardCard({ onClick }: { onClick: () => void }) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={[
        "group h-40 cursor-pointer",
        "border-2 border-dashed",
        "border-neutral-300 dark:border-zinc-800",
        "bg-transparent hover:bg-neutral-50/60 dark:hover:bg-zinc-900/50",
        "transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-zinc-600",
      ].join(" ")}
      title="Create a new board"
    >
      <CardHeader className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-neutral-600 dark:text-neutral-300">
                  <div className="p-3 rounded-full bg-neutral-200/50 dark:bg-neutral-700/50 group-hover:bg-neutral-200 dark:group-hover:bg-blue-800/50 transition-all duration-200">


          <Plus className="w-6 h-6" />
        </div>
          <CardTitle className="text-base font-medium">Create board</CardTitle>
        </div>
      </CardHeader>
    </Card>
  );
}

export default function Dashboard() {
  const [boards, setBoards] = useState<DashboardBoard[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddBoardDialogOpen, setIsAddBoardDialogOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    boardId: string;
    boardName: string;
  }>({ open: false, boardId: "", boardName: "" });
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({ open: false, title: "", description: "" });
  const [copiedBoardId, setCopiedBoardId] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const fetchUserAndBoards = useCallback(async () => {
    try {
      const userResponse = await fetch("/api/user");
      if (userResponse.status === 401) {
        router.push("/auth/signin");
        return;
      }

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData);
        if (!userData.name) {
          router.push("/setup/profile");
          return;
        }
        if (!userData.organization) {
          router.push("/setup/organization");
          return;
        }
      }

      const boardsResponse = await fetch("/api/boards");
      if (boardsResponse.ok) {
        const { boards } = await boardsResponse.json();
        setBoards(boards);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUserAndBoards();
  }, [fetchUserAndBoards]);

  const handleAddBoard = async (values: z.infer<typeof formSchema>) => {
    const { name, description } = values;
    try {
      if (editingBoard) {
        const response = await fetch(`/api/boards/${editingBoard.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            description,
          }),
        });

        if (response.ok) {
          const { board } = await response.json();
          setBoards(boards.map((b) => (b.id === editingBoard.id ? board : b)));
          form.reset();
          setIsAddBoardDialogOpen(false);
          setEditingBoard(null);
        } else {
          const errorData = await response.json();
          setErrorDialog({
            open: true,
            title: "Failed to update board",
            description: errorData.error || "Failed to update board",
          });
        }
      } else {
        const response = await fetch("/api/boards", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            description,
          }),
        });

        if (response.ok) {
          const { board } = await response.json();
          setBoards([board, ...boards]);
          form.reset();
          setIsAddBoardDialogOpen(false);
        } else {
          const errorData = await response.json();
          setErrorDialog({
            open: true,
            title: "Failed to create board",
            description: errorData.error || "Failed to create board",
          });
        }
      }
    } catch (error) {
      console.error("Error adding board:", error);
      setErrorDialog({
        open: true,
        title: editingBoard ? "Failed to update board" : "Failed to create board",
        description: editingBoard ? "Failed to update board" : "Failed to create board",
      });
    }
  };

  const handleEditBoard = (board: DashboardBoard) => {
    setEditingBoard(board);
    form.reset({
      name: board.name,
      description: board.description || "",
    });
    setIsAddBoardDialogOpen(true);
  };

  const handleDeleteBoard = (boardId: string, boardName: string) => {
    setDeleteConfirmDialog({
      open: true,
      boardId,
      boardName,
    });
  };

  const confirmDeleteBoard = async () => {
    try {
      const response = await fetch(`/api/boards/${deleteConfirmDialog.boardId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setBoards(boards.filter((board) => board.id !== deleteConfirmDialog.boardId));
      } else {
        const errorData = await response.json();
        setErrorDialog({
          open: true,
          title: "Failed to delete board",
          description: errorData.error || "Failed to delete board",
        });
      }
    } catch (error) {
      console.error("Error deleting board:", error);
      setErrorDialog({
        open: true,
        title: "Failed to delete board",
        description: "Failed to delete board",
      });
    }
  };

  const handleTogglePublic = async (boardId: string, isPublic: boolean) => {
    try {
      const response = await fetch(`/api/boards/${boardId}/public`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isPublic }),
      });

      if (response.ok) {
        setBoards(boards.map((board) => (board.id === boardId ? { ...board, isPublic } : board)));
      } else {
        const errorData = await response.json();
        setErrorDialog({
          open: true,
          title: "Failed to update board",
          description: errorData.error || "Failed to update board settings",
        });
      }
    } catch (error) {
      console.error("Error updating board:", error);
    }
  };

  const handleCopyPublicUrl = async (boardId: string) => {
    const publicUrl = `${window.location.origin}/public/boards/${boardId}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedBoardId(boardId);
      setTimeout(() => setCopiedBoardId(null), 2000);
    } catch (error) {
      console.error("Failed to copy URL:", error);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsAddBoardDialogOpen(open);
    // Reset form and editing state when the dialog closes
    if (!open) {
      form.reset();
      setEditingBoard(null);
    }
  };

  if (loading) {
    return <FullPageLoader message="Loading dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-background dark:bg-zinc-950">
      <nav className="bg-card dark:bg-zinc-900 border-b border-neutral-200 dark:border-zinc-800 shadow-sm">
        <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                Coldboard
                <BetaBadge />
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <ProfileDropdown user={user} />
          </div>
        </div>
      </nav>

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {boards.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground dark:text-zinc-100">
                Boards
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground dark:text-zinc-400 mt-1">
                Manage your organization&apos;s boards
              </p>
            </div>
          </div>
        )}

        <Dialog open={isAddBoardDialogOpen} onOpenChange={handleOpenChange}>
          <DialogContent className="bg-white dark:bg-zinc-950  sm:max-w-[425px] ">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold mb-4 text-foreground dark:text-zinc-100">
                {editingBoard ? "Edit Board" : "Create New Board"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground dark:text-zinc-400">
                {editingBoard
                  ? "Update the board's name and description."
                  : "Fill out the details to create a new board."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(handleAddBoard)}>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Board Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter board name"
                          className="border border-zinc-200 dark:border-zinc-800 text-muted-foreground dark:text-zinc-200"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter board description"
                          className="border border-zinc-200 dark:border-zinc-800 text-muted-foreground dark:text-zinc-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" className="bg-neutral-600 hover:bg-neutral-700 text-white">
                    {editingBoard ? "Update board" : "Create board"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {boards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
            <Link href="/boards/all-notes">
              <Card className="group cursor-pointer border border-neutral-300 dark:border-neutral-900 bg-gradient-to-br from-neutral-50 to-indigo-50 dark:from-zinc-900 dark:to-zinc-950 dark:hover:bg-zinc-900/75">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Grid3x3 className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                        <CardTitle className="text-lg text-neutral-900 dark:text-neutral-200">
                          All Notes
                        </CardTitle>
                      </div>
                      <CardDescription className="text-neutral-700 dark:text-neutral-300">
                        View notes from all boards
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/boards/archive">
              <Card className="group cursor-pointer bg-neutral-50 dark:bg-zinc-900 border-neutral-200 dark:border-zinc-800 dark:hover:bg-zinc-900/75">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Archive className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                        <CardTitle className="text-lg text-neutral-900 dark:text-neutral-200">
                          Archive
                        </CardTitle>
                      </div>
                      <CardDescription className="text-neutral-700 dark:text-neutral-300">
                        View archived notes
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>

            {/* New dashed Create Board card */}
            <AddBoardCard
              onClick={() => {
                form.reset({ name: "", description: "" });
                setEditingBoard(null);
                setIsAddBoardDialogOpen(true);
              }}
            />

            {boards.map((board) => (
              <Link href={`/boards/${board.id}`} key={board.id}>
                <Card className="group cursor-pointer bg-neutral-50 dark:bg-zinc-900 border-neutral-300 dark:border-zinc-800 dark:hover:bg-zinc-900/75 h-40">
                  <CardHeader className="flex flex-col h-full">
                    <div className="w-full">
                      <div className="flex items-center justify-between mb-1">
                        <CardTitle className="text-lg  w-3/4 dark:text-zinc-100">
                          {board.name}
                        </CardTitle>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-nowrap bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                          {board._count.notes} {board._count.notes === 1 ? "note" : "notes"}
                        </span>
                      </div>
                      {(user?.id === board.createdBy || user?.isAdmin) && (
                        <div className="flex justify-end items-center space-x-1">
                          <Button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEditBoard(board);
                            }}
                            className="md:opacity-0 md:group-hover:opacity-100 text-muted-foreground dark:text-zinc-400 hover:text-neutral-500 dark:hover:text-neutral-400 p-1 rounded transition-opacity"
                            title={
                              user?.id === board.createdBy ? "Edit board" : "Edit board (Admin)"
                            }
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteBoard(board.id, board.name);
                            }}
                            className="md:opacity-0 md:group-hover:opacity-100 text-muted-foreground dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 p-1 rounded transition-opacity"
                            title={
                              user?.id === board.createdBy ? "Delete board" : "Delete board (Admin)"
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                      {board.description && (
                        <CardDescription className="mt-1 dark:text-zinc-400 line-clamp-2 text-sm">
                          {board.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="mt-3 w-full flex items-center justify-between">
                      <div
                        className="flex items-center space-x-2"
                        onClick={(e) => e.preventDefault()}
                      >
                        <Switch
                          checked={board.isPublic}
                          onCheckedChange={(checked) => handleTogglePublic(board.id, checked)}
                          disabled={user?.id !== board.createdBy && !user?.isAdmin}
                        />
                        <span className="text-xs text-muted-foreground dark:text-zinc-400">
                          {board.isPublic ? "Public" : "Private"}
                        </span>
                      </div>

                      {board.isPublic && (
                        <Button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCopyPublicUrl(board.id);
                          }}
                          className="flex items-center space-x-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-300"
                          title="Copy public link"
                        >
                          {copiedBoardId === board.id ? (
                            <>
                              <span>✓</span>
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy link</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {boards.length === 0 && (
          <div className="text-center py-12">
            <div className="max-w-sm mx-auto">
              <AddBoardCard
                onClick={() => {
                  setIsAddBoardDialogOpen(true);
                  form.reset({ name: "", description: "" });
                }}
              />
            </div>
          </div>
        )}
      </div>

      <AlertDialog
        open={deleteConfirmDialog.open}
        onOpenChange={(open) => setDeleteConfirmDialog({ open, boardId: "", boardName: "" })}
      >
        <AlertDialogContent className="bg-white dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground dark:text-zinc-100">
              Delete board
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground dark:text-zinc-400">
              Are you sure you want to delete &quot;{deleteConfirmDialog.boardName}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white dark:bg-zinc-900 text-foreground dark:text-zinc-100 border border-neutral-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteBoard}
              className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700"
            >
              Delete board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ open, title: "", description: "" })}
      >
        <AlertDialogContent className="bg-white dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground dark:text-zinc-100">
              {errorDialog.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground dark:text-zinc-400">
              {errorDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setErrorDialog({ open: false, title: "", description: "" })}
              className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
