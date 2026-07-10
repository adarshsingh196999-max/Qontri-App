import {
  doublePrecision,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Existing tables ───────────────────────────────────────────────────────────

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  blockedAt: timestamp("blocked_at"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  adminEmail: text("admin_email"),
  targetEmail: text("target_email"),
  details: text("details").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tripsTable = pgTable("trips", {
  id: serial("id").primaryKey(),
  localId: text("local_id").notNull().unique(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🧳"),
  memberCount: text("member_count").notNull().default("1"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── User profiles ─────────────────────────────────────────────────────────────

export const userProfilesTable = pgTable("user_profiles", {
  email: text("email").primaryKey(),
  name: text("name").notNull().default(""),
  upiId: text("upi_id").notNull().default(""),
  avatar: text("avatar").notNull().default(""),
  travelStyle: text("travel_style").notNull().default(""),
  ietBudget: doublePrecision("iet_budget").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Groups ────────────────────────────────────────────────────────────────────

export const groupsTable = pgTable("groups", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🧳"),
  description: text("description"),
  tagSerial: serial("tag_serial"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groupMembersTable = pgTable("group_members", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groupsTable.id, { onDelete: "cascade" }),
  memberLocalId: text("member_local_id").notNull(),
  ownerEmail: text("owner_email"),
  name: text("name").notNull(),
  color: text("color").notNull().default("#1E3A5F"),
  upiId: text("upi_id"),
  avatar: text("avatar"),
});

// ── Expenses ──────────────────────────────────────────────────────────────────

export const expensesTable = pgTable("expenses", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groupsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  amount: doublePrecision("amount").notNull(),
  paidByMemberId: text("paid_by_member_id").notNull(),
  splitType: text("split_type").notNull().default("equal"),
  category: text("category").notNull().default("General"),
  date: text("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenseSplitsTable = pgTable("expense_splits", {
  id: text("id").primaryKey(),
  expenseId: text("expense_id")
    .notNull()
    .references(() => expensesTable.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull(),
  amount: doublePrecision("amount").notNull(),
  percentage: doublePrecision("percentage"),
});

// ── Settlements ───────────────────────────────────────────────────────────────

export const settlementsTable = pgTable("settlements", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groupsTable.id, { onDelete: "cascade" }),
  fromMemberId: text("from_member_id").notNull(),
  toMemberId: text("to_member_id").notNull(),
  amount: doublePrecision("amount").notNull(),
  date: text("date").notNull(),
  mode: text("mode").notNull().default("cash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Activity log ──────────────────────────────────────────────────────────────

export const activityEntriesTable = pgTable("activity_entries", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groupsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  label: text("label").notNull(),
  meta: text("meta").notNull().default(""),
  date: text("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── IET (Individual Expense Tracker) ──────────────────────────────────────────

export const ietExpensesTable = pgTable("iet_expenses", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  title: text("title").notNull(),
  amount: doublePrecision("amount").notNull(),
  category: text("category").notNull().default("Other"),
  date: text("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIetExpenseSchema = createInsertSchema(ietExpensesTable).omit({
  createdAt: true,
});
export type InsertIetExpense = z.infer<typeof insertIetExpenseSchema>;
export type IetExpense = typeof ietExpensesTable.$inferSelect;

// ── Business Trip ─────────────────────────────────────────────────────────────

export const businessTripsTable = pgTable("business_trips", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  name: text("name").notNull(),
  destination: text("destination").notNull().default(""),
  purpose: text("purpose").notNull().default(""),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const businessTripBillsTable = pgTable("business_trip_bills", {
  id: text("id").primaryKey(),
  tripId: text("trip_id")
    .notNull()
    .references(() => businessTripsTable.id, { onDelete: "cascade" }),
  userEmail: text("user_email").notNull(),
  vendor: text("vendor").notNull().default(""),
  amount: doublePrecision("amount").notNull().default(0),
  date: text("date").notNull(),
  category: text("category").notNull().default("Other"),
  notes: text("notes").notNull().default(""),
  expenseBy: text("expense_by").notNull().default(""),
  imageData: text("image_data"),
  imageMimeType: text("image_mime_type").notNull().default("image/jpeg"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── App-open tracking (true DAU/WAU/MAU — one row per user per day) ──────────

export const userAppOpensTable = pgTable(
  "user_app_opens",
  {
    email: text("email").notNull(),
    date: text("date").notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.email, t.date] })],
);

// ── User sessions (DB-backed, survives server restarts) ───────────────────────

export const userSessionsTable = pgTable("user_sessions", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// ── Zod schemas ───────────────────────────────────────────────────────────────

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const insertTripSchema = createInsertSchema(tripsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof tripsTable.$inferSelect;
