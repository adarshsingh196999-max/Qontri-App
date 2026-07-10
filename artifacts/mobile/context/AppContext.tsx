import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import {
  BanterMessage,
  UserInsight,
  banterForExpense,
  banterForRole,
  banterForSettlement,
  computeGroupInsights as computeInsightsFn,
} from "../utils/groupInsights";
import { useMockAuth } from "./MockAuthContext";
import { API_BASE } from "@/constants/api";

export type SplitType = "equal" | "unequal" | "percentage" | "exact";

export interface Member {
  id: string;
  name: string;
  color: string;
  upiId?: string;
  avatar?: string;
  travelStyle?: string;
}

export interface ExpenseSplit {
  memberId: string;
  amount: number;
  percentage?: number;
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  paidById: string;
  splits: ExpenseSplit[];
  splitType: SplitType;
  category: string;
  date: string;
  notes?: string;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromId: string;
  toId: string;
  amount: number;
  date: string;
  mode: "cash" | "upi" | "bank";
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  members: Member[];
  createdAt: string;
  tagNumber?: string;
}

export interface Balance {
  fromId: string;
  toId: string;
  amount: number;
}

export type ActivityEntryType =
  | "expense_edited"
  | "expense_deleted"
  | "group_edited"
  | "group_joined";

export interface ActivityEntry {
  id: string;
  type: ActivityEntryType;
  groupId: string;
  label: string;
  meta: string;
  date: string;
}

interface AppContextValue {
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
  activities: ActivityEntry[];
  currentUserId: string;
  currentUserName: string;
  currentUserUpiId: string;
  currentUserAvatar: string;
  currentUserTravelStyle: string;
  loading: boolean;
  createGroup: (name: string, emoji: string, description?: string) => Promise<Group>;
  updateGroup: (groupId: string, updates: Partial<Group>) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  joinGroup: (tag: string) => Promise<Group | null>;
  addMember: (groupId: string, name: string) => Promise<Member>;
  removeMember: (groupId: string, memberId: string) => Promise<void>;
  addExpense: (expense: Omit<Expense, "id">) => Promise<Expense>;
  updateExpense: (expenseId: string, updates: Partial<Omit<Expense, "id" | "groupId">>) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  addSettlement: (settlement: Omit<Settlement, "id">) => Promise<Settlement>;
  getGroupExpenses: (groupId: string) => Expense[];
  getGroupSettlements: (groupId: string) => Settlement[];
  getGroupBalances: (groupId: string) => Balance[];
  getSimplifiedDebts: (groupId: string) => Balance[];
  getMemberBalance: (groupId: string, memberId: string) => number;
  getRecentActivity: () => Array<{
    type: "expense" | "settlement" | "activity_log";
    item: Expense | Settlement | ActivityEntry;
    group: Group;
  }>;
  setCurrentUserName: (name: string) => Promise<void>;
  setCurrentUserPaymentInfo: (upiId: string) => Promise<void>;
  setCurrentUserAvatar: (avatar: string) => Promise<void>;
  setCurrentUserTravelStyle: (style: string) => Promise<void>;
  computeGroupInsights: (groupId: string) => UserInsight[];
  getGroupBanter: (groupId: string) => BanterMessage[];
  refreshGroups: () => Promise<void>;
}

const MEMBER_COLORS = [
  "#1E3A5F",
  "#3B82F6",
  "#2563EB",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

const AppContext = createContext<AppContextValue | null>(null);

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { userId, userEmail, token, signOut } = useMockAuth();

  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [currentUserName, setCurrentUserNameState] = useState<string>("You");
  const [currentUserUpiId, setCurrentUserUpiIdState] = useState<string>("");
  const [currentUserAvatar, setCurrentUserAvatarState] = useState<string>("");
  const [currentUserTravelStyle, setCurrentUserTravelStyleState] = useState<string>("");
  const [groupBanter, setGroupBanter] = useState<Record<string, BanterMessage[]>>({});
  const [loading, setLoading] = useState(false);

  const currentUserId = userId;

  const activitiesRef = useRef<ActivityEntry[]>([]);
  useEffect(() => {
    activitiesRef.current = activities;
  }, [activities]);

  // ── API helper ──────────────────────────────────────────────────────────────

  const apiFetch = useCallback(
    async (path: string, options?: RequestInit): Promise<unknown> => {
const res = await fetch(`${API_BASE}${path}`, { 
           ...options,
           headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options?.headers ?? {}),
        },
      });
      if (res.status === 401) {
        // Session expired or invalid — sign out so user can log in again
        await signOut();
        throw new Error("Session expired. Please sign in again.");
      }
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        throw new Error((data.error as string) ?? `HTTP ${res.status}`);
      }
      return data;
    },
    [token, signOut]
  );

  // ── Banter ──────────────────────────────────────────────────────────────────

  const pushBanter = useCallback((groupId: string, message: string, emoji: string) => {
    const entry: BanterMessage = {
      id: generateId(),
      groupId,
      message,
      emoji,
      createdAt: new Date().toISOString(),
    };
    setGroupBanter((prev) => ({
      ...prev,
      [groupId]: [entry, ...(prev[groupId] ?? [])].slice(0, 30),
    }));
  }, []);

  // ── Load from API ───────────────────────────────────────────────────────────

  const loadFromApi = useCallback(async () => {
    if (!token || !userId) return;
    setLoading(true);
    try {
      const [groupsData, profileData] = await Promise.all([
        apiFetch("/groups") as Promise<{ groups: ApiGroup[] }>,
        apiFetch("/me") as Promise<{ name: string; upiId: string; avatar: string; travelStyle: string }>,
      ]);

      const gs: Group[] = [];
      const exps: Expense[] = [];
      const setts: Settlement[] = [];
      const acts: ActivityEntry[] = [];

      for (const ag of groupsData.groups) {
        gs.push({
          id: ag.id,
          name: ag.name,
          emoji: ag.emoji,
          description: ag.description,
          members: ag.members.map((m) => ({
            id: m.id,
            name: m.id === currentUserId ? (profileData.name || "You") : m.name,
            color: m.color,
            upiId: m.upiId,
            avatar: m.avatar,
            travelStyle: (m as { travelStyle?: string }).travelStyle,
          })),
          createdAt: ag.createdAt,
          tagNumber: ag.tagNumber,
        });
        exps.push(...ag.expenses);
        setts.push(...ag.settlements);
        acts.push(...(ag.activities as ActivityEntry[]));
      }

      setGroups(gs);
      setExpenses(exps);
      setSettlements(setts);
      setActivities(acts);

      if (profileData.name) setCurrentUserNameState(profileData.name);
      if (profileData.upiId) setCurrentUserUpiIdState(profileData.upiId);
      if (profileData.avatar) setCurrentUserAvatarState(profileData.avatar);
      if (profileData.travelStyle !== undefined) setCurrentUserTravelStyleState(profileData.travelStyle);
    } catch {
      // Network error — keep existing state
    } finally {
      setLoading(false);
    }
  }, [token, userId, currentUserId, apiFetch]);

  // Reload when auth changes
  useEffect(() => {
    if (token && userId) {
      void loadFromApi();
    } else {
      setGroups([]);
      setExpenses([]);
      setSettlements([]);
      setActivities([]);
    }
  }, [token, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshGroups = useCallback(() => loadFromApi(), [loadFromApi]);

  // Refresh when app comes back to foreground
  useEffect(() => {
    if (!token || !userId) return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void loadFromApi();
    });
    return () => sub.remove();
  }, [token, userId, loadFromApi]);

  // Poll every 10s while app is active
  useEffect(() => {
    if (!token || !userId) return;
    const id = setInterval(() => {
      if (AppState.currentState === "active") void loadFromApi();
    }, 10_000);
    return () => clearInterval(id);
  }, [token, userId, loadFromApi]);

  // ── Activity helpers ────────────────────────────────────────────────────────

  const logActivity = useCallback(
    async (entry: Omit<ActivityEntry, "id">) => {
      const full: ActivityEntry = { ...entry, id: generateId() };
      setActivities((prev) => [full, ...prev].slice(0, 200));
      try {
        await apiFetch(`/groups/${entry.groupId}/activities`, {
          method: "POST",
          body: JSON.stringify(full),
        });
      } catch {
        // Non-critical; ignore
      }
    },
    [apiFetch]
  );

  // ── createGroup ─────────────────────────────────────────────────────────────

  const createGroup = useCallback(
    async (name: string, emoji: string, description?: string): Promise<Group> => {
      const youMember: Member = {
        id: currentUserId,
        name: currentUserName,
        color: MEMBER_COLORS[0],
        upiId: currentUserUpiId || undefined,
        avatar: currentUserAvatar || undefined,
      };
      const group: Group = {
        id: generateId(),
        name,
        emoji,
        description,
        members: [youMember],
        createdAt: new Date().toISOString(),
      };

      // Optimistic update
      setGroups((prev) => [group, ...prev]);

      try {
        const data = await apiFetch("/groups", {
          method: "POST",
          body: JSON.stringify({
            id: group.id,
            name,
            emoji,
            description,
            members: [{ id: youMember.id, name: youMember.name, color: youMember.color, upiId: youMember.upiId }],
          }),
        }) as { tagNumber?: string };

        if (data.tagNumber) {
          setGroups((prev) =>
            prev.map((g) => (g.id === group.id ? { ...g, tagNumber: data.tagNumber } : g))
          );
          return { ...group, tagNumber: data.tagNumber };
        }
      } catch {
        // Revert on failure
        setGroups((prev) => prev.filter((g) => g.id !== group.id));
        throw new Error("Failed to create group. Please try again.");
      }
      return group;
    },
    [currentUserId, currentUserName, currentUserUpiId, currentUserAvatar, apiFetch]
  );

  // ── updateGroup ─────────────────────────────────────────────────────────────

  const updateGroup = useCallback(
    async (groupId: string, updates: Partial<Group>) => {
      const existing = groups.find((g) => g.id === groupId);

      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g)));

      try {
        await apiFetch(`/groups/${groupId}`, {
          method: "PUT",
          body: JSON.stringify(updates),
        });

        if (existing) {
          const changed: string[] = [];
          if (updates.name && updates.name !== existing.name) changed.push(`name → "${updates.name}"`);
          if (updates.emoji && updates.emoji !== existing.emoji) changed.push(`icon → ${updates.emoji}`);
          if (updates.description !== undefined && updates.description !== existing.description)
            changed.push("description updated");
          if (changed.length > 0) {
            await logActivity({
              type: "group_edited",
              groupId,
              label: `Group "${updates.name ?? existing.name}" edited`,
              meta: changed.join(", "),
              date: new Date().toISOString(),
            });
          }
        }
      } catch {
        // Revert
        if (existing) setGroups((prev) => prev.map((g) => (g.id === groupId ? existing : g)));
        throw new Error("Failed to update group.");
      }
    },
    [groups, apiFetch, logActivity]
  );

  // ── deleteGroup ─────────────────────────────────────────────────────────────

  const deleteGroup = useCallback(
    async (groupId: string) => {
      const prevGroups = [...groups];
      const prevExpenses = [...expenses];
      const prevSettlements = [...settlements];

      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setExpenses((prev) => prev.filter((e) => e.groupId !== groupId));
      setSettlements((prev) => prev.filter((s) => s.groupId !== groupId));

      try {
        await apiFetch(`/groups/${groupId}`, { method: "DELETE" });
      } catch {
        setGroups(prevGroups);
        setExpenses(prevExpenses);
        setSettlements(prevSettlements);
        throw new Error("Failed to delete group.");
      }
    },
    [groups, expenses, settlements, apiFetch]
  );

  // ── joinGroup ───────────────────────────────────────────────────────────────

  const joinGroup = useCallback(
    async (tag: string): Promise<Group | null> => {
      try {
        const data = await apiFetch("/groups/join", {
          method: "POST",
          body: JSON.stringify({
            tag,
            memberLocalId: currentUserId,
            name: currentUserName,
            color: MEMBER_COLORS[0],
          }),
        }) as { group: ApiGroup };

        const ag = data.group;
        const newGroup: Group = {
          id: ag.id,
          name: ag.name,
          emoji: ag.emoji,
          description: ag.description,
          members: ag.members.map((m) => ({
            id: m.id,
            name: m.id === currentUserId ? (currentUserName || "You") : m.name,
            color: m.color,
            upiId: m.upiId,
            avatar: m.avatar,
          })),
          createdAt: ag.createdAt,
          tagNumber: ag.tagNumber,
        };

        setGroups((prev) => {
          if (prev.some((g) => g.id === newGroup.id)) {
            return prev.map((g) => (g.id === newGroup.id ? newGroup : g));
          }
          return [newGroup, ...prev];
        });
        setExpenses((prev) => [
          ...prev.filter((e) => e.groupId !== newGroup.id),
          ...ag.expenses,
        ]);
        setSettlements((prev) => [
          ...prev.filter((s) => s.groupId !== newGroup.id),
          ...ag.settlements,
        ]);
        setActivities((prev) => [
          ...prev.filter((a) => a.groupId !== newGroup.id),
          ...(ag.activities as ActivityEntry[]),
        ]);

        return newGroup;
      } catch (err) {
        throw err;
      }
    },
    [currentUserId, currentUserName, apiFetch]
  );

  // ── addMember ───────────────────────────────────────────────────────────────

  const addMember = useCallback(
    async (groupId: string, name: string): Promise<Member> => {
      const member: Member = {
        id: generateId(),
        name,
        color: MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)],
      };

      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, members: [...g.members, member] } : g
        )
      );

      try {
        await apiFetch(`/groups/${groupId}/members`, {
          method: "POST",
          body: JSON.stringify({ memberId: member.id, name: member.name, color: member.color }),
        });
      } catch {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === groupId
              ? { ...g, members: g.members.filter((m) => m.id !== member.id) }
              : g
          )
        );
        throw new Error("Failed to add member.");
      }
      return member;
    },
    [apiFetch]
  );

  // ── removeMember ────────────────────────────────────────────────────────────

  const removeMember = useCallback(
    async (groupId: string, memberId: string) => {
      const prevGroups = [...groups];
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, members: g.members.filter((m) => m.id !== memberId) }
            : g
        )
      );
      try {
        await apiFetch(`/groups/${groupId}/members/${memberId}`, { method: "DELETE" });
      } catch {
        setGroups(prevGroups);
        throw new Error("Failed to remove member.");
      }
    },
    [groups, apiFetch]
  );

  // ── addExpense ──────────────────────────────────────────────────────────────

  const addExpense = useCallback(
    async (expenseData: Omit<Expense, "id">): Promise<Expense> => {
      const expense: Expense = { ...expenseData, id: generateId() };

      const group = groups.find((g) => g.id === expenseData.groupId);
      const payer = group?.members.find((m) => m.id === expenseData.paidById);
      const payerName = payer?.id === currentUserId ? "You" : (payer?.name ?? "Someone");
      const groupExpenses = expenses.filter((e) => e.groupId === expenseData.groupId);
      const avgAmount =
        groupExpenses.length > 0
          ? groupExpenses.reduce((s, e) => s + e.amount, 0) / groupExpenses.length
          : 0;
      const { message, emoji } = banterForExpense(
        expenseData.title,
        expenseData.amount,
        payerName,
        avgAmount
      );
      pushBanter(expenseData.groupId, message, emoji);

      if (group) {
        const gSettlements = settlements.filter((s) => s.groupId === expenseData.groupId);
        const newInsights = computeInsightsFn(
          group.members,
          [expense, ...groupExpenses],
          gSettlements,
          currentUserId
        );
        const atmUser = newInsights.find((u) => u.role === "The ATM");
        if (atmUser && atmUser.memberId === expenseData.paidById) {
          const b = banterForRole(atmUser.name, "The ATM");
          if (b) pushBanter(expenseData.groupId, b.message, b.emoji);
        }
      }

      setExpenses((prev) => [expense, ...prev]);

      try {
        await apiFetch(`/groups/${expense.groupId}/expenses`, {
          method: "POST",
          body: JSON.stringify({
            id: expense.id,
            title: expense.title,
            amount: expense.amount,
            paidById: expense.paidById,
            splitType: expense.splitType,
            category: expense.category,
            date: expense.date,
            notes: expense.notes,
            splits: expense.splits,
          }),
        });
      } catch {
        setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
        throw new Error("Failed to save expense.");
      }
      return expense;
    },
    [groups, expenses, settlements, currentUserId, apiFetch, pushBanter]
  );

  // ── updateExpense ───────────────────────────────────────────────────────────

  const updateExpense = useCallback(
    async (expenseId: string, updates: Partial<Omit<Expense, "id" | "groupId">>) => {
      const existing = expenses.find((e) => e.id === expenseId);
      setExpenses((prev) => prev.map((e) => (e.id === expenseId ? { ...e, ...updates } : e)));

      try {
        await apiFetch(`/expenses/${expenseId}`, {
          method: "PUT",
          body: JSON.stringify(updates),
        });
        if (existing) {
          await logActivity({
            type: "expense_edited",
            groupId: existing.groupId,
            label: `Edited "${updates.title ?? existing.title}"`,
            meta:
              updates.amount !== undefined
                ? `Amount: ₹${existing.amount} → ₹${updates.amount}`
                : "Details updated",
            date: new Date().toISOString(),
          });
        }
      } catch {
        if (existing) setExpenses((prev) => prev.map((e) => (e.id === expenseId ? existing : e)));
        throw new Error("Failed to update expense.");
      }
    },
    [expenses, apiFetch, logActivity]
  );

  // ── deleteExpense ───────────────────────────────────────────────────────────

  const deleteExpense = useCallback(
    async (expenseId: string) => {
      const existing = expenses.find((e) => e.id === expenseId);
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));

      try {
        await apiFetch(`/expenses/${expenseId}`, { method: "DELETE" });
        if (existing) {
          await logActivity({
            type: "expense_deleted",
            groupId: existing.groupId,
            label: `Deleted "${existing.title}"`,
            meta: `₹${existing.amount.toLocaleString("en-IN")}`,
            date: new Date().toISOString(),
          });
        }
      } catch {
        if (existing) setExpenses((prev) => [existing, ...prev]);
        throw new Error("Failed to delete expense.");
      }
    },
    [expenses, apiFetch, logActivity]
  );

  // ── addSettlement ───────────────────────────────────────────────────────────

  const addSettlement = useCallback(
    async (settlementData: Omit<Settlement, "id">): Promise<Settlement> => {
      const settlement: Settlement = { ...settlementData, id: generateId() };

      const group = groups.find((g) => g.id === settlementData.groupId);
      const fromMember = group?.members.find((m) => m.id === settlementData.fromId);
      const toMember = group?.members.find((m) => m.id === settlementData.toId);
      const fromName = fromMember?.id === currentUserId ? "You" : (fromMember?.name ?? "Someone");
      const toName = toMember?.id === currentUserId ? "You" : (toMember?.name ?? "Someone");
      const { message, emoji } = banterForSettlement(fromName, toName, settlementData.amount);
      pushBanter(settlementData.groupId, message, emoji);

      if (group) {
        const gExpenses = expenses.filter((e) => e.groupId === settlementData.groupId);
        const gSettlements = settlements.filter((s) => s.groupId === settlementData.groupId);
        const newInsights = computeInsightsFn(
          group.members,
          gExpenses,
          [settlement, ...gSettlements],
          currentUserId
        );
        const flashUser = newInsights.find((u) => u.role === "Flash Pay");
        if (flashUser && flashUser.memberId === settlementData.fromId) {
          const b = banterForRole(flashUser.name, "Flash Pay");
          if (b) pushBanter(settlementData.groupId, b.message, b.emoji);
        }
      }

      setSettlements((prev) => [settlement, ...prev]);

      try {
        await apiFetch(`/groups/${settlement.groupId}/settlements`, {
          method: "POST",
          body: JSON.stringify({
            id: settlement.id,
            fromId: settlement.fromId,
            toId: settlement.toId,
            amount: settlement.amount,
            date: settlement.date,
            mode: settlement.mode,
          }),
        });
      } catch {
        setSettlements((prev) => prev.filter((s) => s.id !== settlement.id));
        throw new Error("Failed to save settlement.");
      }
      return settlement;
    },
    [groups, expenses, settlements, currentUserId, apiFetch, pushBanter]
  );

  // ── Profile setters ─────────────────────────────────────────────────────────

  const setCurrentUserName = useCallback(
    async (name: string) => {
      setCurrentUserNameState(name);
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          members: g.members.map((m) =>
            m.id === currentUserId ? { ...m, name } : m
          ),
        }))
      );
      try {
        await apiFetch("/me", { method: "PUT", body: JSON.stringify({ name }) });
        // Also sync member names in all groups
        for (const g of groups) {
          const myMember = g.members.find((m) => m.id === currentUserId);
          if (myMember) {
            await apiFetch(`/groups/${g.id}/members/${currentUserId}`, {
              method: "PUT",
              body: JSON.stringify({ name }),
            });
          }
        }
      } catch {
        // Non-critical; state already updated
      }
    },
    [currentUserId, groups, apiFetch]
  );

  const setCurrentUserPaymentInfo = useCallback(
    async (upiId: string) => {
      setCurrentUserUpiIdState(upiId);
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          members: g.members.map((m) =>
            m.id === currentUserId ? { ...m, upiId } : m
          ),
        }))
      );
      try {
        await apiFetch("/me", { method: "PUT", body: JSON.stringify({ upiId }) });
        for (const g of groups) {
          const myMember = g.members.find((m) => m.id === currentUserId);
          if (myMember) {
            await apiFetch(`/groups/${g.id}/members/${currentUserId}`, {
              method: "PUT",
              body: JSON.stringify({ upiId }),
            });
          }
        }
      } catch {
        // Non-critical
      }
    },
    [currentUserId, groups, apiFetch]
  );

  const setCurrentUserAvatar = useCallback(
    async (avatar: string) => {
      setCurrentUserAvatarState(avatar);
      try {
        await apiFetch("/me", { method: "PUT", body: JSON.stringify({ avatar }) });
      } catch {
        // Non-critical
      }
    },
    [apiFetch]
  );

  const setCurrentUserTravelStyle = useCallback(
    async (travelStyle: string) => {
      setCurrentUserTravelStyleState(travelStyle);
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          members: g.members.map(
            (m) => m.id === currentUserId ? { ...m, travelStyle } : m
          ),
        }))
      );
      try {
        await apiFetch("/me", { method: "PUT", body: JSON.stringify({ travelStyle }) });
      } catch {
        // Non-critical
      }
    },
    [currentUserId, apiFetch]
  );

  // ── Read-only computations ──────────────────────────────────────────────────

  const getGroupExpenses = useCallback(
    (groupId: string) => expenses.filter((e) => e.groupId === groupId),
    [expenses]
  );

  const getGroupSettlements = useCallback(
    (groupId: string) => settlements.filter((s) => s.groupId === groupId),
    [settlements]
  );

  const getGroupBalances = useCallback(
    (groupId: string): Balance[] => {
      const groupExpenses = expenses.filter((e) => e.groupId === groupId);
      const groupSettlements = settlements.filter((s) => s.groupId === groupId);
      const group = groups.find((g) => g.id === groupId);
      if (!group) return [];

      const netBalance: Record<string, Record<string, number>> = {};

      for (const expense of groupExpenses) {
        for (const split of expense.splits) {
          if (split.memberId === expense.paidById) continue;
          const owerId = split.memberId;
          const lenderId = expense.paidById;
          if (!netBalance[owerId]) netBalance[owerId] = {};
          netBalance[owerId][lenderId] = (netBalance[owerId][lenderId] ?? 0) + split.amount;
        }
      }

      for (const settlement of groupSettlements) {
        const payerId = settlement.fromId;
        const receiverId = settlement.toId;
        if (netBalance[payerId]?.[receiverId]) {
          netBalance[payerId][receiverId] = Math.max(
            0,
            (netBalance[payerId][receiverId] ?? 0) - settlement.amount
          );
        }
      }

      const balances: Balance[] = [];
      for (const [fromId, toMap] of Object.entries(netBalance)) {
        for (const [toId, amount] of Object.entries(toMap)) {
          if (Math.round(amount) >= 1) balances.push({ fromId, toId, amount: Math.round(amount) });
        }
      }
      return balances;
    },
    [expenses, settlements, groups]
  );

  const getSimplifiedDebts = useCallback(
    (groupId: string): Balance[] => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return [];

      const balances = getGroupBalances(groupId);
      const net: Record<string, number> = {};
      for (const member of group.members) net[member.id] = 0;
      for (const b of balances) {
        net[b.fromId] = (net[b.fromId] ?? 0) - b.amount;
        net[b.toId] = (net[b.toId] ?? 0) + b.amount;
      }

      const creditors = Object.entries(net)
        .filter(([, v]) => Math.round(v) >= 1)
        .sort((a, b) => b[1] - a[1]);
      const debtors = Object.entries(net)
        .filter(([, v]) => Math.round(v) <= -1)
        .map(([id, v]) => [id, -v] as [string, number])
        .sort((a, b) => b[1] - a[1]);

      const simplified: Balance[] = [];
      let ci = 0;
      let di = 0;
      const cred = creditors.map(([id, v]) => ({ id, v }));
      const debt = debtors.map(([id, v]) => ({ id, v }));

      while (ci < cred.length && di < debt.length) {
        const c = cred[ci];
        const d = debt[di];
        const amount = Math.min(c.v, d.v);
        if (Math.round(amount) >= 1) simplified.push({ fromId: d.id, toId: c.id, amount: Math.round(amount) });
        c.v -= amount;
        d.v -= amount;
        if (c.v < 0.01) ci++;
        if (d.v < 0.01) di++;
      }
      return simplified;
    },
    [groups, getGroupBalances]
  );

  const getMemberBalance = useCallback(
    (groupId: string, memberId: string): number => {
      const debts = getSimplifiedDebts(groupId);
      let balance = 0;
      for (const d of debts) {
        if (d.toId === memberId) balance += d.amount;
        if (d.fromId === memberId) balance -= d.amount;
      }
      return balance;
    },
    [getSimplifiedDebts]
  );

  const computeGroupInsights = useCallback(
    (groupId: string): UserInsight[] => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return [];
      const gExpenses = expenses.filter((e) => e.groupId === groupId);
      const gSettlements = settlements.filter((s) => s.groupId === groupId);
      return computeInsightsFn(group.members, gExpenses, gSettlements, currentUserId);
    },
    [groups, expenses, settlements, currentUserId]
  );

  const getGroupBanter = useCallback(
    (groupId: string): BanterMessage[] => groupBanter[groupId] ?? [],
    [groupBanter]
  );

  const getRecentActivity = useCallback(() => {
    const items: Array<{
      type: "expense" | "settlement" | "activity_log";
      item: Expense | Settlement | ActivityEntry;
      group: Group;
    }> = [];

    for (const expense of expenses) {
      const group = groups.find((g) => g.id === expense.groupId);
      if (group) items.push({ type: "expense", item: expense, group });
    }
    for (const settlement of settlements) {
      const group = groups.find((g) => g.id === settlement.groupId);
      if (group) items.push({ type: "settlement", item: settlement, group });
    }
    for (const entry of activitiesRef.current) {
      const group = groups.find((g) => g.id === entry.groupId);
      if (group) items.push({ type: "activity_log", item: entry, group });
    }

    return items
      .sort((a, b) => {
        const getDate = (x: typeof a) => {
          if (x.type === "activity_log") return (x.item as ActivityEntry).date;
          return (x.item as Expense | Settlement).date;
        };
        return new Date(getDate(b)).getTime() - new Date(getDate(a)).getTime();
      })
      .slice(0, 50);
  }, [expenses, settlements, groups, activities]);

  return (
    <AppContext.Provider
      value={{
        groups,
        expenses,
        settlements,
        activities,
        currentUserId,
        currentUserName,
        currentUserUpiId,
        currentUserAvatar,
        currentUserTravelStyle,
        loading,
        createGroup,
        updateGroup,
        deleteGroup,
        joinGroup,
        addMember,
        removeMember,
        addExpense,
        updateExpense,
        deleteExpense,
        addSettlement,
        getGroupExpenses,
        getGroupSettlements,
        getGroupBalances,
        getSimplifiedDebts,
        getMemberBalance,
        getRecentActivity,
        setCurrentUserName,
        setCurrentUserPaymentInfo,
        setCurrentUserAvatar,
        setCurrentUserTravelStyle,
        computeGroupInsights,
        getGroupBanter,
        refreshGroups,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// ── Local type for API response ───────────────────────────────────────────────

interface ApiGroup {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  tagNumber: string;
  createdAt: string;
  members: Array<{
    id: string;
    name: string;
    color: string;
    upiId?: string;
    avatar?: string;
    ownerEmail?: string;
  }>;
  expenses: Expense[];
  settlements: Settlement[];
  activities: Array<{
    id: string;
    type: string;
    groupId: string;
    label: string;
    meta: string;
    date: string;
  }>;
}
