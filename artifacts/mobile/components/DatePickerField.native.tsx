import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

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

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const [show, setShow] = useState(false);
  const [iosTempDate, setIosTempDate] = useState<Date | null>(null);
  const parsed = value ? new Date(value + "T12:00:00") : new Date();

  const handleChange = (_: unknown, selected?: Date) => {
    if (Platform.OS === "android") {
      setShow(false);
      if (selected) onChange(toDateStr(selected));
    } else {
      if (selected) setIosTempDate(selected);
    }
  };

  const handleIosDone = () => {
    if (iosTempDate) onChange(toDateStr(iosTempDate));
    setIosTempDate(null);
    setShow(false);
  };

  const handleIosCancel = () => {
    setIosTempDate(null);
    setShow(false);
  };

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
        onPress={() => !disabled && setShow(true)}
        disabled={disabled}
      >
        <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: value ? colors.foreground : colors.mutedForeground }}>
          📅  {fmtDisplay(value)}
        </Text>
      </Pressable>

      {show && Platform.OS === "android" && (
        <DateTimePicker
          value={parsed}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      )}

      {Platform.OS === "ios" && (
        <Modal visible={show} transparent animationType="slide" statusBarTranslucent>
          <Pressable style={s.backdrop} onPress={handleIosCancel} />
          <View style={[s.pickerCard, { backgroundColor: colors.card }]}>
            <View style={s.toolbar}>
              <Pressable onPress={handleIosCancel}>
                <Text style={s.toolbarCancel}>Cancel</Text>
              </Pressable>
              <Text style={[s.toolbarTitle, { color: colors.foreground }]}>Select Date</Text>
              <Pressable onPress={handleIosDone}>
                <Text style={s.toolbarDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={iosTempDate ?? parsed}
              mode="date"
              display="spinner"
              textColor={colors.foreground}
              onChange={handleChange}
              style={{ width: "100%" }}
            />
          </View>
        </Modal>
      )}
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
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  pickerCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    overflow: "hidden",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  toolbarCancel: { fontSize: 15, color: "#94A3B8", fontFamily: "Inter_400Regular" },
  toolbarTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  toolbarDone: { fontSize: 15, color: "#4A90D9", fontFamily: "Inter_600SemiBold" },
});
