import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { BrandedQRCode } from "@/components/BrandedQRCode";
import { ConfirmModal } from "@/components/ConfirmModal";
import { applepayLogo, gpayLogo, paytmLogo } from "@/constants/upiLogos";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type PayMode = "cash" | "upi" | "bank";

interface UpiApp {
  name: string;
  shortLabel: string;
  logo?: string;
  textLogo?: string;
  logoBg: string;
  buildUrl: (upiId: string, name: string, amount: string) => string;
}

interface GroupChip {
  groupId: string;
  groupName: string;
  emoji: string;
  amount: number;
}

const UPI_APPS: UpiApp[] = [
  {
    name: "Google Pay",
    shortLabel: "GPay",
    logo: gpayLogo,
    logoBg: "#fff",
    buildUrl: (pa, pn, am) =>
      Platform.OS === "ios"
        ? `gpay://upi/pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR`
        : `tez://upi/pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR`,
  },
  {
    name: "PhonePe",
    shortLabel: "PhonePe",
    textLogo: "पे",
    logoBg: "#ffffff",
    buildUrl: (pa, pn, am) =>
      `phonepe://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR`,
  },
  {
    name: "Paytm",
    shortLabel: "Paytm",
    logo: paytmLogo,
    logoBg: "#fff",
    buildUrl: (pa, _pn, am) =>
      `paytmmp://pay?pa=${encodeURIComponent(pa)}&am=${am}&tn=Qontri&cu=INR`,
  },
  {
    name: "Apple Pay",
    shortLabel: "Apple Pay",
    logo: applepayLogo,
    logoBg: "#F5F5F5",
    buildUrl: (pa, pn, am) =>
      Platform.OS === "ios"
        ? `shoebox://`
        : `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=Qontri`,
  },
];

const PAY_MODES: { key: PayMode; label: string; icon: string }[] = [
  { key: "cash", label: "Cash", icon: "dollar-sign" },
  { key: "upi", label: "UPI", icon: "smartphone" },
  { key: "bank", label: "Bank Transfer", icon: "credit-card" },
];

export default function SettlePayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { name, color, amount: amountParam, chips: chipsParam } =
    useLocalSearchParams<{ name: string; color: string; amount: string; chips: string }>();
  const { groups, addSettlement, currentUserId } = useApp();

  const [amount, setAmount] = useState(
    amountParam ? String(Math.round(parseFloat(amountParam))) : ""
  );
  const [mode, setMode] = useState<PayMode>("cash");
  const [notes, setNotes] = useState("");
  const [upiCopied, setUpiCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const chips: GroupChip[] = chipsParam ? JSON.parse(chipsParam) : [];
  const displayName = name ?? "Someone";

  // Find a UPI ID for the payee across groups
  const payeeUpiId = (() => {
    for (const chip of chips) {
      const group = groups.find((g) => g.id === chip.groupId);
      if (!group) continue;
      const member = group.members.find(
        (m) => m.name.toLowerCase() === (name ?? "").toLowerCase() && m.id !== currentUserId
      );
      if (member?.upiId) return member.upiId;
    }
    return "";
  })();

  const handleOpenUpiApp = async (app: UpiApp) => {
    const upiId = payeeUpiId;
    const amt = parseFloat(amount) > 0 ? parseFloat(amount).toFixed(2) : "0.00";

    if (!upiId) {
      Alert.alert(
        "No UPI ID",
        `${displayName} hasn't set a UPI ID yet. Ask them to add it in their Profile.`
      );
      return;
    }

    const url = app.buildUrl(upiId, displayName, amt);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await Linking.openURL(url);
      setShowConfirm(true);
    } catch {
      const fallback = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(displayName)}&am=${amt}&cu=INR&tn=Qontri`;
      try {
        await Linking.openURL(fallback);
        setShowConfirm(true);
      } catch {
        Alert.alert("App Not Found", `Could not open ${app.name}. Make sure it is installed.`);
      }
    }
  };

  const handleCopyUpi = async () => {
    if (!payeeUpiId) return;
    await Clipboard.setStringAsync(payeeUpiId);
    setUpiCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (Platform.OS === "android") ToastAndroid.show("UPI ID copied!", ToastAndroid.SHORT);
    setTimeout(() => setUpiCopied(false), 2000);
  };

  const handleRecordSettlement = () => {
    const amt = parseFloat(amount);
    if (amt <= 0 || chips.length === 0) {
      router.back();
      return;
    }
    let remaining = amt;
    for (let i = 0; i < chips.length; i++) {
      const chip = chips[i];
      const group = groups.find((g) => g.id === chip.groupId);
      if (!group) continue;
      const toMember = group.members.find(
        (m) => m.name.toLowerCase() === (name ?? "").toLowerCase() && m.id !== currentUserId
      );
      if (!toMember) continue;
      const isLast = i === chips.length - 1;
      const chipAmt = isLast ? remaining : Math.min(Math.abs(chip.amount), remaining);
      if (chipAmt > 0) {
        void addSettlement({
          groupId: chip.groupId,
          fromId: currentUserId,
          toId: toMember.id,
          amount: chipAmt,
          date: new Date().toISOString(),
          mode,
        });
      }
      remaining -= chipAmt;
      if (remaining <= 0) break;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
    router.back();
  };

  const parsedAmt = parseFloat(amount);
  const validAmt = parsedAmt > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Nav bar */}
      <View
        style={[
          styles.navBar,
          { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Record Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Transfer card */}
        <View style={[styles.transferCard, { backgroundColor: colors.primary }]}>
          <View style={styles.transferRow}>
            <View style={styles.transferSide}>
              <Avatar name="You" color="#2563EB" size={48} />
              <Text style={styles.transferName} numberOfLines={1}>You</Text>
            </View>
            <View style={styles.transferMid}>
              <View style={styles.arrowLine} />
              <Feather name="arrow-right" size={20} color="rgba(255,255,255,0.9)" />
            </View>
            <View style={styles.transferSide}>
              <Avatar name={displayName} color={color ?? "#1E3A5F"} size={48} />
              <Text style={styles.transferName} numberOfLines={1}>{displayName}</Text>
            </View>
          </View>
        </View>

        {/* Amount field */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Amount (₹)</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
            ]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            selectTextOnFocus
          />
        </View>

        {/* Payment mode */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Payment Method</Text>
          <View style={[styles.modeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {PAY_MODES.map((m, i) => {
              const active = mode === m.key;
              return (
                <Pressable
                  key={m.key}
                  style={[
                    styles.modeBtn,
                    i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border },
                    active && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => {
                    setMode(m.key);
                    Haptics.selectionAsync();
                  }}
                >
                  <Feather
                    name={m.icon as never}
                    size={14}
                    color={active ? "#fff" : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.modeBtnText,
                      { color: active ? "#fff" : colors.mutedForeground },
                    ]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* UPI panel */}
        {mode === "upi" && (
          <View style={[styles.payPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.payPanelHeader, { backgroundColor: colors.muted }]}>
              <Feather name="smartphone" size={14} color={colors.mutedForeground} />
              <Text style={[styles.payPanelTitle, { color: colors.mutedForeground }]}>OPEN UPI APP</Text>
            </View>

            {payeeUpiId ? (
              <View style={styles.qrWrap}>
                <BrandedQRCode
                  upiId={payeeUpiId}
                  userName={displayName}
                />
                <Text style={[styles.qrScanLabel, { color: colors.mutedForeground }]}>
                  Scan to pay via any UPI app
                </Text>
              </View>
            ) : null}

            {payeeUpiId ? (
              <View style={[styles.upiRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="at-sign" size={14} color={colors.mutedForeground} />
                <Text style={[styles.upiIdText, { color: colors.foreground }]} numberOfLines={1}>
                  {payeeUpiId}
                </Text>
                <Pressable
                  style={[
                    styles.copyBtn,
                    { backgroundColor: upiCopied ? colors.primary : colors.secondary },
                  ]}
                  onPress={handleCopyUpi}
                >
                  <Feather
                    name={upiCopied ? "check" : "copy"}
                    size={13}
                    color={upiCopied ? "#fff" : colors.primary}
                  />
                  <Text style={[styles.copyBtnText, { color: upiCopied ? "#fff" : colors.primary }]}>
                    {upiCopied ? "Copied" : "Copy"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={[styles.upiAppsSection, { borderTopColor: colors.border }]}>
              <Text style={[styles.upiAppsLabel, { color: colors.mutedForeground }]}>
                {payeeUpiId ? "OR CHOOSE AN APP" : "CHOOSE AN APP"}
              </Text>
              <View style={styles.upiAppsRow}>
                {UPI_APPS.map((app) => (
                  <Pressable
                    key={app.name}
                    style={styles.upiAppTile}
                    onPress={() => handleOpenUpiApp(app)}
                  >
                    <View style={[styles.upiLogoWrap, { backgroundColor: app.logoBg }]}>
                      {app.textLogo ? (
                        <Text style={[styles.upiTextLogo, { color: "#5F259F" }]}>{app.textLogo}</Text>
                      ) : (
                        <Image source={{ uri: app.logo }} style={styles.upiLogo} resizeMode="contain" />
                      )}
                    </View>
                    <Text style={[styles.upiAppTileLabel, { color: colors.foreground }]}>
                      {app.shortLabel}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Bank info for bank transfer */}
        {mode === "bank" && (
          <View style={[styles.bankInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={[styles.bankInfoText, { color: colors.mutedForeground }]}>
              Transfer via NEFT/IMPS/UPI and record it here.
            </Text>
          </View>
        )}

        {/* Note */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Note (optional)</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
            ]}
            placeholder="Any additional notes..."
            placeholderTextColor={colors.mutedForeground}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        {/* Group chips */}
        {chips.length > 0 && (
          <View style={styles.chipsRow}>
            {chips.map((chip) => (
              <View
                key={chip.groupId}
                style={[styles.chip, { backgroundColor: colors.muted, borderColor: colors.border }]}
              >
                <Text style={styles.chipEmoji}>{chip.emoji}</Text>
                <Text style={[styles.chipText, { color: colors.mutedForeground }]}>
                  {chip.groupName}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Sticky record button */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: bottomPad + 12, backgroundColor: colors.background, borderTopColor: colors.border },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.settleBtn,
            { backgroundColor: validAmt ? colors.primary : colors.muted, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => {
            if (!validAmt) return;
            if (mode === "upi") {
              // UPI handled by app tile; direct record for cash/bank
              setShowConfirm(true);
            } else {
              setShowConfirm(true);
            }
          }}
          disabled={!validAmt}
        >
          <Feather name="check-circle" size={18} color={validAmt ? "#fff" : colors.mutedForeground} />
          <Text style={[styles.settleBtnText, { color: validAmt ? "#fff" : colors.mutedForeground }]}>
            {validAmt
              ? `Record ₹${Math.round(parsedAmt).toLocaleString("en-IN")} Payment`
              : "Enter amount"}
          </Text>
        </Pressable>
      </View>

      <ConfirmModal
        visible={showConfirm}
        title="Mark as Settled?"
        message={`Record that you paid ${displayName} ₹${Math.round(parsedAmt).toLocaleString("en-IN")} via ${
          PAY_MODES.find((m) => m.key === mode)?.label ?? mode
        }?`}
        confirmText="Yes, Record It"
        cancelText="Not yet"
        onConfirm={() => {
          setShowConfirm(false);
          handleRecordSettlement();
        }}
        onCancel={() => setShowConfirm(false)}
      />
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
  scroll: { padding: 20, gap: 20 },
  transferCard: {
    borderRadius: 16,
    padding: 20,
  },
  transferRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  transferSide: {
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  transferName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    textAlign: "center",
  },
  transferMid: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    flex: 1,
  },
  arrowLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  fieldGroup: { gap: 8 },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  modeRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  modeBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  payPanel: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  payPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    paddingBottom: 12,
  },
  payPanelTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  qrWrap: {
    alignItems: "center",
    paddingBottom: 12,
    gap: 6,
  },
  qrScanLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  upiRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  upiIdText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  upiAppsSection: {
    borderTopWidth: 1,
    padding: 14,
    gap: 10,
  },
  upiAppsLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  upiAppsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  upiAppTile: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  upiLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  upiLogo: {
    width: 56,
    height: 56,
  },
  upiTextLogo: {
    fontSize: 22,
    color: "#5F259F",
    fontFamily: "Inter_700Bold",
  },
  upiAppTileLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  bankInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  bankInfoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipEmoji: { fontSize: 14 },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  settleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 14,
  },
  settleBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
