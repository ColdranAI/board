"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Plus, ChevronDown, Settings, Search } from "lucide-react";
import { FullPageLoader } from "@/components/ui/loader";
import { FilterPopover } from "@/components/ui/filter-popover";
import { Note as NoteCard } from "@/components/note";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { toast } from "sonner";

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

// Use shared types from components
import type { Note, Board, User } from "@/components/note";

interface AddNoteCardProps {
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

function AddNoteCard({ onClick, className, style }: AddNoteCardProps) {
  useTheme();

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 cursor-pointer group flex flex-col items-center justify-center p-8 bg-gray-50/50 dark:bg-zinc-900/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/30",
        className
      )}
      style={style}
    >
      <div className="flex flex-col items-center justify-center space-y-3 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
        <div className="p-3 rounded-full bg-gray-200/50 dark:bg-gray-700/50 group-hover:bg-blue-200/50 dark:group-hover:bg-blue-800/50 transition-all duration-200">
          <Plus className="w-6 h-6" />
        </div>
        <span className="text-sm font-medium">Add new note</span>
      </div>
    </div>
  );
}

const bestColumnIndex = (bottoms: number[]) => bottoms.indexOf(Math.min(...bottoms));

export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const { resolvedTheme } = useTheme();
  const [allBoards, setAllBoards] = useState<Board[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);
  const [showAddBoard, setShowAddBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDescription, setNewBoardDescription] = useState("");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
    startDate: null,
    endDate: null,
  });
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [addingChecklistItem, setAddingChecklistItem] = useState<string | null>(null);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: "",
    description: "",
  });
  const pendingDeleteTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [boardSettingsDialog, setBoardSettingsDialog] = useState(false);
  const [boardSettings, setBoardSettings] = useState({ sendSlackUpdates: true });
  const boardRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize boardId from route params
  useEffect(() => {
    const initializeParams = async () => {
      const resolvedParams = await params;
      setBoardId(resolvedParams.id);
    };
    initializeParams();
  }, [params]);

  // URL update helper
  const updateURL = useCallback(
    (
      newSearchTerm?: string,
      newDateRange?: { startDate: Date | null; endDate: Date | null },
      newAuthor?: string | null
    ) => {
      const p = new URLSearchParams();

      const currentSearchTerm = newSearchTerm !== undefined ? newSearchTerm : searchTerm;
      const currentDateRange = newDateRange !== undefined ? newDateRange : dateRange;
      const currentAuthor = newAuthor !== undefined ? newAuthor : selectedAuthor;

      if (currentSearchTerm) p.set("search", currentSearchTerm);
      if (currentDateRange.startDate)
        p.set("startDate", currentDateRange.startDate.toISOString().split("T")[0]);
      if (currentDateRange.endDate)
        p.set("endDate", currentDateRange.endDate.toISOString().split("T")[0]);
      if (currentAuthor) p.set("author", currentAuthor);

      const qs = p.toString();
      const newURL = qs ? `?${qs}` : window.location.pathname;
      router.replace(newURL, { scroll: false });
    },
    [searchTerm, dateRange, selectedAuthor, router]
  );

  // Initialize filters from URL on mount
  const initializeFiltersFromURL = useCallback(() => {
    const urlSearchTerm = searchParams.get("search") || "";
    const urlStartDate = searchParams.get("startDate");
    const urlEndDate = searchParams.get("endDate");
    const urlAuthor = searchParams.get("author");

    setSearchTerm(urlSearchTerm);

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (urlStartDate) {
      const d = new Date(urlStartDate);
      if (!isNaN(d.getTime())) startDate = d;
    }
    if (urlEndDate) {
      const d = new Date(urlEndDate);
      if (!isNaN(d.getTime())) endDate = d;
    }

    setDateRange({ startDate, endDate });
    setSelectedAuthor(urlAuthor);
  }, [searchParams]);

  useEffect(() => {
    initializeFiltersFromURL();
  }, [initializeFiltersFromURL]);

  // Responsive config (stable ref)
  const getResponsiveConfig = useCallback(() => {
    if (typeof window === "undefined")
      return { noteWidth: 320, gridGap: 20, containerPadding: 20, notePadding: 16 };

    const width = window.innerWidth;
    if (width >= 1920) return { noteWidth: 340, gridGap: 24, containerPadding: 32, notePadding: 18 };
    if (width >= 1200) return { noteWidth: 320, gridGap: 20, containerPadding: 24, notePadding: 16 };
    if (width >= 768) return { noteWidth: 300, gridGap: 16, containerPadding: 20, notePadding: 16 };
    if (width >= 600) return { noteWidth: 280, gridGap: 16, containerPadding: 16, notePadding: 14 };
    return { noteWidth: 260, gridGap: 12, containerPadding: 12, notePadding: 12 };
  }, []);

  // Estimate card height
  const calculateNoteHeight = useCallback(
    (note: Note, noteWidth?: number, notePadding?: number) => {
      const config = getResponsiveConfig();
      const pad = notePadding ?? config.notePadding;
      const w = noteWidth ?? config.noteWidth;

      const headerHeight = 60;
      const paddingHeight = pad * 2;
      const minContentHeight = 60;

      // Checklist-aware sizing
      if (note.checklistItems) {
        const items = note.checklistItems as Array<any>;
        const itemHeight = 28;
        const itemSpacing = 4;
        const addingItemHeight = addingChecklistItem === note.id ? 32 : 0;
        const addTaskButtonHeight = 36;

        const count = items.length ?? 0;
        const checklistHeight =
          count * itemHeight + (count > 0 ? (count - 1) * itemSpacing : 0) + addingItemHeight;

        const content = Math.max(minContentHeight, checklistHeight);
        return headerHeight + paddingHeight + content + addTaskButtonHeight;
      }

      // Text note sizing
      const lines = note.content.split("\n");
      const avgCharWidth = 9;
      const contentWidth = w - pad * 2 - 16;
      const charsPerLine = Math.max(1, Math.floor(contentWidth / avgCharWidth));

      let totalLines = 0;
      for (const line of lines) {
        if (line.length === 0) totalLines += 1;
        else totalLines += Math.max(1, Math.ceil(line.length / charsPerLine));
      }
      totalLines = Math.max(3, totalLines);

      const lineHeight = 28;
      const contentHeight = totalLines * lineHeight;

      return headerHeight + paddingHeight + Math.max(minContentHeight, contentHeight);
    },
    [addingChecklistItem, getResponsiveConfig]
  );

  // Close dropdowns / escape handling
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showBoardDropdown || showAddBoard) {
        const target = event.target as Element;
        if (
          !target.closest(".board-dropdown") &&
          !target.closest(".user-dropdown") &&
          !target.closest(".add-board-modal")
        ) {
          setShowBoardDropdown(false);
          setShowAddBoard(false);
        }
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (addingChecklistItem) setAddingChecklistItem(null);
        if (showBoardDropdown) setShowBoardDropdown(false);
        if (showAddBoard) {
          setShowAddBoard(false);
          setNewBoardName("");
          setNewBoardDescription("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showBoardDropdown, showAddBoard, addingChecklistItem]);

  // Responsive / relayout on resize
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    const checkResponsive = () => {
      if (typeof window !== "undefined") {
        const width = window.innerWidth;
        setIsMobile(width < 768);
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          setNotes((prev) => [...prev]); // trigger layout recalc
        }, 50);
      }
    };
    checkResponsive();
    window.addEventListener("resize", checkResponsive);
    return () => {
      window.removeEventListener("resize", checkResponsive);
      clearTimeout(resizeTimeout);
    };
  }, []);

  // Debounce search + URL sync
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      updateURL(searchTerm);
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchTerm, updateURL]);

  // Helpers
  const getUniqueAuthors = (notesArr: Note[]) => {
    const authorsMap = new Map<string, { id: string; name: string; email: string }>();
    notesArr.forEach((note) => {
      const id = note.user.id;
      if (!authorsMap.has(id)) {
        authorsMap.set(id, {
          id,
          name: note.user.name || note.user.email.split("@")[0],
          email: note.user.email,
        });
      }
    });
    return Array.from(authorsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  const filterAndSortNotes = (
    notesArr: Note[],
    s: string,
    dr: { startDate: Date | null; endDate: Date | null },
    authorId: string | null,
    currentUser: User | null
  ): Note[] => {
    let filtered = notesArr;

    if (s.trim()) {
      const search = s.toLowerCase();
      filtered = filtered.filter((note) => {
        const authorName = (note.user.name || note.user.email).toLowerCase();
        const noteContent = note.content.toLowerCase();
        return authorName.includes(search) || noteContent.includes(search);
      });
    }

    if (authorId) {
      filtered = filtered.filter((note) => note.user.id === authorId);
    }

    if (dr.startDate || dr.endDate) {
      filtered = filtered.filter((note) => {
        const noteDate = new Date(note.createdAt);
        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

        if (dr.startDate && dr.endDate) return noteDate >= startOfDay(dr.startDate) && noteDate <= endOfDay(dr.endDate);
        if (dr.startDate) return noteDate >= startOfDay(dr.startDate);
        if (dr.endDate) return noteDate <= endOfDay(dr.endDate);
        return true;
      });
    }

    filtered.sort((a, b) => {
      if (currentUser) {
        const aMine = a.user.id === currentUser.id;
        const bMine = b.user.id === currentUser.id;
        if (aMine && !bMine) return -1;
        if (!aMine && bMine) return 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  };

  const uniqueAuthors = useMemo(() => getUniqueAuthors(notes), [notes]);

  const filteredNotes = useMemo(
    () => filterAndSortNotes(notes, debouncedSearchTerm, dateRange, selectedAuthor, user),
    [notes, debouncedSearchTerm, dateRange, selectedAuthor, user]
  );

  // Layout calculators
  const calculateGridLayout = useCallback(() => {
    if (typeof window === "undefined") return [];

    const config = getResponsiveConfig();
    const containerWidth = window.innerWidth - config.containerPadding * 2;
    const noteWidthWithGap = config.noteWidth + config.gridGap;
    const columnsCount = Math.floor((containerWidth + config.gridGap) / noteWidthWithGap);
    const actualColumns = Math.max(1, columnsCount);

    const availableWidth = containerWidth - (actualColumns - 1) * config.gridGap;
    const calculatedNoteWidth = Math.floor(availableWidth / actualColumns);
    const minWidth = config.noteWidth - 40;
    const maxWidth = config.noteWidth + 80;
    const adjustedNoteWidth = Math.max(minWidth, Math.min(maxWidth, calculatedNoteWidth));

    const offsetX = config.containerPadding;
    const columnBottoms: number[] = new Array(actualColumns).fill(config.containerPadding);

    return filteredNotes.map((note) => {
      const noteHeight = calculateNoteHeight(note, adjustedNoteWidth, config.notePadding);

      let bestColumn = 0;
      let minBottom = columnBottoms[0];
      for (let col = 1; col < actualColumns; col++) {
        if (columnBottoms[col] < minBottom) {
          minBottom = columnBottoms[col];
          bestColumn = col;
        }
      }

      const x = offsetX + bestColumn * (adjustedNoteWidth + config.gridGap);
      const y = columnBottoms[bestColumn];
      columnBottoms[bestColumn] = y + noteHeight + config.gridGap;

      return { ...note, x, y, width: adjustedNoteWidth, height: noteHeight };
    });
  }, [filteredNotes, getResponsiveConfig, calculateNoteHeight]);

  const calculateMobileLayout = useCallback(() => {
    if (typeof window === "undefined") return [];

    const config = getResponsiveConfig();
    const containerWidth = window.innerWidth - config.containerPadding * 2;
    const minNoteWidth = config.noteWidth - 20;
    const columnsCount = Math.floor((containerWidth + config.gridGap) / (minNoteWidth + config.gridGap));
    const actualColumns = Math.max(1, columnsCount);

    const availableWidth = containerWidth - (actualColumns - 1) * config.gridGap;
    const noteWidth = Math.floor(availableWidth / actualColumns);

    const columnBottoms: number[] = new Array(actualColumns).fill(config.containerPadding);

    return filteredNotes.map((note) => {
      const noteHeight = calculateNoteHeight(note, noteWidth, config.notePadding);

      let bestColumn = 0;
      let minBottom = columnBottoms[0];
      for (let col = 1; col < actualColumns; col++) {
        if (columnBottoms[col] < minBottom) {
          minBottom = columnBottoms[col];
          bestColumn = col;
        }
      }

      const x = config.containerPadding + bestColumn * (noteWidth + config.gridGap);
      const y = columnBottoms[bestColumn];
      columnBottoms[bestColumn] = y + noteHeight + config.gridGap;

      return { ...note, x, y, width: noteWidth, height: noteHeight };
    });
  }, [filteredNotes, getResponsiveConfig, calculateNoteHeight]);

  const layoutNotes = useMemo(
    () => (isMobile ? calculateMobileLayout() : calculateGridLayout()),
    [isMobile, calculateMobileLayout, calculateGridLayout]
  );

  const boardHeight = useMemo(() => {
    if (layoutNotes.length === 0) return "calc(100vh - 128px)"; // Account for both nav bars
    const maxBottom = Math.max(...layoutNotes.map((n) => n.y + n.height));
    const minHeight = typeof window !== "undefined" && window.innerWidth < 768 ? 500 : 600;
    const calculatedHeight = Math.max(minHeight, maxBottom + 100);
    return `${calculatedHeight}px`;
  }, [layoutNotes]);

  // Data fetch
  const fetchBoardData = useCallback(async () => {
    try {
      const userResponse = await fetch("/api/user");
      if (userResponse.status === 401) {
        router.push("/auth/signin");
        return;
      }
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData);
      }

      let allBoardsResponse: Response;
      let notesResponse: Response | undefined;
      let boardResponse: Response | undefined;

      if (boardId === "all-notes") {
        [allBoardsResponse, notesResponse] = await Promise.all([fetch("/api/boards"), fetch(`/api/boards/all-notes/notes`)]);
        setBoard({ id: "all-notes", name: "All notes", description: "Notes from all boards" });
      } else if (boardId === "archive") {
        [allBoardsResponse, notesResponse] = await Promise.all([fetch("/api/boards"), fetch(`/api/boards/archive/notes`)]);
        setBoard({ id: "archive", name: "Archive", description: "Archived notes from all boards" });
      } else {
        [allBoardsResponse, boardResponse, notesResponse] = await Promise.all([
          fetch("/api/boards"),
          fetch(`/api/boards/${boardId}`),
          fetch(`/api/boards/${boardId}/notes`),
        ]);
      }

      if (allBoardsResponse.ok) {
        const { boards } = await allBoardsResponse.json();
        setAllBoards(boards);
      }

      if (boardResponse && boardResponse.ok) {
        const { board } = await boardResponse.json();
        setBoard(board);
        setBoardSettings({ sendSlackUpdates: (board as { sendSlackUpdates?: boolean })?.sendSlackUpdates ?? true });
      }

      if (notesResponse && notesResponse.ok) {
        const { notes: fetchedNotes } = await notesResponse.json();
        setNotes(fetchedNotes);
      }

      if (boardId && boardId !== "all-notes") {
        try {
          localStorage.setItem("Coldboard-last-visited-board", boardId);
        } catch (err) {
          console.warn("Failed to save last visited board:", err);
        }
      }
    } catch (error) {
      console.error("Error fetching board data:", error);
    } finally {
      setLoading(false);
    }
  }, [boardId, router]);

  useEffect(() => {
    if (boardId) fetchBoardData();
  }, [boardId, fetchBoardData]);

  // Adapter: updates from Note component (optimistic)
  const handleUpdateNoteFromComponent = async (updatedNote: Note) => {
    setNotes((prev) => prev.map((n) => (n.id === updatedNote.id ? updatedNote : n)));
  };

  const handleAddNote = async (targetBoardId?: string) => {
    if (boardId === "all-notes" && !targetBoardId) {
      setErrorDialog({
        open: true,
        title: "Board selection required",
        description: "Please select a board to add the note to",
      });
      return;
    }

    try {
      const actualTargetBoardId = boardId === "all-notes" ? targetBoardId : boardId;

      setTimeout(async () => {
        const response = await fetch(`/api/boards/${actualTargetBoardId}/notes/quick`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          const { note } = await response.json();
          setNotes((prev) => [note, ...prev]);
          setAddingChecklistItem(note.id);
        } else {
          console.error("Error creating note:", await response.text());
        }
      }, 20);
    } catch (error) {
      console.error("Error creating note:", error);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    const noteToDelete = notes.find((n) => n.id === noteId);
    if (!noteToDelete) return;
    const targetBoardId = (noteToDelete as any).board?.id ?? (noteToDelete as any).boardId;

    setNotes((prev) => prev.filter((n) => n.id !== noteId));

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/boards/${targetBoardId}/notes/${noteId}`, { method: "DELETE" });
        if (!response.ok) {
          setNotes((prev) => [noteToDelete, ...prev]);
          const errorData = await response.json().catch(() => null);
          setErrorDialog({
            open: true,
            title: "Failed to delete note",
            description: errorData?.error || "Failed to delete note",
          });
        }
      } catch (error) {
        console.error("Error deleting note:", error);
        setNotes((prev) => [noteToDelete, ...prev]);
        setErrorDialog({ open: true, title: "Failed to delete note", description: "Failed to delete note" });
      } finally {
        delete pendingDeleteTimeoutsRef.current[noteId];
      }
    }, 4000);

    pendingDeleteTimeoutsRef.current[noteId] = timeoutId;

    toast("Note deleted", {
      action: {
        label: "Undo",
        onClick: () => {
          const t = pendingDeleteTimeoutsRef.current[noteId];
          if (t) {
            clearTimeout(t);
            delete pendingDeleteTimeoutsRef.current[noteId];
          }
          setNotes((prev) => [noteToDelete, ...prev]);
        },
      },
      duration: 4000,
    });
  };

  const handleArchiveNote = async (noteId: string) => {
    try {
      const currentNote = notes.find((n) => n.id === noteId);
      if (!currentNote) return;

      const targetBoardId = (currentNote as any).board?.id ?? (currentNote as any).boardId;

      setNotes((prev) => prev.filter((n) => n.id !== noteId));

      const response = await fetch(`/api/boards/${targetBoardId}/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivedAt: new Date().toISOString() }),
      });

      if (!response.ok) {
        setNotes((prev) => [...prev, currentNote]);
        setErrorDialog({
          open: true,
          title: "Archive Failed",
          description: "Failed to archive note. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error archiving note:", error);
    }
  };

  const handleUnarchiveNote = async (noteId: string) => {
    try {
      const currentNote = notes.find((n) => n.id === noteId);
      if (!currentNote) return;

      const targetBoardId = (currentNote as any).board?.id ?? (currentNote as any).boardId;
      if (!targetBoardId) return;

      setNotes((prev) => prev.filter((n) => n.id !== noteId));

      const response = await fetch(`/api/boards/${targetBoardId}/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivedAt: null }),
      });

      if (!response.ok) {
        setNotes((prev) => [...prev, currentNote]);
        setErrorDialog({
          open: true,
          title: "Unarchive Failed",
          description: "Failed to unarchive note. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error unarchiving note:", error);
    }
  };

  const handleAddBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    try {
      const response = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBoardName, description: newBoardDescription }),
      });

      if (response.ok) {
        const { board: newBoard } = await response.json();
        setAllBoards((prev) => [newBoard, ...prev]);
        setNewBoardName("");
        setNewBoardDescription("");
        setShowAddBoard(false);
        setShowBoardDropdown(false);
        router.push(`/boards/${newBoard.id}`);
      } else {
        const errorData = await response.json();
        setErrorDialog({
          open: true,
          title: "Failed to create board",
          description: errorData.error || "Failed to create board",
        });
      }
    } catch (error) {
      console.error("Error creating board:", error);
      setErrorDialog({ open: true, title: "Failed to create board", description: "Failed to create board" });
    }
  };

  const handleUpdateBoardSettings = async (settings: { sendSlackUpdates: boolean }) => {
    try {
      const response = await fetch(`/api/boards/${boardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        const { board: updated } = await response.json();
        setBoard(updated);
        setBoardSettings({ sendSlackUpdates: (updated as any).sendSlackUpdates });
        setBoardSettingsDialog(false);
      }
    } catch (error) {
      console.error("Error updating board settings:", error);
    }
  };

  if (loading) return <FullPageLoader message="Loading board..." />;

  if (!board && boardId !== "all-notes" && boardId !== "archive") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Board not found</div>
      </div>
    );
  }

  return (
    <div className="bg-background dark:bg-zinc-950">
      {/* Board Controls Header */}
      <div className="bg-card dark:bg-zinc-900 border-b border-neutral-200 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-wrap sm:flex-nowrap justify-between items-center h-auto sm:h-16 p-2 sm:p-0">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:space-x-3 w-full sm:w-auto">

            {/* Board selector */}
            <div className="relative board-dropdown flex-1 sm:flex-none">
              <Button
                onClick={() => setShowBoardDropdown(!showBoardDropdown)}
                className="flex items-center justify-between border border-neutral-200 dark:border-zinc-800 space-x-2 text-foreground dark:text-zinc-100 hover:text-foreground dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:focus:ring-zinc-600 rounded-md px-3 py-2 cursor-pointer w-full sm:w-auto"
              >
                <div className="text-sm font-semibold">
                  {boardId === "all-notes" ? "All notes" : boardId === "archive" ? "Archive" : board?.name}
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground dark:text-zinc-400 transition-transform ${
                    showBoardDropdown ? "rotate-180" : ""
                  }`}
                />
              </Button>

              {showBoardDropdown && (
                <div className="fixed sm:absolute left-0 mt-2 w-full sm:w-64 bg-white dark:bg-zinc-900 rounded-md shadow-lg border border-neutral-200 dark:border-zinc-800 z-50 max-h-80 overflow-y-auto">
                  <div className="py-1">
                    <Link
                      href="/boards/all-notes"
                      className={`block px-4 py-2 text-sm hover:bg-accent dark:hover:bg-zinc-800 ${
                        boardId === "all-notes"
                          ? "bg-neutral-50 dark:bg-zinc-900/70 text-neutral-700 dark:text-neutral-300"
                          : "text-foreground dark:text-zinc-100"
                      }`}
                      onClick={() => setShowBoardDropdown(false)}
                    >
                      <div className="font-medium">All notes</div>
                      <div className="text-xs text-muted-foreground dark:text-zinc-400 mt-1">Notes from all boards</div>
                    </Link>

                    <Link
                      href="/boards/archive"
                      className={`block px-4 py-2 text-sm hover:bg-accent dark:hover:bg-zinc-800 ${
                        boardId === "archive"
                          ? "bg-neutral-50 dark:bg-zinc-900/70 text-neutral-700 dark:text-neutral-300"
                          : "text-foreground dark:text-zinc-100"
                      }`}
                      onClick={() => setShowBoardDropdown(false)}
                    >
                      <div className="font-medium">Archive</div>
                      <div className="text-xs text-muted-foreground dark:text-zinc-400 mt-1">Archived notes from all boards</div>
                    </Link>

                    {allBoards.length > 0 && <div className="border-t border-neutral-200 dark:border-zinc-800 my-1" />}

                    {allBoards.map((b) => (
                      <Link
                        key={b.id}
                        href={`/boards/${b.id}`}
                        className={`block px-4 py-2 text-sm hover:bg-accent dark:hover:bg-zinc-800 ${
                          b.id === boardId
                            ? "bg-neutral-50 dark:bg-zinc-900/70 text-neutral-700 dark:text-neutral-300"
                            : "text-foreground dark:text-zinc-100"
                        }`}
                        onClick={() => setShowBoardDropdown(false)}
                      >
                        <div className="font-medium">{b.name}</div>
                        {b.description && (
                          <div className="text-xs text-muted-foreground dark:text-zinc-400 mt-1">{b.description}</div>
                        )}
                      </Link>
                    ))}

                    {allBoards.length > 0 && <div className="border-t border-neutral-200 dark:border-zinc-800 my-1" />}

                    <Button
                      onClick={() => {
                        setShowAddBoard(true);
                        setShowBoardDropdown(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-foreground dark:text-zinc-100 hover:bg-accent dark:hover:bg-zinc-800"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      <span className="font-medium">Create new board</span>
                    </Button>

                    {boardId !== "all-notes" && boardId !== "archive" && (
                      <Button
                        onClick={() => {
                          setBoardSettings({
                            sendSlackUpdates: (board as any)?.sendSlackUpdates ?? true,
                          });
                          setBoardSettingsDialog(true);
                          setShowBoardDropdown(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-foreground dark:text-zinc-100 hover:bg-accent dark:hover:bg-zinc-800"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        <span className="font-medium">Board settings</span>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="relative board-dropdown flex-1 sm:flex-none">
              <FilterPopover
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                onDateRangeChange={(startDate, endDate) => {
                  const newDateRange = { startDate, endDate };
                  setDateRange(newDateRange);
                  updateURL(undefined, newDateRange);
                }}
                selectedAuthor={selectedAuthor}
                authors={uniqueAuthors}
                onAuthorChange={(authorId) => {
                  setSelectedAuthor(authorId);
                  updateURL(undefined, undefined, authorId);
                }}
                className="min-w-fit"
              />
            </div>
          </div>

          {/* Right cluster: search, add, user */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none min-w-[150px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground dark:text-zinc-400" />
              </div>
              <input
                aria-label="Search notes"
                type="text"
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-8 py-2 border border-neutral-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:focus:ring-zinc-600 focus:border-transparent text-sm bg-background dark:bg-zinc-900 text-foreground dark:text-zinc-100 placeholder:text-muted-foreground dark:placeholder:text-zinc-400"
              />
              {searchTerm && (
                <Button
                  onClick={() => {
                    setSearchTerm("");
                    setDebouncedSearchTerm("");
                    updateURL("");
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground dark:text-zinc-400 hover:text-foreground dark:hover:text-zinc-100 cursor-pointer"
                >
                  ×
                </Button>
              )}
            </div>

            {/* Add note */}
            <Button
              onClick={() => {
                if (boardId === "all-notes" && allBoards.length > 0) {
                  handleAddNote(allBoards[0].id);
                } else {
                  handleAddNote();
                }
              }}
              className="flex items-center justify-center w-10 h-10 sm:w-auto sm:h-auto sm:space-x-2 bg-neutral-600 hover:bg-neutral-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer font-medium"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Note</span>
            </Button>

          </div>
        </div>
      </div>

      {/* Board area */}
      <div
        ref={boardRef}
        className="bg-neutral-50 dark:bg-zinc-950"
        style={{ height: boardHeight, minHeight: "calc(100vh - 128px)" }}
      >
        {/* Masonry notes */}
        <div>
          {layoutNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note as Note}
              currentUser={user as User}
              addingChecklistItem={addingChecklistItem}
              onUpdate={handleUpdateNoteFromComponent}
              onDelete={handleDeleteNote}
              onArchive={boardId !== "archive" ? handleArchiveNote : undefined}
              onUnarchive={boardId === "archive" ? handleUnarchiveNote : undefined}
              showBoardName={boardId === "all-notes" || boardId === "archive"}
              className="note-background"
              style={{
                position: "absolute",
                left: (note as any).x,
                top: (note as any).y,
                width: (note as any).width,
                height: (note as any).height,
                padding: `${getResponsiveConfig().notePadding}px`,
                backgroundColor: resolvedTheme === "dark" ? "#18181B" : note.color,
              }}
            />
          ))}
        </div>

        {/* Empty-state (filters active) */}
        {filteredNotes.length === 0 &&
          notes.length > 0 &&
          (searchTerm || dateRange.startDate || dateRange.endDate || selectedAuthor) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-neutral-500 dark:text-neutral-400">
              <Search className="w-12 h-12 mb-4 text-neutral-400 dark:text-neutral-500" />
              <div className="text-xl mb-2">No notes found</div>
              <div className="text-sm mb-4 text-center">
                No notes match your current filters
                {searchTerm && <div>Search: &quot;{searchTerm}&quot;</div>}
                {selectedAuthor && (
                  <div>Author: {uniqueAuthors.find((a) => a.id === selectedAuthor)?.name || "Unknown"}</div>
                )}
                {(dateRange.startDate || dateRange.endDate) && (
                  <div>
                    Date range: {dateRange.startDate ? dateRange.startDate.toLocaleDateString() : "..."} -{" "}
                    {dateRange.endDate ? dateRange.endDate.toLocaleDateString() : "..."}
                  </div>
                )}
              </div>
              <Button
                onClick={() => {
                  setSearchTerm("");
                  setDebouncedSearchTerm("");
                  setDateRange({ startDate: null, endDate: null });
                  setSelectedAuthor(null);
                  updateURL("", { startDate: null, endDate: null }, null);
                }}
                variant="outline"
                className="flex items-center space-x-2 cursor-pointer"
              >
                <span>Clear All Filters</span>
              </Button>
            </div>
          )}
{notes.length === 0 && (
  <div className="flex flex-col py-20 items-center justify-center text-neutral-500 dark:text-neutral-400 space-y-6">
    <div className="flex flex-col items-center">
      <div className="text-sm mb-2">Add Note to Get Started</div>
    </div>

    {/* AddNoteCard visual */}
    <AddNoteCard
      onClick={() => {
        if (boardId === "all-notes" && allBoards.length > 0) {
          handleAddNote(allBoards[0].id);
        } else if (boardId === "archive") {
          setErrorDialog({
            open: true,
            title: "Cannot Add Note",
            description:
              "You cannot add notes directly to the archive. Notes are archived from other boards.",
          });
        } else {
          handleAddNote();
        }
      }}
      className="max-w-xs w-full"
    />
  </div>
)}

      </div>

      {/* Create Board Modal */}
      {showAddBoard && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/40 dark:bg-black/70 backdrop-blur-sm add-board-modal"
          onClick={() => {
            setShowAddBoard(false);
            setNewBoardName("");
            setNewBoardDescription("");
          }}
        >
          <div
            className="bg-white dark:bg-zinc-950 bg-opacity-95 dark:bg-opacity-95 rounded-xl p-5 sm:p-7 w-full max-w-sm sm:max-w-md shadow-2xl border border-neutral-200 dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 text-foreground dark:text-zinc-100">Create new board</h3>
            <form onSubmit={handleAddBoard}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground dark:text-zinc-200 mb-1">
                    Board name
                  </label>
                  <Input
                    type="text"
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    placeholder="Enter board name"
                    required
                    className="bg-white dark:bg-zinc-900 text-foreground dark:text-zinc-100 border border-neutral-200 dark:border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground dark:text-zinc-200 mb-1">
                    Description (optional)
                  </label>
                  <Input
                    type="text"
                    value={newBoardDescription}
                    onChange={(e) => setNewBoardDescription(e.target.value)}
                    placeholder="Enter board description"
                    className="bg-white dark:bg-zinc-900 text-foreground dark:text-zinc-100 border border-neutral-200 dark:border-zinc-700"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddBoard(false);
                    setNewBoardName("");
                    setNewBoardDescription("");
                  }}
                  className="bg-white dark:bg-zinc-900 text-foreground dark:text-zinc-100 border border-neutral-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-neutral-600 hover:bg-neutral-700 text-white dark:bg-neutral-500 dark:hover:bg-neutral-600 dark:text-zinc-100"
                >
                  Create board
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generic error dialog */}
      <AlertDialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog({ open, title: "", description: "" })}>
        <AlertDialogContent className="bg-white dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground dark:text-zinc-100">{errorDialog.title}</AlertDialogTitle>
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

      {/* Board settings dialog */}
      <AlertDialog open={boardSettingsDialog} onOpenChange={setBoardSettingsDialog}>
        <AlertDialogContent className="bg-white dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground dark:text-zinc-100">Board settings</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground dark:text-zinc-400">
              Configure settings for &quot;{board?.name}&quot; board.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendSlackUpdates"
                checked={boardSettings.sendSlackUpdates}
                onCheckedChange={(checked) => setBoardSettings({ sendSlackUpdates: checked as boolean })}
              />
              <label
                htmlFor="sendSlackUpdates"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground dark:text-zinc-100"
              >
                Send updates to Slack
              </label>
            </div>
            <p className="text-xs text-muted-foreground dark:text-zinc-400 mt-1 ml-6">
              When enabled, note updates will be sent to your organization&apos;s Slack channel
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleUpdateBoardSettings(boardSettings)}>Save settings</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
