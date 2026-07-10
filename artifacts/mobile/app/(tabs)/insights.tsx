import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G } from "react-native-svg";

import { CATEGORY_LIST, getCategoryColor, getCategoryIcon } from "@/components/CategoryBadge";
import { DatePickerField } from "@/components/DatePickerField";
import { useMockAuth } from "@/context/MockAuthContext";
import { useColors } from "@/hooks/useColors";

import { API_BASE } from "@/constants/api";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["M","T","W","T","F","S","S"];

interface IETExpense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  createdAt?: string;
}

type Tab = "overview" | "trends" | "heatmap";

function formatAmount(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

// ── Donut Chart ────────────────────────────────────────────────────────────────

function DonutChart({ data, total }: { data: { label: string; amount: number; color: string }[]; total: number }) {
  const size = 180;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;
  let offset = 0;
  const segments = data.map((item) => {
    const pct = total > 0 ? item.amount / total : 0;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const seg = { ...item, dash, gap, offset };
    offset += dash;
    return seg;
  });
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${cx},${cy}`}>
            {total === 0 ? (
              <Circle cx={cx} cy={cy} r={radius} stroke="#334155" strokeWidth={strokeWidth} fill="none" />
            ) : (
              segments.map((seg, i) => (
                <Circle key={i} cx={cx} cy={cy} r={radius}
                  stroke={seg.color} strokeWidth={strokeWidth} fill="none"
                  strokeDasharray={`${seg.dash} ${seg.gap}`}
                  strokeDashoffset={-seg.offset} strokeLinecap="butt" />
              ))
            )}
          </G>
        </Svg>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={s.donutTotal}>₹{formatAmount(total)}</Text>
            <Text style={s.donutLabel}>Total</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Monthly Bars ───────────────────────────────────────────────────────────────

function MonthlyBars({ data }: { data: { month: string; amount: number }[] }) {
  const max = Math.max(...data.map((d) => d.amount), 1);
  const barHeight = 100;
  return (
    <View style={s.barsRow}>
      {data.map((d, i) => {
        const h = Math.max((d.amount / max) * barHeight, d.amount > 0 ? 4 : 2);
        const isCurrent = i === data.length - 1;
        return (
          <View key={d.month + i} style={s.barCol}>
            <View style={[s.barTrack, { height: barHeight }]}>
              <View style={[s.barFill, { height: h, backgroundColor: isCurrent ? "#4A90D9" : "#2A4A6E" }]} />
            </View>
            <Text style={[s.barMonth, isCurrent && { color: "#4A90D9" }]}>{d.month}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Spending Heatmap ───────────────────────────────────────────────────────────

function SpendingHeatmap({ expenses }: { expenses: IETExpense[] }) {
  const colors = useColors();
  const now = new Date();
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Compute cell size: screen width minus section margin (16*2) and padding (16*2) divided by 7 cols
  const screenW = Dimensions.get("window").width;
  const CELL = Math.floor((screenW - 64) / 7);

  const monthExp = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const dayMap = new Map<number, number>();
  for (const e of monthExp) {
    const day = new Date(e.date).getDate();
    dayMap.set(day, (dayMap.get(day) ?? 0) + e.amount);
  }

  const maxAmt = Math.max(...Array.from(dayMap.values()), 1);

  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDayMon = (firstDayRaw + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build rows of 7 for a proper grid
  const allCells: (number | null)[] = [];
  for (let i = 0; i < firstDayMon; i++) allCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) allCells.push(d);
  // Pad to complete last row
  while (allCells.length % 7 !== 0) allCells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < allCells.length; i += 7) {
    rows.push(allCells.slice(i, i + 7));
  }

  type CellStyle = { bg: string; dayColor: string; amtColor: string };
  const getCellStyle = (day: number): CellStyle => {
    const amt = dayMap.get(day) ?? 0;
    if (amt === 0) return { bg: colors.border, dayColor: colors.mutedForeground, amtColor: "transparent" };
    const ratio = amt / maxAmt;
    if (ratio < 0.33) return { bg: "#D1FAE5", dayColor: "#065F46", amtColor: "#047857" };
    if (ratio < 0.67) return { bg: "#FEF3C7", dayColor: "#92400E", amtColor: "#B45309" };
    return { bg: "#FEE2E2", dayColor: "#991B1B", amtColor: "#B91C1C" };
  };

  const canGoNext = !(year === now.getFullYear() && month === now.getMonth());

  return (
    <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.heatmapHeader}>
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>Spending Heatmap</Text>
        <View style={s.heatmapNav}>
          <Pressable style={s.navBtn} onPress={() => setViewDate(new Date(year, month - 1, 1))}>
            <Feather name="chevron-left" size={18} color={colors.mutedForeground} />
          </Pressable>
          <Text style={[s.navMonth, { color: colors.foreground }]}>
            {MONTH_NAMES[month].slice(0, 3)} {year}
          </Text>
          <Pressable
            style={[s.navBtn, !canGoNext && { opacity: 0.3 }]}
            onPress={() => { if (canGoNext) setViewDate(new Date(year, month + 1, 1)); }}
            disabled={!canGoNext}
          >
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: "row", marginBottom: 4 }}>
        {DAY_LABELS.map((d, i) => (
          <View key={i} style={{ width: CELL, alignItems: "center" }}>
            <Text style={[s.dayHeaderText, { color: colors.mutedForeground }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar rows */}
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", marginBottom: 3 }}>
          {row.map((day, ci) => {
            if (day === null) {
              return <View key={`pad-${ri}-${ci}`} style={{ width: CELL, height: CELL }} />;
            }
            const cs = getCellStyle(day);
            const amt = dayMap.get(day) ?? 0;
            const isToday =
              year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
            return (
              <View key={day} style={{ width: CELL, height: CELL, padding: 2 }}>
                <View style={[
                  {
                    flex: 1,
                    borderRadius: 8,
                    backgroundColor: cs.bg,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  isToday && { borderWidth: 1.5, borderColor: "#4A90D9" },
                ]}>
                  <Text style={{
                    fontSize: Math.max(CELL * 0.28, 9),
                    fontFamily: "Inter_600SemiBold",
                    color: cs.dayColor,
                  }}>
                    {day}
                  </Text>
                  {amt > 0 && (
                    <Text style={{
                      fontSize: Math.max(CELL * 0.18, 7),
                      fontFamily: "Inter_500Medium",
                      color: cs.amtColor,
                    }}>
                      {amt >= 1000 ? `${(amt / 1000).toFixed(1)}k` : Math.round(amt)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ))}

      <View style={s.legendRow}>
        {([
          [colors.border, "None"],
          ["#D1FAE5", "Low"],
          ["#FEF3C7", "Moderate"],
          ["#FEE2E2", "High"],
        ] as [string, string][]).map(([color, label]) => (
          <View key={label} style={s.legendItem}>
            <View style={[s.legendSwatch, { backgroundColor: color }]} />
            <Text style={[s.legendText, { color: colors.mutedForeground }]}>{label}</Text>
          </View>
        ))}
      </View>

      {monthExp.length === 0 && (
        <Text style={[s.heatmapEmpty, { color: colors.mutedForeground }]}>
          No expenses recorded for this month — days shown in gray
        </Text>
      )}
    </View>
  );
}

// ── Budget Strip ───────────────────────────────────────────────────────────────

function BudgetStrip({ budget, spent, onEdit }: { budget: number; spent: number; onEdit: () => void }) {
  const colors = useColors();
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const barColor = pct < 60 ? "#22C55E" : pct < 85 ? "#FBBF24" : "#EF4444";

  if (budget === 0) {
    return (
      <Pressable
        style={[s.budgetStrip, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={onEdit}
      >
        <Feather name="target" size={14} color="#4A90D9" />
        <Text style={s.budgetSetLabel}>Set monthly budget →</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[s.budgetStrip, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onEdit}
    >
      <View style={s.budgetTopRow}>
        <View style={s.budgetLabelRow}>
          <Feather name="target" size={13} color={barColor} />
          <Text style={[s.budgetTitle, { color: colors.foreground }]}>Monthly Budget</Text>
        </View>
        <Text style={[s.budgetFraction, { color: colors.mutedForeground }]}>
          ₹{formatAmount(spent)} / ₹{formatAmount(budget)}
        </Text>
      </View>
      <View style={[s.budgetBar, { backgroundColor: colors.background }]}>
        <View style={[s.budgetBarFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
      </View>
      <View style={s.budgetBottomRow}>
        <Text style={[s.budgetPct, { color: barColor }]}>{Math.round(pct)}% used</Text>
        <Text style={[s.budgetRemain, { color: colors.mutedForeground }]}>
          {budget >= spent
            ? `₹${formatAmount(budget - spent)} remaining`
            : `₹${formatAmount(spent - budget)} over budget`}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Budget Modal ───────────────────────────────────────────────────────────────

function BudgetModal({
  visible,
  current,
  onSave,
  onClose,
}: {
  visible: boolean;
  current: number;
  onSave: (val: number) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [input, setInput] = useState(current > 0 ? String(current) : "");

  useEffect(() => {
    if (visible) setInput(current > 0 ? String(current) : "");
  }, [visible, current]);

  const handleSave = () => {
    const val = parseFloat(input);
    onSave(isNaN(val) || val <= 0 ? 0 : val);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.modalCard, { backgroundColor: colors.card }]}>
          <View style={s.modalHandle} />
          <Text style={[s.modalTitle, { color: colors.foreground }]}>Monthly Budget</Text>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Budget Amount (₹)</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            placeholder="e.g. 15000"
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            keyboardType="decimal-pad"
            autoFocus
          />
          {current > 0 && (
            <Pressable style={s.clearBudget} onPress={() => { onSave(0); onClose(); }}>
              <Text style={s.clearBudgetText}>Remove budget</Text>
            </Pressable>
          )}
          <View style={s.modalActions}>
            <Pressable style={[s.actionBtn, s.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={[s.actionBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[s.actionBtn, s.saveBtn]} onPress={handleSave}>
              <Text style={[s.actionBtnText, { color: "#fff" }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Add Expense Modal ──────────────────────────────────────────────────────────

function AddExpenseModal({
  visible,
  onClose,
  onSave,
  saving,
  editing,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (e: Omit<IETExpense, "id" | "createdAt">) => Promise<void>;
  saving: boolean;
  editing?: IETExpense | null;
}) {
  const colors = useColors();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().split("T")[0]);
  const [error, setError] = useState("");

  // Pre-fill when editing, reset when adding fresh
  useEffect(() => {
    if (visible) {
      if (editing) {
        setTitle(editing.title);
        setAmount(String(editing.amount));
        setCategory(editing.category || "Food");
        const d = editing.date.split("T")[0];
        setDateStr(d.length === 10 ? d : new Date().toISOString().split("T")[0]);
        setError("");
      } else {
        setTitle(""); setAmount(""); setCategory("Food");
        setDateStr(new Date().toISOString().split("T")[0]); setError("");
      }
    }
  }, [visible, editing]);

  const reset = () => {
    setTitle(""); setAmount(""); setCategory("Food");
    setDateStr(new Date().toISOString().split("T")[0]); setError("");
  };
  const handleClose = () => { if (saving) return; reset(); onClose(); };

  const handleSave = async () => {
    if (!title.trim()) { setError("Please enter a title."); return; }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setError("Please enter a valid amount."); return; }
    if (!dateStr || isNaN(new Date(dateStr).getTime())) { setError("Please enter a valid date."); return; }
    setError("");
    await onSave({ title: title.trim(), amount: parsedAmount, category, date: new Date(dateStr + "T12:00:00").toISOString() });
    reset();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <ScrollView
          style={[s.modalCard, { backgroundColor: colors.card }]}
          contentContainerStyle={{ paddingBottom: Platform.OS === "ios" ? 44 : 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.modalHandle} />
          <Text style={[s.modalTitle, { color: colors.foreground }]}>{editing ? "Edit Expense" : "Add Personal Expense"}</Text>

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Title</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            placeholder="e.g. Coffee, Uber, Grocery run"
            placeholderTextColor={colors.mutedForeground}
            value={title} onChangeText={(t) => { setError(""); setTitle(t); }}
            returnKeyType="next" autoCapitalize="sentences" editable={!saving}
          />

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Amount (₹)</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            placeholder="0" placeholderTextColor={colors.mutedForeground}
            value={amount} onChangeText={(t) => { setError(""); setAmount(t); }}
            keyboardType="decimal-pad" editable={!saving}
          />

          <DatePickerField
            label="Date"
            value={dateStr}
            onChange={setDateStr}
            disabled={saving}
            colors={colors}
          />

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
            <View style={s.catChipRow}>
              {CATEGORY_LIST.map((cat) => {
                const selected = category === cat;
                return (
                  <Pressable key={cat} style={[s.catChip, {
                    backgroundColor: selected ? getCategoryColor(cat) + "25" : colors.background,
                    borderColor: selected ? getCategoryColor(cat) : colors.border,
                  }]} onPress={() => setCategory(cat)} disabled={saving}>
                    <Text style={{ fontSize: 14 }}>{getCategoryIcon(cat)}</Text>
                    <Text style={[s.catChipText, { color: selected ? getCategoryColor(cat) : colors.mutedForeground }]}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <View style={s.modalActions}>
            <Pressable style={[s.actionBtn, s.cancelBtn, { borderColor: colors.border }]} onPress={handleClose} disabled={saving}>
              <Text style={[s.actionBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[s.actionBtn, s.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={[s.actionBtnText, { color: "#fff" }]}>{editing ? "Update" : "Save"}</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function IETScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useMockAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [expenses, setExpenses] = useState<IETExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingExpense, setEditingExpense] = useState<IETExpense | null>(null);
  const [budget, setBudget] = useState(0);
  const [showBudget, setShowBudget] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadExpenses = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/iet`, { headers: authHeader() });
      if (res.ok) setExpenses(await res.json() as IETExpense[]);
    } catch {} finally { setLoading(false); }
  }, [token, authHeader]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  useEffect(() => {
    if (!token) return;
    // Load budget from server (authoritative — syncs across all devices)
    fetch(`${API_BASE}/iet/budget`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() as Promise<{ budget: number }> : null)
      .then((data) => {
        if (data && typeof data.budget === "number") setBudget(data.budget);
      })
      .catch(() => {});
  }, [token]);

  const saveBudget = (val: number) => {
    setBudget(val);
    // Persist to server only — syncs across all devices
    if (token) {
      fetch(`${API_BASE}/iet/budget`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ budget: val }),
      }).catch(() => {});
    }
  };

  const handleAddExpense = useCallback(async (entry: Omit<IETExpense, "id" | "createdAt">) => {
    if (!token) return;
    setSaving(true);

    if (editingExpense) {
      // ── Edit mode: PUT ────────────────────────────────────────────────────
      const prevExpenses = expenses;
      setExpenses((prev) => prev.map((e) => e.id === editingExpense.id ? { ...e, ...entry } : e));
      setEditingExpense(null);
      setShowAdd(false);
      try {
        const res = await fetch(`${API_BASE}/iet/${editingExpense.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeader() },
          body: JSON.stringify(entry),
        });
        if (res.ok) {
          const updated = await res.json() as IETExpense;
          setExpenses((prev) => prev.map((e) => e.id === editingExpense.id ? updated : e));
        } else {
          setExpenses(prevExpenses);
        }
      } catch {
        setExpenses(prevExpenses);
      } finally { setSaving(false); }
      return;
    }

    // ── Add mode: POST ────────────────────────────────────────────────────
    const tempId = `iet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimistic: IETExpense = { ...entry, id: tempId };
    setExpenses((prev) => [optimistic, ...prev]);
    setShowAdd(false);
    try {
      const res = await fetch(`${API_BASE}/iet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ ...entry, id: tempId }),
      });
      if (res.ok) {
        const created = await res.json() as IETExpense;
        setExpenses((prev) => prev.map((e) => (e.id === tempId ? created : e)));
      } else {
        setExpenses((prev) => prev.filter((e) => e.id !== tempId));
      }
    } catch {
      setExpenses((prev) => prev.filter((e) => e.id !== tempId));
    } finally { setSaving(false); }
  }, [token, authHeader, editingExpense, expenses]);

  const handleDelete = useCallback(async (id: string) => {
    if (!token) return;
    const removed = expenses.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    try {
      const res = await fetch(`${API_BASE}/iet/${id}`, { method: "DELETE", headers: authHeader() });
      if (!res.ok && removed) setExpenses((prev) => [removed, ...prev]);
    } catch {
      if (removed) setExpenses((prev) => [removed, ...prev]);
    }
  }, [token, authHeader, expenses]);

  const stats = useMemo(() => {
    const thisMonthExp = expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const totalThisMonth = thisMonthExp.reduce((s, e) => s + e.amount, 0);
    const totalAllTime = expenses.reduce((s, e) => s + e.amount, 0);
    const categoryMap: Record<string, number> = {};
    for (const e of thisMonthExp) categoryMap[e.category] = (categoryMap[e.category] ?? 0) + e.amount;
    const categories = Object.entries(categoryMap)
      .map(([label, amount]) => ({ label, amount, color: getCategoryColor(label) }))
      .sort((a, b) => b.amount - a.amount).slice(0, 6);
    const monthly: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const m = d.getMonth(); const y = d.getFullYear();
      const total = expenses.reduce((s, e) => {
        const ed = new Date(e.date);
        if (ed.getMonth() !== m || ed.getFullYear() !== y) return s;
        return s + e.amount;
      }, 0);
      monthly.push({ month: MONTHS[m], amount: total });
    }
    const recent = [...expenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
    const daysInMonth = now.getDate();
    const avgDaily = daysInMonth > 0 ? totalThisMonth / daysInMonth : 0;
    const avgWeekly = avgDaily * 7;
    return { totalThisMonth, totalAllTime, categories, monthly, recent, avgDaily, avgWeekly };
  }, [expenses, thisMonth, thisYear]);

  const budgetPct = budget > 0 ? (stats.totalThisMonth / budget) * 100 : -1;
  const cardBg = budgetPct < 0
    ? "rgba(255,255,255,0.08)"
    : budgetPct < 60 ? "rgba(34,197,94,0.12)"
    : budgetPct < 85 ? "rgba(251,191,36,0.12)"
    : "rgba(239,68,68,0.12)";
  const cardBorder = budgetPct < 0
    ? "rgba(255,255,255,0.1)"
    : budgetPct < 60 ? "rgba(34,197,94,0.35)"
    : budgetPct < 85 ? "rgba(251,191,36,0.35)"
    : "rgba(239,68,68,0.35)";
  const cardAmountColor = budgetPct < 0 ? "#FFFFFF"
    : budgetPct < 60 ? "#4ADE80"
    : budgetPct < 85 ? "#FCD34D"
    : "#F87171";

  const tabItems: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "trends", label: "Trends" },
    { key: "heatmap", label: "Heatmap" },
  ];

  return (
    <>
      <ScrollView
        style={[s.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: bottomPad + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["#0A1628", "#0F2040", "#1E3A5F"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.hero, { paddingTop: topPad + 16 }]}
        >
          <View style={s.heroHeader}>
            <View>
              <Text style={s.heroTag}>Individual Expense Tracker</Text>
              <Text style={s.heroTitle}>IET</Text>
            </View>
            <Pressable style={s.addBtn} onPress={() => { setEditingExpense(null); setShowAdd(true); }}>
              <Feather name="plus" size={18} color="#fff" />
              <Text style={s.addBtnText}>Add Expense</Text>
            </Pressable>
          </View>

          <View style={[s.overviewCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={s.overviewLabel}>This Month's Personal Spend</Text>
            <Text style={[s.overviewAmount, { color: cardAmountColor }]}>
              ₹{formatAmount(stats.totalThisMonth)}
            </Text>
            {budget > 0 && (
              <View style={s.miniBar}>
                <View style={[s.miniBarFill, {
                  width: `${Math.min(budgetPct, 100)}%` as any,
                  backgroundColor: cardAmountColor,
                }]} />
              </View>
            )}
            <View style={s.overviewRow}>
              <View style={s.overviewItem}>
                <Text style={s.overviewItemLabel}>Daily avg</Text>
                <Text style={s.overviewItemValue}>₹{formatAmount(stats.avgDaily)}</Text>
              </View>
              <View style={s.overviewDivider} />
              <View style={s.overviewItem}>
                <Text style={s.overviewItemLabel}>Weekly avg</Text>
                <Text style={s.overviewItemValue}>₹{formatAmount(stats.avgWeekly)}</Text>
              </View>
              <View style={s.overviewDivider} />
              <View style={s.overviewItem}>
                <Text style={s.overviewItemLabel}>All-time</Text>
                <Text style={s.overviewItemValue}>₹{formatAmount(stats.totalAllTime)}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <BudgetStrip budget={budget} spent={stats.totalThisMonth} onEdit={() => setShowBudget(true)} />

        <View style={[s.tabsWrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
            {tabItems.map((t) => (
              <Pressable
                key={t.key}
                style={[s.tabBtn, tab === t.key && { borderBottomColor: "#4A90D9", borderBottomWidth: 2 }]}
                onPress={() => setTab(t.key)}
              >
                <Text style={[s.tabLabel, { color: tab === t.key ? "#4A90D9" : colors.mutedForeground }]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color="#4A90D9" />
            <Text style={[s.loadingText, { color: colors.mutedForeground }]}>Loading your expenses…</Text>
          </View>
        ) : (
          <>
            {tab === "overview" && (
              <>
                <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[s.sectionTitle, { color: colors.foreground }]}>Category Breakdown</Text>
                  <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>
                    {MONTHS[thisMonth]} {thisYear}
                  </Text>
                  {stats.totalThisMonth === 0 ? (
                    <View style={s.emptyChart}>
                      <Text style={s.emptyEmoji}>📊</Text>
                      <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No personal expenses this month</Text>
                      <Pressable style={s.emptyAddBtn} onPress={() => setShowAdd(true)}>
                        <Text style={s.emptyAddBtnText}>+ Add your first expense</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={s.donutWrap}>
                      <DonutChart data={stats.categories} total={stats.totalThisMonth} />
                      <View style={s.legendWrap}>
                        {stats.categories.map((c) => (
                          <View key={c.label} style={s.catLegendRow}>
                            <View style={[s.legendDot, { backgroundColor: c.color }]} />
                            <Text style={[s.legendLabel, { color: colors.foreground }]}>
                              {getCategoryIcon(c.label)} {c.label}
                            </Text>
                            <Text style={[s.legendPct, { color: colors.mutedForeground }]}>
                              {Math.round((c.amount / stats.totalThisMonth) * 100)}%
                            </Text>
                            <Text style={[s.legendAmt, { color: colors.foreground }]}>
                              ₹{formatAmount(c.amount)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[s.sectionTitle, { color: colors.foreground }]}>Recent Entries</Text>
                  {stats.recent.length === 0 ? (
                    <Text style={[s.emptyText, { color: colors.mutedForeground, textAlign: "center", paddingVertical: 20 }]}>
                      No entries yet
                    </Text>
                  ) : (
                    stats.recent.map((e, i) => {
                      const d = new Date(e.date);
                      const isToday = d.toDateString() === new Date().toDateString();
                      const timeStr = isToday
                        ? "Today"
                        : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                      return (
                        <View key={e.id} style={[s.txRow, i < stats.recent.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                          <View style={[s.txIcon, { backgroundColor: getCategoryColor(e.category) + "20" }]}>
                            <Text style={{ fontSize: 18 }}>{getCategoryIcon(e.category)}</Text>
                          </View>
                          <View style={s.txInfo}>
                            <Text style={[s.txTitle, { color: colors.foreground }]} numberOfLines={1}>{e.title}</Text>
                            <Text style={[s.txSub, { color: colors.mutedForeground }]}>{timeStr} · {e.category}</Text>
                          </View>
                          <Text style={[s.txAmt, { color: colors.foreground }]}>₹{formatAmount(e.amount)}</Text>
                          <Pressable style={s.editBtn} onPress={() => { setEditingExpense(e); setShowAdd(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Feather name="edit-2" size={13} color="#4A90D9" />
                          </Pressable>
                          <Pressable style={s.deleteBtn} onPress={() => handleDelete(e.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                          </Pressable>
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            )}

            {tab === "trends" && (
              <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>Monthly Spending</Text>
                <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>Last 6 months (personal only)</Text>
                {stats.totalAllTime === 0 ? (
                  <View style={s.emptyChart}>
                    <Text style={s.emptyEmoji}>📈</Text>
                    <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Start adding expenses to see trends</Text>
                  </View>
                ) : (
                  <>
                    <MonthlyBars data={stats.monthly} />
                    <View style={s.monthlyList}>
                      {[...stats.monthly].reverse().map((m, i) => (
                        <View key={m.month + i} style={[s.monthlyRow, i < stats.monthly.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                          <Text style={[s.monthlyMonth, { color: colors.mutedForeground }]}>{m.month}</Text>
                          <View style={s.monthlyBarWrap}>
                            <View style={[s.monthlyBarFill, {
                              width: `${Math.max((m.amount / Math.max(...stats.monthly.map((x) => x.amount), 1)) * 100, m.amount > 0 ? 4 : 0)}%` as any,
                              backgroundColor: i === 0 ? "#4A90D9" : "#2A4A6E",
                            }]} />
                          </View>
                          <Text style={[s.monthlyAmt, { color: colors.foreground }]}>₹{formatAmount(m.amount)}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}

            {tab === "heatmap" && <SpendingHeatmap expenses={expenses} />}
          </>
        )}
      </ScrollView>

      <AddExpenseModal
        visible={showAdd}
        onClose={() => { setShowAdd(false); setEditingExpense(null); }}
        onSave={handleAddExpense}
        saving={saving}
        editing={editingExpense}
      />
      <BudgetModal visible={showBudget} current={budget} onSave={saveBudget} onClose={() => setShowBudget(false)} />
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingHorizontal: 20, paddingBottom: 20 },
  heroHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 },
  heroTag: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.5)", marginBottom: 2, textTransform: "uppercase", letterSpacing: 1 },
  heroTitle: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#4A90D9", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, shadowColor: "#4A90D9", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4, marginTop: 6 },
  addBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
  overviewCard: { borderRadius: 18, padding: 18, borderWidth: 1 },
  overviewLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.5)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 },
  overviewAmount: { fontSize: 36, fontFamily: "Inter_700Bold", marginBottom: 12 },
  miniBar: { height: 4, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden", marginBottom: 14 },
  miniBarFill: { height: "100%", borderRadius: 2 },
  overviewRow: { flexDirection: "row", alignItems: "center" },
  overviewItem: { flex: 1, alignItems: "center" },
  overviewItemLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", marginBottom: 2 },
  overviewItemValue: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  overviewDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.15)" },
  budgetStrip: { marginHorizontal: 16, marginTop: 12, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  budgetSetLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#4A90D9" },
  budgetTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  budgetLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  budgetTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  budgetFraction: { fontSize: 12, fontFamily: "Inter_400Regular" },
  budgetBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  budgetBarFill: { height: "100%", borderRadius: 3 },
  budgetBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  budgetPct: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  budgetRemain: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tabsWrap: { borderBottomWidth: 1, marginTop: 12 },
  tabs: { paddingHorizontal: 16, flexDirection: "row" },
  tabBtn: { paddingVertical: 14, paddingHorizontal: 16, marginRight: 4 },
  tabLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  loadingWrap: { alignItems: "center", paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  section: { margin: 16, marginBottom: 0, borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 2 },
  sectionSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 16 },
  emptyChart: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyAddBtn: { marginTop: 4, backgroundColor: "#4A90D9", borderRadius: 20, paddingVertical: 8, paddingHorizontal: 18 },
  emptyAddBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  donutWrap: { alignItems: "center", gap: 20 },
  donutTotal: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFFFFF", textAlign: "center" },
  donutLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", textAlign: "center" },
  legendWrap: { width: "100%", gap: 10 },
  catLegendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  legendPct: { fontSize: 12, fontFamily: "Inter_400Regular", width: 36, textAlign: "right" },
  legendAmt: { fontSize: 13, fontFamily: "Inter_600SemiBold", width: 64, textAlign: "right" },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  txIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  txSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  txAmt: { fontSize: 15, fontFamily: "Inter_700Bold" },
  editBtn: { padding: 4, marginRight: 2 },
  deleteBtn: { padding: 4 },
  barsRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 6, marginBottom: 20, marginTop: 4 },
  barCol: { flex: 1, alignItems: "center", gap: 6 },
  barTrack: { width: "100%", justifyContent: "flex-end", borderRadius: 6, overflow: "hidden" },
  barFill: { width: "100%", borderRadius: 6 },
  barMonth: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#64748B" },
  monthlyList: { gap: 0 },
  monthlyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  monthlyMonth: { fontSize: 13, fontFamily: "Inter_500Medium", width: 36 },
  monthlyBarWrap: { flex: 1, height: 8, backgroundColor: "#1E3A5F", borderRadius: 4, overflow: "hidden" },
  monthlyBarFill: { height: "100%", borderRadius: 4 },
  monthlyAmt: { fontSize: 13, fontFamily: "Inter_600SemiBold", width: 60, textAlign: "right" },
  heatmapHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  heatmapNav: { flexDirection: "row", alignItems: "center", gap: 8 },
  navBtn: { padding: 4 },
  navMonth: { fontSize: 13, fontFamily: "Inter_600SemiBold", minWidth: 70, textAlign: "center" },
  dayHeaders: { flexDirection: "row", marginBottom: 6 },
  dayHeaderCell: { flex: 1, alignItems: "center" },
  dayHeaderText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  heatmapGrid: { flexDirection: "row", flexWrap: "wrap" },
  heatmapPad: { width: "14.28%", aspectRatio: 1, padding: 2 },
  heatmapCellWrap: { width: "14.28%", aspectRatio: 1, padding: 2 },
  heatmapCell: { flex: 1, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  heatmapDay: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  heatmapAmt: { fontSize: 7, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  heatmapEmpty: { textAlign: "center", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 12 },
  legendRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: "90%" },
  modalHandle: { width: 40, height: 4, backgroundColor: "#334155", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: "Inter_400Regular", marginBottom: 16 },
  catScroll: { marginBottom: 16 },
  catChipRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 },
  catChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#EF4444", marginBottom: 12 },
  clearBudget: { alignItems: "center", paddingVertical: 8, marginBottom: 8 },
  clearBudgetText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#EF4444" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cancelBtn: { borderWidth: 1.5 },
  saveBtn: { backgroundColor: "#4A90D9", shadowColor: "#4A90D9", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  actionBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
});
