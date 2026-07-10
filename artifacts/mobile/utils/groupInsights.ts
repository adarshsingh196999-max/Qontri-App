import { Expense, Member, Settlement } from "../context/AppContext";

export type Role =
  | "The ATM"
  | "The Borrower"
  | "Flash Pay"
  | "The Tracker"
  | "The Equalizer"
  | "The Regular";

export interface RoleMeta {
  emoji: string;
  description: string;
  bg: string;
  text: string;
}

export const ROLE_META: Record<Role, RoleMeta> = {
  "The ATM":       { emoji: "🏦", description: "Always picking up the tab",         bg: "#EFF6FF", text: "#1E3A5F" },
  "The Borrower":  { emoji: "😏", description: "Racking up the dues",               bg: "#FEF2F2", text: "#991B1B" },
  "Flash Pay":     { emoji: "⚡", description: "Settles debts at lightning speed",   bg: "#FFFBEB", text: "#92400E" },
  "The Tracker":   { emoji: "📊", description: "On top of every expense",           bg: "#EFF6FF", text: "#1E40AF" },
  "The Equalizer": { emoji: "⚖️", description: "Always keeps it balanced",          bg: "#EFF6FF", text: "#1E3A5F" },
  "The Regular":   { emoji: "⭐", description: "Just vibing",                        bg: "#F9FAFB", text: "#374151" },
};

export interface UserInsight {
  memberId: string;
  name: string;
  color: string;
  avatar?: string;
  role: Role;
  totalPaid: number;
  totalOwed: number;
  expensesAdded: number;
  settlementsCount: number;
  netBalance: number;
}

export interface BanterMessage {
  id: string;
  groupId: string;
  message: string;
  emoji: string;
  createdAt: string;
}

export function computeGroupInsights(
  members: Member[],
  expenses: Expense[],
  settlements: Settlement[],
  currentUserId: string
): UserInsight[] {
  if (members.length === 0) return [];

  const metrics: Record<string, {
    totalPaid: number;
    totalOwed: number;
    expensesAdded: number;
    settlementsCount: number;
    netBalance: number;
  }> = {};

  for (const m of members) {
    metrics[m.id] = { totalPaid: 0, totalOwed: 0, expensesAdded: 0, settlementsCount: 0, netBalance: 0 };
  }

  for (const expense of expenses) {
    if (metrics[expense.paidById] !== undefined) {
      metrics[expense.paidById].totalPaid += expense.amount;
      metrics[expense.paidById].expensesAdded += 1;
    }
    for (const split of expense.splits) {
      if (split.memberId !== expense.paidById && metrics[split.memberId] !== undefined) {
        metrics[split.memberId].totalOwed += split.amount;
      }
    }
  }

  for (const s of settlements) {
    if (metrics[s.fromId] !== undefined) metrics[s.fromId].settlementsCount += 1;
  }

  const netMap: Record<string, number> = {};
  for (const m of members) netMap[m.id] = 0;
  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (split.memberId !== expense.paidById) {
        if (netMap[expense.paidById] !== undefined) netMap[expense.paidById] += split.amount;
        if (netMap[split.memberId] !== undefined) netMap[split.memberId] -= split.amount;
      }
    }
  }
  for (const s of settlements) {
    if (netMap[s.fromId] !== undefined) netMap[s.fromId] += s.amount;
    if (netMap[s.toId] !== undefined) netMap[s.toId] -= s.amount;
  }
  for (const m of members) {
    metrics[m.id].netBalance = netMap[m.id] ?? 0;
  }

  const assigned = new Set<string>();
  const roles: Record<string, Role> = {};

  const pick1 = (
    filter: (m: Member) => boolean,
    sort: (a: Member, b: Member) => number
  ): Member | undefined => members.filter(m => !assigned.has(m.id) && filter(m)).sort(sort)[0];

  const atm = pick1(
    m => metrics[m.id].totalPaid > 0,
    (a, b) => metrics[b.id].totalPaid - metrics[a.id].totalPaid
  );
  if (atm) { roles[atm.id] = "The ATM"; assigned.add(atm.id); }

  const borrower = pick1(
    m => metrics[m.id].totalOwed > 0,
    (a, b) => metrics[b.id].totalOwed - metrics[a.id].totalOwed
  );
  if (borrower) { roles[borrower.id] = "The Borrower"; assigned.add(borrower.id); }

  const flash = pick1(
    m => metrics[m.id].settlementsCount > 0,
    (a, b) => metrics[b.id].settlementsCount - metrics[a.id].settlementsCount
  );
  if (flash) { roles[flash.id] = "Flash Pay"; assigned.add(flash.id); }

  const tracker = pick1(
    m => metrics[m.id].expensesAdded > 0,
    (a, b) => metrics[b.id].expensesAdded - metrics[a.id].expensesAdded
  );
  if (tracker) { roles[tracker.id] = "The Tracker"; assigned.add(tracker.id); }

  const equalizer = pick1(
    () => true,
    (a, b) => Math.abs(metrics[a.id].netBalance) - Math.abs(metrics[b.id].netBalance)
  );
  if (equalizer) { roles[equalizer.id] = "The Equalizer"; assigned.add(equalizer.id); }

  for (const m of members) {
    if (!assigned.has(m.id)) roles[m.id] = "The Regular";
  }

  return members.map(m => ({
    memberId: m.id,
    name: m.id === currentUserId ? "You" : m.name,
    color: m.color,
    avatar: m.avatar,
    role: roles[m.id] ?? "The Regular",
    ...metrics[m.id],
  }));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type NameFn = (name: string) => string;

const ATM_BANTERS: NameFn[] = [
  n => `${n} just became the group ATM 🏦`,
  n => `${n} is funding everyone again 💸`,
  n => `${n} to the rescue — wallet wide open! 💳`,
  n => `Somebody stop ${n} before they go broke! 🤑`,
];

const BORROWER_BANTERS: NameFn[] = [
  n => `${n} is leading in dues 😏`,
  n => `${n}, bro… time to pay? 👀`,
  n => `${n} collects debts like Pokémon cards 😂`,
  n => `${n}'s tab is getting spicy 🌶️`,
  n => `The group bank is waiting for you, ${n} 🏦`,
];

const FLASH_BANTERS: NameFn[] = [
  n => `${n} paid faster than we could blink ⚡`,
  n => `${n} doesn't sleep on debts — respect! 🙌`,
  n => `The settlement speedster is ${n} ⚡`,
];

const TRACKER_BANTERS: NameFn[] = [
  n => `${n} never forgets a rupee 📊`,
  n => `${n} is the unofficial CFO of this group 📋`,
  n => `The group treasurer has spoken — ${n} is on it! 📊`,
];

const EQUALIZER_BANTERS: NameFn[] = [
  n => `${n} is the peacekeeper — perfectly balanced ⚖️`,
  n => `${n} keeps the scales even, as all things should be ⚖️`,
];

const BIG_EXPENSE_BANTERS = [
  (title: string, amount: number) => `Big spender alert 💸 — "${title}" at ₹${Math.round(amount).toLocaleString("en-IN")}!`,
  (title: string, amount: number) => `Whoa! ₹${Math.round(amount).toLocaleString("en-IN")} on "${title}"?! We're going all out 🚀`,
  (title: string) => `"${title}" just dented the group wallet 💰 Ouch.`,
  (title: string, amount: number) => `₹${Math.round(amount).toLocaleString("en-IN")} for "${title}"? No regrets 😎`,
];

const EXPENSE_BANTERS = [
  (title: string, payer: string) => `${payer} just logged "${title}" 📝`,
  (title: string, payer: string) => `${payer} added "${title}" — no free lunch 🍽️`,
  (title: string, payer: string) => `"${title}" is on ${payer}'s tab 💳`,
];

const SETTLEMENT_BANTERS = [
  (from: string, to: string, amt: number) => `${from} paid ₹${Math.round(amt).toLocaleString("en-IN")} to ${to} — karma restored ✅`,
  (from: string, to: string, amt: number) => `${from} cleared ₹${Math.round(amt).toLocaleString("en-IN")} with ${to} 🙌`,
  (from: string, _to: string, amt: number) => `₹${Math.round(amt).toLocaleString("en-IN")} dropped by ${from} — debts don't stand a chance 💪`,
  (from: string, to: string) => `${from} → ${to}: debt squashed. Friends again! 🤝`,
];

export function banterForRole(name: string, role: Role): { message: string; emoji: string } | null {
  switch (role) {
    case "The ATM":       return { message: pickRandom(ATM_BANTERS)(name),       emoji: "🏦" };
    case "The Borrower":  return { message: pickRandom(BORROWER_BANTERS)(name),  emoji: "😏" };
    case "Flash Pay":     return { message: pickRandom(FLASH_BANTERS)(name),     emoji: "⚡" };
    case "The Tracker":   return { message: pickRandom(TRACKER_BANTERS)(name),   emoji: "📊" };
    case "The Equalizer": return { message: pickRandom(EQUALIZER_BANTERS)(name), emoji: "⚖️" };
    default: return null;
  }
}

export function banterForExpense(
  title: string,
  amount: number,
  payerName: string,
  avgExpenseAmount: number
): { message: string; emoji: string } {
  const isHighValue = amount > Math.max(1500, avgExpenseAmount * 1.5);
  if (isHighValue) {
    const fn = pickRandom(BIG_EXPENSE_BANTERS);
    return { message: fn(title, amount), emoji: "💸" };
  }
  const fn = pickRandom(EXPENSE_BANTERS);
  return { message: fn(title, payerName), emoji: "📝" };
}

export function banterForSettlement(
  fromName: string,
  toName: string,
  amount: number
): { message: string; emoji: string } {
  const fn = pickRandom(SETTLEMENT_BANTERS);
  return { message: fn(fromName, toName, amount), emoji: "✅" };
}
