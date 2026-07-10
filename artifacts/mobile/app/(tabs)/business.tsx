import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DatePickerField } from "@/components/DatePickerField";
import { useMockAuth } from "@/context/MockAuthContext";
import { useColors } from "@/hooks/useColors";

import { API_BASE } from "@/constants/api";

interface BusinessTrip {
  id: string;
  name: string;
  destination: string;
  purpose: string;
  startDate: string;
  endDate: string;
  billCount: number;
  totalAmount: number;
  createdAt: string;
}

function formatAmount(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return dateStr; }
}

function NewTripModal({
  visible,
  onClose,
  onCreated,
  token,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (trip: BusinessTrip) => void;
  token: string;
}) {
  const colors = useColors();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setName(""); setDestination(""); setPurpose("");
    setStartDate(new Date().toISOString().split("T")[0]); setEndDate(""); setError("");
  };

  const handleClose = () => { if (saving) return; reset(); onClose(); };

  const handleSave = async () => {
    if (!name.trim()) { setError("Please enter a trip name."); return; }
    if (!startDate) { setError("Please enter a start date."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/business/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), destination, purpose, startDate, endDate }),
      });
      if (!res.ok) throw new Error("Failed");
      const trip = await res.json() as BusinessTrip;
      onCreated(trip);
      reset();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={[s.modalCard, { backgroundColor: colors.card }]}>
          <View style={s.modalHandle} />
          <Text style={[s.modalTitle, { color: colors.foreground }]}>New Business Trip</Text>

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Trip Name *</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            placeholder="e.g. Mumbai Client Visit - July"
            placeholderTextColor={colors.mutedForeground}
            value={name} onChangeText={(t) => { setError(""); setName(t); }}
            editable={!saving} autoCapitalize="words"
          />

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Destination</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            placeholder="e.g. Mumbai, Maharashtra"
            placeholderTextColor={colors.mutedForeground}
            value={destination} onChangeText={setDestination}
            editable={!saving} autoCapitalize="words"
          />

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Purpose</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            placeholder="e.g. Client meeting, Conference"
            placeholderTextColor={colors.mutedForeground}
            value={purpose} onChangeText={setPurpose}
            editable={!saving} autoCapitalize="sentences"
          />

          <View style={s.dateRow}>
            <View style={{ flex: 1 }}>
              <DatePickerField
                label="Start Date *"
                value={startDate}
                onChange={(t) => { setError(""); setStartDate(t); }}
                disabled={saving}
                colors={colors}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <DatePickerField
                label="End Date"
                value={endDate}
                onChange={setEndDate}
                disabled={saving}
                colors={colors}
              />
            </View>
          </View>

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <View style={s.modalActions}>
            <Pressable style={[s.actionBtn, s.cancelBtn, { borderColor: colors.border }]} onPress={handleClose} disabled={saving}>
              <Text style={[s.actionBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[s.actionBtn, s.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[s.actionBtnText, { color: "#fff" }]}>Create Trip</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function BusinessScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useMockAuth();
  const [trips, setTrips] = useState<BusinessTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/business/trips`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTrips(await res.json() as BusinessTrip[]);
    } catch {} finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    setTrips((p) => p.filter((t) => t.id !== id));
    await fetch(`${API_BASE}/business/trips/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
  };

  return (
    <>
      <ScrollView
        style={[s.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: bottomPad + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["#0A1628", "#0F2040", "#1E3A5F"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.hero, { paddingTop: topPad + 16 }]}
        >
          <View style={s.heroHeader}>
            <View>
              <Text style={s.heroTag}>Expense Reimbursement</Text>
              <Text style={s.heroTitle}>Business Trips</Text>
            </View>
            <Pressable style={s.addBtn} onPress={() => setShowNew(true)}>
              <Feather name="plus" size={18} color="#fff" />
              <Text style={s.addBtnText}>New Trip</Text>
            </Pressable>
          </View>

          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statValue}>{trips.length}</Text>
              <Text style={s.statLabel}>Trips</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCard}>
              <Text style={s.statValue}>{trips.reduce((s, t) => s + t.billCount, 0)}</Text>
              <Text style={s.statLabel}>Bills</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCard}>
              <Text style={s.statValue}>{formatAmount(trips.reduce((s, t) => s + t.totalAmount, 0))}</Text>
              <Text style={s.statLabel}>Total</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color="#4A90D9" />
              <Text style={[s.loadingText, { color: colors.mutedForeground }]}>Loading trips…</Text>
            </View>
          ) : trips.length === 0 ? (
            <View style={[s.emptyWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={s.emptyEmoji}>💼</Text>
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>No business trips yet</Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                Create a trip, scan your bills, and export a reimbursement report instantly.
              </Text>
              <Pressable style={s.emptyBtn} onPress={() => setShowNew(true)}>
                <Text style={s.emptyBtnText}>+ Create First Trip</Text>
              </Pressable>
            </View>
          ) : (
            trips.map((trip) => (
              <Pressable
                key={trip.id}
                style={[s.tripCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: "/business/[id]", params: { id: trip.id } })}
              >
                <View style={s.tripCardHeader}>
                  <View style={s.tripIconWrap}>
                    <Feather name="briefcase" size={20} color="#4A90D9" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.tripName, { color: colors.foreground }]} numberOfLines={1}>{trip.name}</Text>
                    {!!trip.destination && (
                      <Text style={[s.tripSub, { color: colors.mutedForeground }]}>
                        📍 {trip.destination}
                      </Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </View>

                <View style={[s.tripCardBody, { borderTopColor: colors.border }]}>
                  <View style={s.tripMeta}>
                    <Text style={[s.tripMetaLabel, { color: colors.mutedForeground }]}>
                      📅 {formatDate(trip.startDate)}{trip.endDate ? ` – ${formatDate(trip.endDate)}` : ""}
                    </Text>
                  </View>
                  {!!trip.purpose && (
                    <Text style={[s.tripPurpose, { color: colors.mutedForeground }]} numberOfLines={1}>
                      💼 {trip.purpose}
                    </Text>
                  )}
                  <View style={s.tripFooter}>
                    <View style={s.tripBillBadge}>
                      <Text style={s.tripBillBadgeText}>{trip.billCount} bill{trip.billCount !== 1 ? "s" : ""}</Text>
                    </View>
                    <Text style={[s.tripTotal, { color: "#4A90D9" }]}>{formatAmount(trip.totalAmount)}</Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <NewTripModal
        visible={showNew}
        onClose={() => setShowNew(false)}
        onCreated={(trip) => { setTrips((p) => [trip, ...p]); setShowNew(false); }}
        token={token}
      />
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingHorizontal: 20, paddingBottom: 24 },
  heroHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 },
  heroTag: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.5)", marginBottom: 2, textTransform: "uppercase", letterSpacing: 1 },
  heroTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#4A90D9", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, shadowColor: "#4A90D9", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4, marginTop: 6 },
  addBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
  statsRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  statCard: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFFFFF", marginBottom: 2 },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.5 },
  statDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.15)" },
  loadingWrap: { alignItems: "center", paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyWrap: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  emptyBtn: { backgroundColor: "#4A90D9", borderRadius: 22, paddingVertical: 10, paddingHorizontal: 20, marginTop: 6 },
  emptyBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
  tripCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  tripCardHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  tripIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(74,144,217,0.12)", alignItems: "center", justifyContent: "center" },
  tripName: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 2 },
  tripSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tripCardBody: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10, borderTopWidth: 1, gap: 4 },
  tripMeta: { flexDirection: "row" },
  tripMetaLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tripPurpose: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tripFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  tripBillBadge: { backgroundColor: "rgba(74,144,217,0.12)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  tripBillBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#4A90D9" },
  tripTotal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 28 },
  modalHandle: { width: 40, height: 4, backgroundColor: "#334155", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 14 },
  dateRow: { flexDirection: "row" },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#EF4444", marginBottom: 12 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cancelBtn: { borderWidth: 1.5 },
  saveBtn: { backgroundColor: "#4A90D9", shadowColor: "#4A90D9", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  actionBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
});
