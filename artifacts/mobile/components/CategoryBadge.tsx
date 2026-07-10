import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const CATEGORIES: Record<string, { icon: string; color: string }> = {
  Food: { icon: "🍽️", color: "#F59E0B" },
  Transport: { icon: "🚗", color: "#3B82F6" },
  Accommodation: { icon: "🏨", color: "#2563EB" },
  Activities: { icon: "🎯", color: "#EC4899" },
  Utilities: { icon: "⚡", color: "#06B6D4" },
  Groceries: { icon: "🛒", color: "#84CC16" },
  Entertainment: { icon: "🎬", color: "#F97316" },
  Shopping: { icon: "🛍️", color: "#60A5FA" },
  Healthcare: { icon: "💊", color: "#EF4444" },
  Other: { icon: "💰", color: "#6B7280" },
};

export const CATEGORY_LIST = Object.keys(CATEGORIES);

interface CategoryBadgeProps {
  category: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function CategoryBadge({ category, showLabel = false, size = "md" }: CategoryBadgeProps) {
  const colors = useColors();
  const meta = CATEGORIES[category] ?? CATEGORIES["Other"];
  const iconSize = size === "sm" ? 14 : 18;
  const padding = size === "sm" ? { paddingHorizontal: 8, paddingVertical: 4 } : { paddingHorizontal: 10, paddingVertical: 6 };

  return (
    <View
      style={[
        styles.badge,
        padding,
        { backgroundColor: meta.color + "20" },
      ]}
    >
      <Text style={{ fontSize: iconSize }}>{meta.icon}</Text>
      {showLabel && (
        <Text
          style={[
            styles.label,
            { color: meta.color, fontSize: size === "sm" ? 11 : 12 },
          ]}
        >
          {category}
        </Text>
      )}
    </View>
  );
}

export function getCategoryIcon(category: string): string {
  return (CATEGORIES[category] ?? CATEGORIES["Other"]).icon;
}

export function getCategoryColor(category: string): string {
  return (CATEGORIES[category] ?? CATEGORIES["Other"]).color;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
  },
  label: {
    fontFamily: "Inter_500Medium",
  },
});
