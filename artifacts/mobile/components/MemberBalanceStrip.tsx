import React from "react";
import {
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
  groupId: string;
  onPressMember?: (memberId: string) => void;
}

export default function MemberBalanceStrip({ groupId, onPressMember }: Props) {
  const colors = useColors();
  const { groups, getNetBalances, currentUserId } = useApp();

  const group = groups.find((g) => g.id === groupId);
  if (!group) return null;

  const nets = getNetBalances(groupId);

  // Show the current user first, then others in order
  const orderedMembers = [
    ...group.members.filter((m) => m.id === currentUserId),
    ...group.members.filter((m) => m.id !== currentUserId),
  ];

  const fmtBalance = (n: number): string => {
    const rounded = Math.round(n);
    if (Math.abs(n) < 1) return "₹0";
    const sign = rounded > 0 ? "+" : "−";
    return `${sign}₹${Math.abs(rounded).toLocaleString("en-IN")}`;
  };

  const balanceColor = (n: number): string => {
    if (Math.abs(n) < 1) return colors.mutedForeground;
    if (n > 0) return "#16a34a";
    return "#EF4444";
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        EVERYONE'S TOTAL · TAP TO KNOW HOW
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {orderedMembers.map((member) => {
          const net = nets[member.id] ?? 0;
          const isMe = member.id === currentUserId;
          const rounded = Math.round(net);
          return (
            <Pressable
              key={member.id}
              onPress={() => onPressMember?.(member.id)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: colors.card,
                  borderColor: isMe ? colors.primary : colors.border,
                  borderWidth: isMe ? 2 : 1,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Avatar name={member.name} color={member.color} size={40} avatar={member.avatar} />
              <Text
                style={[styles.name, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {isMe ? "You" : member.name}
              </Text>
              <Text style={[styles.amount, { color: balanceColor(net) }]}>
                {fmtBalance(net)}
              </Text>
              {Math.abs(net) < 1 ? (
                <Text style={[styles.settledHint, { color: colors.mutedForeground }]}>
                  settled
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingBottom: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  chip: {
    width: 96,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
  },
  name: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    maxWidth: 84,
    textAlign: "center",
  },
  amount: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  settledHint: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
});