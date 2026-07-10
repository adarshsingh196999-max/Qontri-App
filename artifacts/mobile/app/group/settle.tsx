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
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function SettleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { groupId, fromId, toId, amount: amountParam } =
    useLocalSearchParams<{
      groupId: string;
      fromId: string;
      toId: string;
      amount: string;
    }>();
  const { groups, addSettlement, currentUserId } = useApp();

  const group = groups.find((g) => g.id === groupId);
  const fromMember = group?.members.find((m) => m.id === fromId);
  const toMember = group?.members.find((m) => m.id === toId);

  const [amount, setAmount] = useState(
    amountParam ? String(Math.round(parseFloat(amountParam))) : ""
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const canSettle = parseFloat(amount) > 0 && !!fromMember && !!toMember;

  const handleSettle = async () => {
    if (!canSettle || !group) return;
    try {
      await addSettlement({
        groupId: group.id,
        fromId: fromId!,
        toId: toId!,
        amount: parseFloat(amount),
        date: new Date().toISOString(),
        mode: "cash",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  if (!group || !fromMember || !toMember) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, padding: 20 }}>Not found</Text>
      </View>
    );
  }

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
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>
          Record Payment
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Transfer card */}
        <View style={[styles.transferCard, { backgroundColor: colors.primary }]}>
          <View style={styles.transferRow}>
            <View style={styles.transferPerson}>
              <Avatar
                name={fromMember.name}
                color="rgba(255,255,255,0.3)"
                size={52}
                avatar={fromMember.avatar}
              />
              <Text style={styles.transferName}>
                {fromMember.id === currentUserId ? "You" : fromMember.name}
              </Text>
              <Text style={styles.transferRole}>paying</Text>
            </View>
            <View style={styles.transferArrow}>
              <Feather name="arrow-right" size={28} color="rgba(255,255,255,0.8)" />
            </View>
            <View style={styles.transferPerson}>
              <Avatar
                name={toMember.name}
                color="rgba(255,255,255,0.3)"
                size={52}
                avatar={toMember.avatar}
              />
              <Text style={styles.transferName}>
                {toMember.id === currentUserId ? "You" : toMember.name}
              </Text>
              <Text style={styles.transferRole}>receiving</Text>
            </View>
          </View>
        </View>

        {/* Amount input */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Amount</Text>
          <View
            style={[
              styles.amountInputWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.currencyLabel, { color: colors.mutedForeground }]}>₹</Text>
            <TextInput
              style={[styles.amountInput, { color: colors.foreground }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
          </View>
        </View>

        {/* Record Payment button */}
        <Pressable
          style={({ pressed }) => [
            styles.settleBtn,
            {
              backgroundColor: canSettle ? colors.primary : colors.muted,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          onPress={handleSettle}
          disabled={!canSettle}
        >
          <Feather
            name="check-circle"
            size={20}
            color={canSettle ? "#fff" : colors.mutedForeground}
          />
          <Text
            style={[
              styles.settleBtnText,
              { color: canSettle ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            Record Payment
          </Text>
        </Pressable>
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
  content: { padding: 20, gap: 24 },
  transferCard: { borderRadius: 20, padding: 24 },
  transferRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  transferPerson: { alignItems: "center", gap: 6 },
  transferName: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  transferRole: { color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: "Inter_400Regular" },
  transferArrow: { flex: 1, alignItems: "center" },
  fieldGroup: { gap: 8 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  currencyLabel: { fontSize: 24, fontFamily: "Inter_600SemiBold" },
  amountInput: { flex: 1, fontSize: 24, fontFamily: "Inter_600SemiBold" },
  settleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  settleBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
