import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type FilterTab = "all" | "you_owe" | "owed_to_you";

interface GroupChip {
  groupId: string;
  groupName: string;
  emoji: string;
  amount: number;
}

interface PersonBalance {
  name: string;
  color: string;
  netAmount: number; // positive = they owe me, negative = I owe them
  chips: GroupChip[];
}

export default function SettleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { groups, getGroupBalances, currentUserId } = useApp();
  const [filter, setFilter] = useState<FilterTab>("all");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Aggregate cross-group balances per person (matched by name)
  const personMap = useMemo(() => {
    const map = new Map<string, PersonBalance>();
    for (const group of groups) {
      if (!group.members.find((m) => m.id === currentUserId)) continue;
      const balances = getGroupBalances(group.id);
      for (const b of balances) {
        if (b.amount <= 0) continue;
        const isIOwe = b.fromId === currentUserId;
        const otherId = isIOwe ? b.toId : b.fromId;
        const otherMember = group.members.find((m) => m.id === otherId);
        if (!otherMember) continue;
        const key = otherMember.name.toLowerCase();
        const existing = map.get(key) ?? {
          name: otherMember.name,
          color: otherMember.color,
          netAmount: 0,
          chips: [],
        };
        const delta = isIOwe ? -b.amount : b.amount;
        existing.netAmount += delta;
        existing.chips.push({
          groupId: group.id,
          groupName: group.name,
          emoji: group.emoji,
          amount: delta,
        });
        map.set(key, existing);
      }
    }
    return map;
  }, [groups, getGroupBalances, currentUserId]);

  const persons = useMemo(
    () =>
      Array.from(personMap.values()).filter((p) => Math.abs(p.netAmount) > 0.5),
    [personMap]
  );

  const youOweTotal = useMemo(
    () => persons.filter((p) => p.netAmount < 0).reduce((s, p) => s + Math.abs(p.netAmount), 0),
    [persons]
  );
  const owedToYouTotal = useMemo(
    () => persons.filter((p) => p.netAmount > 0).reduce((s, p) => s + p.netAmount, 0),
    [persons]
  );
  const net = owedToYouTotal - youOweTotal;

  const filtered = useMemo(() => {
    if (filter === "you_owe") return persons.filter((p) => p.netAmount < 0);
    if (filter === "owed_to_you") return persons.filter((p) => p.netAmount > 0);
    return persons;
  }, [persons, filter]);

  const youOweList = filtered.filter((p) => p.netAmount < 0);
  const owedList = filtered.filter((p) => p.netAmount > 0);

  const handleRemind = async (person: PersonBalance) => {
    const absAmt = Math.abs(person.netAmount);
    const groupNames = person.chips.map((c) => `${c.emoji} ${c.groupName}`).join(", ");
    const msg = `Hey ${person.name}! Just a friendly reminder — you owe me ₹${Math.round(absAmt).toLocaleString("en-IN")} (${groupNames}). Send it whenever you get a chance! 🙏`;
    try {
      await Share.share({ message: msg });
    } catch {}
  };

  const handlePay = (person: PersonBalance) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/settle/pay",
      params: {
        name: person.name,
        color: person.color,
        amount: String(Math.round(Math.abs(person.netAmount))),
        chips: JSON.stringify(person.chips),
      },
    });
  };

  const handleRequest = async (person: PersonBalance) => {
    const absAmt = Math.abs(person.netAmount);
    const groupNames = person.chips.map((c) => `${c.emoji} ${c.groupName}`).join(", ");
    const msg = `Hey ${person.name}! You owe me ₹${Math.round(absAmt).toLocaleString("en-IN")} from ${groupNames}. Please send it when you can! Thanks 🙏`;
    try {
      await Share.share({ message: msg });
    } catch {}
  };

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  const renderSection = (label: string, list: PersonBalance[]) => {
    if (list.length === 0) return null;
    const isOwing = list[0].netAmount < 0;
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        {list.map((person) => {
          const absAmt = Math.abs(person.netAmount);
          return (
            <View
              key={person.name}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.cardTop}>
                <Avatar name={person.name} color={person.color} size={44} />
                <View style={styles.cardInfo}>
                  <Text style={[styles.personName, { color: colors.foreground }]}>
                    {person.name}
                  </Text>
                </View>
                <View style={styles.cardAmount}>
                  <Text
                    style={[
                      styles.amountText,
                      { color: isOwing ? "#EF4444" : "#16a34a" },
                    ]}
                  >
                    {fmt(absAmt)}
                  </Text>
                  <Text style={[styles.amountSub, { color: colors.mutedForeground }]}>
                    {isOwing ? "you owe" : "owes you"}
                  </Text>
                </View>
              </View>

              {/* Group chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {person.chips.map((chip) => (
                  <Pressable
                    key={chip.groupId}
                    style={[styles.chip, { backgroundColor: colors.muted, borderColor: colors.border }]}
                    onPress={() => router.push({ pathname: "/group/[id]", params: { id: chip.groupId } })}
                  >
                    <Text style={[styles.chipText, { color: colors.foreground }]}>
                      {chip.emoji} {chip.groupName}{" "}
                      <Text style={{ color: isOwing ? "#EF4444" : "#16a34a", fontFamily: "Inter_600SemiBold" }}>
                        {fmt(Math.abs(chip.amount))}
                      </Text>
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Action buttons */}
              <View style={styles.actions}>
                {isOwing ? (
                  <>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionBtn,
                        { backgroundColor: colors.muted, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        handleRemind(person);
                      }}
                    >
                      <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
                        🔔 Remind
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionBtn,
                        { backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                      ]}
                      onPress={() => handlePay(person)}
                    >
                      <Text style={[styles.actionBtnText, { color: "#fff" }]}>
                        🤝 Pay now
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionBtn,
                        { backgroundColor: colors.muted, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        handleRemind(person);
                      }}
                    >
                      <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
                        🔔 Remind {person.name}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionBtn,
                        { backgroundColor: colors.muted, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        handleRequest(person);
                      }}
                    >
                      <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
                        ✉️ Request
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settle Up</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          All balances across your groups
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 100 }]}
      >
        {/* Hero stats */}
        <View style={styles.heroRow}>
          <View style={[styles.heroCard, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <Text style={[styles.heroAmount, { color: "#EF4444" }]}>{fmt(youOweTotal)}</Text>
            <Text style={[styles.heroLabel, { color: "#EF4444" }]}>YOU OWE</Text>
          </View>
          <View style={[styles.heroCard, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
            <Text style={[styles.heroAmount, { color: "#16a34a" }]}>{fmt(owedToYouTotal)}</Text>
            <Text style={[styles.heroLabel, { color: "#16a34a" }]}>OWED TO{"\n"}YOU</Text>
          </View>
          <View style={[styles.heroCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
            <Text style={[styles.heroAmount, { color: net >= 0 ? "#2563EB" : "#EF4444" }]}>
              {net < 0 ? "-" : ""}{fmt(Math.abs(net))}
            </Text>
            <Text style={[styles.heroLabel, { color: "#2563EB" }]}>NET</Text>
          </View>
        </View>

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          {([
            { key: "all", label: "All" },
            { key: "you_owe", label: "You owe" },
            { key: "owed_to_you", label: "Owed to you" },
          ] as { key: FilterTab; label: string }[]).map(({ key, label }) => (
            <Pressable
              key={key}
              style={[
                styles.filterBtn,
                {
                  backgroundColor: filter === key ? colors.primary : colors.muted,
                  borderColor: filter === key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => {
                setFilter(key);
                Haptics.selectionAsync();
              }}
            >
              <Text style={[styles.filterBtnText, { color: filter === key ? "#fff" : colors.mutedForeground }]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {persons.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>🎉</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All settled up!</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              No outstanding balances across your groups
            </Text>
          </View>
        ) : (
          <>
            {renderSection("YOU OWE", youOweList)}
            {renderSection("OWED TO YOU", owedList)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  scroll: {
    padding: 20,
    gap: 16,
  },
  heroRow: {
    flexDirection: "row",
    gap: 10,
  },
  heroCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  heroAmount: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  heroLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
  },
  filterBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  cardAmount: {
    alignItems: "flex-end",
  },
  amountText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  amountSub: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  chipsRow: {
    flexDirection: "row",
    gap: 6,
    paddingRight: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  emptySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
