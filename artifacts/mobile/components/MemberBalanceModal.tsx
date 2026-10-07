import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  groupId: string;
  memberId: string | null;
  onClose: () => void;
}

export default function MemberBalanceModal({
  visible,
  groupId,
  memberId,
  onClose,
}: Props) {
  const colors = useColors();
  const { groups, expenses, settlements, currentUserId } = useApp();

  const group = groups.find((g) => g.id === groupId);
  const member = group?.members.find((m) => m.id === memberId);
  const isMe = member?.id === currentUserId;
  const displayName = isMe ? "your" : member?.name ?? "—";

  if (!group || !member) {
    return null;
  }

  // Expenses in this group
  const groupExpenses = expenses.filter((e) => e.groupId === groupId);
  const groupSettlements = settlements.filter((s) => s.groupId === groupId);

  // What this member paid (full amount on any expense they were the payer of)
  const paidExpenses = groupExpenses.filter((e) => e.paidById === member.id);
  const totalPaid = paidExpenses.reduce((s, e) => s + e.amount, 0);

  // This member's share of every expense
  const shareLines = groupExpenses
    .map((e) => {
      const split = e.splits.find((sp) => sp.memberId === member.id);
      return split ? { title: e.title, amount: split.amount } : null;
    })
    .filter((x): x is { title: string; amount: number } => x !== null);
  const totalShare = shareLines.reduce((s, x) => s + x.amount, 0);

  // Net from expenses only (before settlements)
  const netFromExpenses = totalPaid - totalShare;

  // Settlements this member was involved in
  const settlementsSent = groupSettlements.filter((s) => s.fromId === member.id);
  const settlementsReceived = groupSettlements.filter((s) => s.toId === member.id);
  const totalSent = settlementsSent.reduce((s, x) => s + x.amount, 0);
  const totalReceived = settlementsReceived.reduce((s, x) => s + x.amount, 0);

  // Final net = netFromExpenses + sent − received ... wait
  //
  // Actually: when a member SENDS a settlement, they reduce their debt.
  //   If they owed −₹974 and send ₹974, they're now at ₹0.
  //   In "getNetBalances" the formula is: net(from) += amount
  //   So sent adds to the net (paying back increases their balance toward 0)
  // And RECEIVING a settlement reduces the receiver's credit:
  //   net(to) -= amount
  //
  // net_final = netFromExpenses + totalSent − totalReceived
  const netFinal = netFromExpenses + totalSent - totalReceived;

  const [showAllPaid, setShowAllPaid] = React.useState(false);
  const [showAllShare, setShowAllShare] = React.useState(false);
  const [showAllSettlements, setShowAllSettlements] = React.useState(false);

  const PREVIEW_COUNT = 4;

  const paidToShow = showAllPaid
    ? paidExpenses
    : paidExpenses.slice(0, PREVIEW_COUNT);
  const paidHidden = paidExpenses.length - paidToShow.length;

  const shareToShow = showAllShare
    ? shareLines
    : shareLines.slice(0, PREVIEW_COUNT);
  const shareHidden = shareLines.length - shareToShow.length;

  const sentToShow = showAllSettlements
    ? settlementsSent
    : settlementsSent.slice(0, PREVIEW_COUNT);
  const receivedToShow = showAllSettlements
    ? settlementsReceived
    : settlementsReceived.slice(0, PREVIEW_COUNT);
  const settlementsHidden =
    settlementsSent.length +
    settlementsReceived.length -
    (sentToShow.length + receivedToShow.length);

  const fmt = (n: number): string => {
    const rounded = Math.round(n);
    return `₹${Math.abs(rounded).toLocaleString("en-IN")}`;
  };

  const fmtSigned = (n: number): string => {
    const rounded = Math.round(n);
    if (Math.abs(n) < 1) return "₹0";
    const sign = rounded > 0 ? "+" : "−";
    return `${sign}₹${Math.abs(rounded).toLocaleString("en-IN")}`;
  };

  const isSettled = Math.abs(netFinal) < 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              How {displayName} total is calculated
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Formula strip */}
            <View style={[styles.formulaStrip, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.formulaText, { color: colors.primary }]}>
                What {isMe ? "you" : member.name} paid − {isMe ? "your" : "their"} share of all expenses
              </Text>
            </View>

            {/* Paid section */}
            <View style={[styles.section, { backgroundColor: colors.background }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  {isMe ? "You" : member.name} paid
                </Text>
                <Text style={[styles.sectionAmount, { color: colors.foreground }]}>
                  {fmt(totalPaid)}
                </Text>
              </View>
              {paidExpenses.length === 0 ? (
                <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
                  {isMe ? "You" : member.name} did not pay for any expense.
                </Text>
              ) : (
                <>
                  {paidToShow.map((e) => (
                    <View key={e.id} style={styles.lineRow}>
                      <Text
                        style={[styles.lineLabel, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {e.title}
                      </Text>
                      <Text style={[styles.lineAmount, { color: colors.mutedForeground }]}>
                        {fmt(e.amount)}
                      </Text>
                    </View>
                  ))}
                  {paidHidden > 0 || showAllPaid ? (
                    <Pressable
                      onPress={() => setShowAllPaid(!showAllPaid)}
                      style={styles.showMoreBtn}
                    >
                      <Text style={[styles.showMoreText, { color: colors.primary }]}>
                        {showAllPaid
                          ? "Show fewer"
                          : `Show ${paidHidden} more`}
                      </Text>
                      <Feather
                        name={showAllPaid ? "chevron-up" : "chevron-down"}
                        size={14}
                        color={colors.primary}
                      />
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>

            {/* Share section */}
            <View style={[styles.section, { backgroundColor: colors.background }]}>
              <View style={styles.sectionHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    {isMe ? "Your" : `${member.name}'s`} share of all {groupExpenses.length}{" "}
                    expense{groupExpenses.length === 1 ? "" : "s"}
                  </Text>
                  <Text style={[styles.sectionSubHint, { color: colors.mutedForeground }]}>
                    Split equally · {group.members.length} people
                  </Text>
                </View>
                <Text style={[styles.sectionAmount, { color: colors.foreground }]}>
                  {fmt(totalShare)}
                </Text>
              </View>
              {shareToShow.map((s, i) => (
                <View key={i} style={styles.lineRow}>
                  <Text
                    style={[styles.lineLabel, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {s.title}
                  </Text>
                  <Text style={[styles.lineAmount, { color: colors.mutedForeground }]}>
                    {fmt(s.amount)}
                  </Text>
                </View>
              ))}
              {shareHidden > 0 || showAllShare ? (
                <Pressable
                  onPress={() => setShowAllShare(!showAllShare)}
                  style={styles.showMoreBtn}
                >
                  <Text style={[styles.showMoreText, { color: colors.primary }]}>
                    {showAllShare
                      ? "Show fewer"
                      : `Show ${shareHidden} more`}
                  </Text>
                  <Feather
                    name={showAllShare ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={colors.primary}
                  />
                </Pressable>
              ) : null}
            </View>

            {/* Subtraction bar */}
            <View
              style={[
                styles.resultBar,
                {
                  backgroundColor: isSettled
                    ? "rgba(22,163,74,0.10)"
                    : "rgba(239,68,68,0.08)",
                },
              ]}
            >
              <Text
                style={[
                  styles.resultFormula,
                  { color: isSettled ? "#166534" : "#991B1B" },
                ]}
              >
                {fmt(totalPaid)} − {fmt(totalShare)} =
              </Text>
              <Text
                style={[
                  styles.resultValue,
                  { color: isSettled ? "#166534" : "#991B1B" },
                ]}
              >
                {fmtSigned(netFromExpenses)}
              </Text>
            </View>

            {/* Settlements section — only if any */}
            {(totalSent > 0 || totalReceived > 0) && (
              <View style={[styles.section, { backgroundColor: colors.background }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Settlements
                </Text>
                {sentToShow.map((s) => {
                  const toMember = group.members.find((m) => m.id === s.toId);
                  return (
                    <View key={s.id} style={styles.lineRow}>
                      <Text style={[styles.lineLabel, { color: colors.mutedForeground }]}>
                        {isMe ? "You" : member.name} paid {toMember?.name ?? "?"}
                      </Text>
                      <Text style={[styles.lineAmount, { color: "#16a34a" }]}>
                        −{fmt(s.amount)}
                      </Text>
                    </View>
                  );
                })}
                {receivedToShow.map((s) => {
                  const fromMember = group.members.find((m) => m.id === s.fromId);
                  return (
                    <View key={s.id} style={styles.lineRow}>
                      <Text style={[styles.lineLabel, { color: colors.mutedForeground }]}>
                        {isMe ? "You" : member.name} got paid by {fromMember?.name ?? "?"}
                      </Text>
                      <Text style={[styles.lineAmount, { color: "#EF4444" }]}>
                        +{fmt(s.amount)}
                      </Text>
                    </View>
                  );
                })}
                {settlementsHidden > 0 || showAllSettlements ? (
                  <Pressable
                    onPress={() => setShowAllSettlements(!showAllSettlements)}
                    style={styles.showMoreBtn}
                  >
                    <Text style={[styles.showMoreText, { color: colors.primary }]}>
                      {showAllSettlements
                        ? "Show fewer"
                        : `Show ${settlementsHidden} more`}
                    </Text>
                    <Feather
                      name={showAllSettlements ? "chevron-up" : "chevron-down"}
                      size={14}
                      color={colors.primary}
                    />
                  </Pressable>
                ) : null}
              </View>
            )}

            {/* Final balance bar — only if there were settlements */}
            {(totalSent > 0 || totalReceived > 0) && (
              <View
                style={[
                  styles.resultBar,
                  { backgroundColor: isSettled ? "rgba(22,163,74,0.10)" : "rgba(30,58,95,0.06)" },
                ]}
              >
                <Text
                  style={[
                    styles.resultFormula,
                    { color: isSettled ? "#166534" : colors.foreground },
                  ]}
                >
                  Final balance
                </Text>
                <Text
                  style={[
                    styles.resultValue,
                    { color: isSettled ? "#166534" : colors.foreground },
                  ]}
                >
                  {fmtSigned(netFinal)}
                </Text>
              </View>
            )}

            {/* Trust line */}
            <Text style={[styles.trustLine, { color: colors.mutedForeground }]}>
              Same math for everyone. All totals add up to ₹0.
            </Text>
          </ScrollView>

          {/* Got it button */}
          <Pressable
            style={[styles.gotItBtn, { backgroundColor: colors.primary }]}
            onPress={onClose}
          >
            <Text style={styles.gotItText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  formulaStrip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  formulaText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  section: {
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  sectionSubHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  sectionAmount: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  sectionHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  lineLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  lineAmount: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
    showMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    marginTop: 4,
  },
  showMoreText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  resultBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  resultFormula: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  resultValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  trustLine: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
  },
  gotItBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  gotItText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});