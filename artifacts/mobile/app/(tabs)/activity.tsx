import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AmountText } from "@/components/AmountText";
import { getCategoryIcon } from "@/components/CategoryBadge";
import { ActivityEntry, Expense, Settlement, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const ACTIVITY_ICONS: Record<string, string> = {
  expense_edited: "edit-2",
  expense_deleted: "trash-2",
  group_edited: "settings",
  group_joined: "user-plus",
};

const ACTIVITY_COLORS: Record<string, string> = {
  expense_edited: "#F59E0B",
  expense_deleted: "#EF4444",
  group_edited: "#8B5CF6",
  group_joined: "#10B981",
};

export default function ActivityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getRecentActivity } = useApp();

  const activity = getRecentActivity();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          Activity
        </Text>
      </View>

      <FlatList
        data={activity}
        keyExtractor={(item) => {
          if (item.type === "activity_log") return "act_" + (item.item as ActivityEntry).id;
          return item.type + "_" + (item.item as Expense | Settlement).id;
        }}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad + 100 },
        ]}
        scrollEnabled={!!activity.length}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="activity" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No activity yet
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: colors.mutedForeground },
              ]}
            >
              Add expenses to see them here
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const { type, group } = item;

          if (type === "activity_log") {
            const entry = item.item as ActivityEntry;
            const iconName = ACTIVITY_ICONS[entry.type] ?? "info";
            const iconColor = ACTIVITY_COLORS[entry.type] ?? colors.primary;
            const bgColor = iconColor + "20";
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.activityItem,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => router.push(`/group/${group.id}`)}
              >
                <View style={[styles.iconWrap, { backgroundColor: bgColor }]}>
                  <Feather name={iconName as any} size={20} color={iconColor} />
                </View>
                <View style={styles.activityInfo}>
                  <Text
                    style={[styles.activityTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {entry.label}
                  </Text>
                  <Text
                    style={[styles.activityMeta, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {entry.meta} · {group.emoji} {group.name}
                  </Text>
                  <Text style={[styles.activityDate, { color: colors.mutedForeground }]}>
                    {formatDate(entry.date)}
                  </Text>
                </View>
              </Pressable>
            );
          }

          if (type === "expense") {
            const expense = item.item as Expense;
            const payer = group.members.find(
              (m) => m.id === expense.paidById
            );
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.activityItem,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => router.push(`/group/${group.id}`)}
              >
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Text style={{ fontSize: 22 }}>
                    {getCategoryIcon(expense.category)}
                  </Text>
                </View>
                <View style={styles.activityInfo}>
                  <Text
                    style={[styles.activityTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {expense.title}
                  </Text>
                  <Text
                    style={[
                      styles.activityMeta,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {payer?.name ?? "Someone"} paid · {group.emoji} {group.name}
                  </Text>
                  <Text
                    style={[
                      styles.activityDate,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {formatDate(expense.date)}
                  </Text>
                </View>
                <AmountText
                  amount={expense.amount}
                  size="md"
                  style={{ color: colors.foreground }}
                />
              </Pressable>
            );
          }

          const settlement = item.item as Settlement;
          const payer = group.members.find((m) => m.id === settlement.fromId);
          const receiver = group.members.find((m) => m.id === settlement.toId);

          return (
            <Pressable
              style={({ pressed }) => [
                styles.activityItem,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() => router.push(`/group/${group.id}`)}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: "#DBEAFE" },
                ]}
              >
                <Feather name="check-circle" size={22} color="#1E3A5F" />
              </View>
              <View style={styles.activityInfo}>
                <Text
                  style={[styles.activityTitle, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  Payment recorded
                </Text>
                <Text
                  style={[
                    styles.activityMeta,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {payer?.name ?? "?"} paid {receiver?.name ?? "?"} · {group.emoji}{" "}
                  {group.name}
                </Text>
                <Text
                  style={[
                    styles.activityDate,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {formatDate(settlement.date)}
                </Text>
              </View>
              <AmountText amount={settlement.amount} positive size="md" />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  list: { padding: 16, gap: 10 },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  activityInfo: { flex: 1, gap: 2 },
  activityTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  activityMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  activityDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
