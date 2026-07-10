import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { CATEGORY_LIST } from "@/components/CategoryBadge";
import { ExpenseSplit, SplitType, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const SPLIT_TYPES: { key: SplitType; label: string; icon: string }[] = [
  { key: "equal", label: "Equal", icon: "divide" },
  { key: "unequal", label: "Custom", icon: "sliders" },
  { key: "percentage", label: "Percent", icon: "percent" },
  { key: "exact", label: "Exact", icon: "hash" },
];

export default function AddExpenseScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId?: string }>();
  const { groups, expenses, addExpense, updateExpense, currentUserId } = useApp();

  const group = groups.find((g) => g.id === groupId);
  const existingExpense = expenseId ? expenses.find(e => e.id === expenseId) : undefined;
  const isEditing = !!existingExpense;

  const [title, setTitle] = useState(existingExpense?.title ?? "");
  const [amount, setAmount] = useState(existingExpense ? String(existingExpense.amount) : "");
  const [paidById, setPaidById] = useState(existingExpense?.paidById ?? currentUserId);
  const [category, setCategory] = useState(existingExpense?.category ?? "Food");
  const [splitType, setSplitType] = useState<SplitType>(existingExpense?.splitType ?? "equal");
  const [notes, setNotes] = useState(existingExpense?.notes ?? "");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(() => {
    if (!existingExpense) return {};
    const m: Record<string, string> = {};
    for (const s of existingExpense.splits) {
      if (existingExpense.splitType === "percentage") {
        m[s.memberId] = String(s.percentage ?? "");
      } else if (existingExpense.splitType !== "equal") {
        m[s.memberId] = String(s.amount);
      }
    }
    return m;
  });
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    existingExpense
      ? new Set(existingExpense.splits.map(s => s.memberId))
      : new Set(group?.members.map((m) => m.id) ?? [])
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  if (!group) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, padding: 20 }}>
          Group not found
        </Text>
      </View>
    );
  }

  const totalAmount = parseFloat(amount) || 0;
  const memberCount = selectedMembers.size;

  const computeSplits = () => {
    const members = group.members.filter((m) => selectedMembers.has(m.id));
    if (splitType === "equal") {
      const share = totalAmount / members.length;
      return members.map((m) => ({ memberId: m.id, amount: share }));
    }
    if (splitType === "unequal") {
      return members.map((m) => ({
        memberId: m.id,
        amount: parseFloat(customAmounts[m.id] ?? "0") || 0,
      }));
    }
    if (splitType === "percentage") {
      return members.map((m) => {
        const pct = parseFloat(customAmounts[m.id] ?? "0") || 0;
        return { memberId: m.id, amount: (pct / 100) * totalAmount, percentage: pct };
      });
    }
    if (splitType === "exact") {
      return members.map((m) => ({
        memberId: m.id,
        amount: parseFloat(customAmounts[m.id] ?? "0") || 0,
      }));
    }
    return [];
  };

  const validateSplits = () => {
    if (splitType === "equal") return true;
    const splits = computeSplits();
    const total = splits.reduce((s, x) => s + x.amount, 0);
    if (splitType === "percentage") return Math.abs(total - 100) < 0.1;
    return Math.abs(total - totalAmount) < 0.5;
  };

  const canSave =
    title.trim().length > 0 &&
    totalAmount > 0 &&
    selectedMembers.size > 0 &&
    validateSplits();

  const handleSave = async () => {
    if (!canSave) return;
    const splits = computeSplits();
    try {
      if (isEditing && existingExpense) {
        await updateExpense(existingExpense.id, {
          title: title.trim(),
          amount: totalAmount,
          paidById,
          splits,
          splitType,
          category,
          notes: notes.trim() || undefined,
        });
      } else {
        await addExpense({
          groupId: group.id,
          title: title.trim(),
          amount: totalAmount,
          paidById,
          splits,
          splitType,
          category,
          date: new Date().toISOString(),
          notes: notes.trim() || undefined,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      // Error handled by context (optimistic revert)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const equalShare =
    selectedMembers.size > 0 ? totalAmount / selectedMembers.size : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.navBar,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>
          {isEditing ? "Edit Expense" : "Add Expense"}
        </Text>
        <Pressable
          style={[
            styles.saveBtn,
            { backgroundColor: canSave ? colors.primary : colors.muted },
          ]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text
            style={[
              styles.saveBtnText,
              {
                color: canSave
                  ? colors.primaryForeground
                  : colors.mutedForeground,
              },
            ]}
          >
            {isEditing ? "Update" : "Save"}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.amountCard,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text style={styles.amountLabel}>Total Amount</Text>
          <View style={styles.amountInputRow}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              autoFocus={!isEditing}
            />
          </View>
          {splitType === "equal" && totalAmount > 0 && memberCount > 1 && (
            <Text style={styles.amountHint}>
              ₹{Math.round(equalShare).toLocaleString("en-IN")} per person
            </Text>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            Description *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            placeholder="What was this expense for?"
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            Paid by
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.memberScroll}
          >
            {group.members.map((m) => (
              <Pressable
                key={m.id}
                style={[
                  styles.payerChip,
                  {
                    backgroundColor:
                      paidById === m.id ? colors.primary : colors.card,
                    borderColor:
                      paidById === m.id ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  setPaidById(m.id);
                  Haptics.selectionAsync();
                }}
              >
                <Avatar
                  name={m.name}
                  color={paidById === m.id ? "#FFFFFF80" : m.color}
                  size={24}
                />
                <Text
                  style={[
                    styles.payerName,
                    {
                      color:
                        paidById === m.id
                          ? colors.primaryForeground
                          : colors.foreground,
                    },
                  ]}
                >
                  {m.id === currentUserId ? "You" : m.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            Category
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.memberScroll}
          >
            {CATEGORY_LIST.map((cat) => (
              <Pressable
                key={cat}
                style={[
                  styles.catChip,
                  {
                    backgroundColor:
                      category === cat ? colors.primary : colors.card,
                    borderColor:
                      category === cat ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  setCategory(cat);
                  Haptics.selectionAsync();
                }}
              >
                <Text
                  style={[
                    styles.catText,
                    {
                      color:
                        category === cat
                          ? colors.primaryForeground
                          : colors.foreground,
                    },
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            Split Type
          </Text>
          <View style={styles.splitTypesRow}>
            {SPLIT_TYPES.map((st) => (
              <Pressable
                key={st.key}
                style={[
                  styles.splitTypeBtn,
                  {
                    backgroundColor:
                      splitType === st.key ? colors.primary : colors.card,
                    borderColor:
                      splitType === st.key ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  setSplitType(st.key);
                  Haptics.selectionAsync();
                }}
              >
                <Feather
                  name={st.icon as any}
                  size={16}
                  color={
                    splitType === st.key
                      ? colors.primaryForeground
                      : colors.mutedForeground
                  }
                />
                <Text
                  style={[
                    styles.splitTypeText,
                    {
                      color:
                        splitType === st.key
                          ? colors.primaryForeground
                          : colors.foreground,
                    },
                  ]}
                >
                  {st.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            Split between
          </Text>
          <View style={styles.membersGrid}>
            {group.members.map((m) => {
              const isSelected = selectedMembers.has(m.id);
              return (
                <View key={m.id} style={styles.memberSplitRow}>
                  <Pressable
                    style={[
                      styles.memberSplitChip,
                      {
                        backgroundColor: isSelected
                          ? colors.secondary
                          : colors.muted,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      toggleMember(m.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Avatar name={m.name} color={m.color} size={28} />
                    <Text
                      style={[
                        styles.memberSplitName,
                        {
                          color: isSelected
                            ? colors.primary
                            : colors.mutedForeground,
                        },
                      ]}
                    >
                      {m.id === currentUserId ? "You" : m.name}
                    </Text>
                    {isSelected && splitType === "equal" && totalAmount > 0 && (
                      <Text
                        style={[
                          styles.memberSplitAmt,
                          { color: colors.primary },
                        ]}
                      >
                        ₹{Math.round(equalShare)}
                      </Text>
                    )}
                    {!isSelected && (
                      <Feather name="minus-circle" size={14} color={colors.mutedForeground} />
                    )}
                    {isSelected && splitType === "equal" && (
                      <Feather name="check-circle" size={14} color={colors.primary} />
                    )}
                  </Pressable>
                  {isSelected && splitType !== "equal" && (
                    <TextInput
                      style={[
                        styles.customAmtInput,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          color: colors.foreground,
                        },
                      ]}
                      placeholder={splitType === "percentage" ? "%" : "₹"}
                      placeholderTextColor={colors.mutedForeground}
                      value={customAmounts[m.id] ?? ""}
                      onChangeText={(v) =>
                        setCustomAmounts((prev) => ({ ...prev, [m.id]: v }))
                      }
                      keyboardType="numeric"
                    />
                  )}
                </View>
              );
            })}
          </View>
          {splitType !== "equal" && totalAmount > 0 && (
            <View
              style={[
                styles.splitSummary,
                {
                  backgroundColor: validateSplits()
                    ? colors.secondary
                    : "#FEF2F2",
                  borderColor: validateSplits() ? colors.accent : "#FECACA",
                },
              ]}
            >
              <Text
                style={[
                  styles.splitSummaryText,
                  { color: validateSplits() ? colors.primary : colors.negative },
                ]}
              >
                {splitType === "percentage"
                  ? `Total: ${computeSplits()
                      .reduce((s, x) => s + ((x as ExpenseSplit).percentage ?? 0), 0)
                      .toFixed(0)}% / 100%`
                  : `Total: ₹${computeSplits()
                      .reduce((s, x) => s + x.amount, 0)
                      .toFixed(0)} / ₹${totalAmount.toFixed(0)}`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            Notes (optional)
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.notesInput,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            placeholder="Any extra details..."
            placeholderTextColor={colors.mutedForeground}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  navTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  content: { padding: 16, gap: 20 },
  amountCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 4,
  },
  amountLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  currencySymbol: {
    color: "#FFFFFF",
    fontSize: 28,
    fontFamily: "Inter_600SemiBold",
  },
  amountInput: {
    color: "#FFFFFF",
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    minWidth: 80,
    textAlign: "center",
  },
  amountHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  fieldGroup: { gap: 8 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  notesInput: {
    height: 80,
    textAlignVertical: "top",
  },
  memberScroll: { gap: 8, paddingRight: 8 },
  payerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  payerName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  catText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  splitTypesRow: {
    flexDirection: "row",
    gap: 8,
  },
  splitTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  splitTypeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  membersGrid: { gap: 8 },
  memberSplitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberSplitChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  memberSplitName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  memberSplitAmt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  customAmtInput: {
    width: 80,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  splitSummary: {
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  splitSummaryText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
