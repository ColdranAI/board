import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const inviteStatusEnum = pgEnum("InviteStatus", ["PENDING", "ACCEPTED", "DECLINED"]);

// Tables
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => ({
    providerAccountIdIdx: unique().on(table.providerId, table.accountId),
  })
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  userId: text("user_id").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").$defaultFn(() => false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
  organizationId: text("organizationId"),
  isAdmin: boolean("isAdmin").default(false).notNull(),
});

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slackWebhookUrl: text("slackWebhookUrl"),
  createdAt: timestamp("createdAt", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
});

export const boards = pgTable(
  "boards",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    isPublic: boolean("isPublic").default(false).notNull(),
    sendSlackUpdates: boolean("sendSlackUpdates").default(true).notNull(),
    organizationId: text("organizationId").notNull(),
    createdBy: text("createdBy").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => ({
    idxBoardOrgCreated: index("idx_board_org_created").on(table.organizationId, table.createdAt),
  })
);

export const notes = pgTable(
  "notes",
  {
    id: text("id").primaryKey(),
    content: text("content").notNull(),
    color: text("color").default("#fef3c7").notNull(),
    archivedAt: timestamp("archivedAt", { mode: "date" }),
    slackMessageId: text("slackMessageId"),
    boardId: text("boardId").notNull(),
    createdBy: text("createdBy").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
    deletedAt: timestamp("deletedAt", { mode: "date" }),
  },
  (table) => ({
    idxNoteBoardDeleted: index("idx_note_board_deleted").on(table.boardId, table.deletedAt),
    idxNoteBoardCreated: index("idx_note_board_created").on(table.boardId, table.createdAt),
    idxNoteUserDeleted: index("idx_note_user_deleted").on(table.createdBy, table.deletedAt),
  })
);

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: text("id").primaryKey(),
    content: text("content").notNull(),
    checked: boolean("checked").default(false).notNull(),
    order: integer("order").default(0).notNull(),
    noteId: text("noteId").notNull(),
    slackMessageId: text("slackMessageId"),
    createdAt: timestamp("createdAt", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => ({
    noteIdIdx: index().on(table.noteId),
    noteIdOrderIdx: index().on(table.noteId, table.order),
  })
);

export const organizationInvites = pgTable(
  "organization_invites",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    organizationId: text("organizationId").notNull(),
    invitedBy: text("invitedBy").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
    status: inviteStatusEnum("status").default("PENDING").notNull(),
  },
  (table) => ({
    emailOrganizationIdIdx: unique().on(table.email, table.organizationId),
  })
);

export const organizationSelfServeInvites = pgTable("organization_self_serve_invites", {
  id: text("id").primaryKey(),
  token: text("token").unique(),
  name: text("name").notNull(),
  organizationId: text("organizationId").notNull(),
  createdBy: text("createdBy").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
  expiresAt: timestamp("expiresAt", { mode: "date" }),
  usageLimit: integer("usageLimit"),
  usageCount: integer("usageCount").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
});

export const verificationTokens = pgTable(
  "verificationtokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull().unique(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => ({
    identifierTokenIdx: unique().on(table.identifier, table.token),
  })
);

// Better Auth verification table
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).$defaultFn(() => new Date()).notNull(),
});

// Relations
export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  invitedOrganizations: many(organizationInvites),
  createdSelfServeInvites: many(organizationSelfServeInvites),
  notes: many(notes),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(users),
  invites: many(organizationInvites),
  boards: many(boards),
  selfServeInvites: many(organizationSelfServeInvites),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [boards.organizationId],
    references: [organizations.id],
  }),
  notes: many(notes),
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
  board: one(boards, {
    fields: [notes.boardId],
    references: [boards.id],
  }),
  user: one(users, {
    fields: [notes.createdBy],
    references: [users.id],
  }),
  checklistItems: many(checklistItems),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  note: one(notes, {
    fields: [checklistItems.noteId],
    references: [notes.id],
  }),
}));

export const organizationInvitesRelations = relations(organizationInvites, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationInvites.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationInvites.invitedBy],
    references: [users.id],
  }),
}));

export const organizationSelfServeInvitesRelations = relations(
  organizationSelfServeInvites,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationSelfServeInvites.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationSelfServeInvites.createdBy],
      references: [users.id],
    }),
  })
);