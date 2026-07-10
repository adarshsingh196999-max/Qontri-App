import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  disabled?: boolean;
  colors: {
    foreground: string;
    mutedForeground: string;
    background: string;
    border: string;
    card: string;
  };
}

function fmtDisplay(val: string): string {
  if (!val) return "Select date";
  try {
    return new Date(val + "T12:00:00").toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return val; }
}

export function DatePickerField({ value, onChange, label, disabled, colors }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <View style={{ marginBottom: 14 }}>
      {!!label && (
        <Text style={[s.label, { color: colors.mutedForeground }]}>{label}</Text>
      )}
      <Pressable
        style={[s.field, {
          backgroundColor: colors.background,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
        }]}
        onPress={() => { if (!disabled) inputRef.current?.showPicker?.(); }}
        disabled={disabled}
      >
        <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: value ? colors.foreground : colors.mutedForeground }}>
          📅  {fmtDisplay(value)}
        </Text>
        <input
          ref={inputRef as React.Ref<HTMLInputElement>}
          type="date"
          value={value || ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          disabled={disabled}
          style={{
            position: "absolute" as const,
            opacity: 0,
            width: "100%",
            height: "100%",
            top: 0,
            left: 0,
            cursor: "pointer",
            fontSize: 0,
            border: "none",
            background: "transparent",
          }}
        />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  field: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: "center",
    position: "relative",
  },
});
