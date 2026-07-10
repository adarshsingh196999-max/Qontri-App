import React from "react";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { useColors } from "@/hooks/useColors";

interface BrandedQRCodeProps {
  upiId: string;
  userName?: string;
  size?: number;
}

export function BrandedQRCode({ upiId, userName = "", size = 160 }: BrandedQRCodeProps) {
  const colors = useColors();
  const upiValue = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(userName)}&cu=INR`;

  return (
    <View style={[styles.wrapper, { borderColor: colors.border }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={styles.headerEmoji}>💸</Text>
        <Text style={styles.headerTitle}>Qontri</Text>
      </View>

      <View style={styles.qrArea}>
        <QRCode
          value={upiValue}
          size={size}
          color={colors.primary}
          backgroundColor="#FFFFFF"
          quietZone={8}
        />
      </View>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.upiIdText, { color: colors.foreground }]} numberOfLines={1}>
          {upiId}
        </Text>
        <Text style={[styles.scanHint, { color: colors.mutedForeground }]}>
          Scan with any UPI app to pay
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    alignSelf: "center",
    width: 220,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  headerEmoji: {
    fontSize: 16,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  qrArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    gap: 2,
  },
  upiIdText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  scanHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
});
