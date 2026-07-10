import React from "react";
import { StyleSheet, Text, TextStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface AmountTextProps {
  amount: number;
  positive?: boolean;
  negative?: boolean;
  neutral?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  style?: TextStyle;
  prefix?: string;
}

export function AmountText({
  amount,
  positive,
  negative,
  neutral,
  size = "md",
  style,
  prefix = "₹",
}: AmountTextProps) {
  const colors = useColors();

  const color = positive
    ? colors.positive
    : negative
    ? colors.negative
    : neutral
    ? colors.mutedForeground
    : colors.foreground;

  const fontSize = size === "sm" ? 13 : size === "md" ? 16 : size === "lg" ? 20 : 28;

  return (
    <Text style={[styles.text, { color, fontSize }, style]}>
      {prefix}
      {Math.abs(amount).toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: "Inter_600SemiBold",
  },
});
