import { type Href, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMockAuth } from "@/context/MockAuthContext";

const PRIMARY = "#1E3A5F";
import { API_BASE } from "@/constants/api";

export default function OnboardingStep2() {
  const { token, completeOnboarding } = useMockAuth();
  const router = useRouter();

  const [upiId, setUpiId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const finish = async (saveUpi: boolean) => {
    setError("");
    setLoading(true);
    try {
      if (saveUpi && upiId.trim()) {
        const res = await fetch(`${API_BASE}/me`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ upiId: upiId.trim() }),
        });
        if (!res.ok) throw new Error("Failed to save");
      }
      await completeOnboarding();
      router.replace("/(tabs)" as Href);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require("@/assets/images/splash.png")}
      style={styles.bg}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.spacer} />

          <View style={styles.card}>
            <Text style={styles.step}>Step 2 of 2</Text>
            <Text style={styles.title}>Add your UPI ID</Text>
            <Text style={styles.subtitle}>
              Save time on settlements — no more asking for QR codes or UPI IDs every time someone needs to pay you back.
            </Text>

            <View style={styles.infoBox}>
              <Feather name="zap" size={16} color={PRIMARY} style={{ marginTop: 2 }} />
              <Text style={styles.infoText}>
                When a group member settles up with you, they'll see your UPI ID directly. Quick, simple, done.
              </Text>
            </View>

            <Text style={styles.label}>UPI ID</Text>
            <TextInput
              style={styles.input}
              placeholder="yourname@upi"
              placeholderTextColor="#9CA3AF"
              value={upiId}
              onChangeText={(t) => { setError(""); setUpiId(t); }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="done"
              onSubmitEditing={() => finish(true)}
              editable={!loading}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.btn, (!upiId.trim() || loading) && styles.btnDisabled]}
              onPress={() => finish(true)}
              disabled={!upiId.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Save & Get Started</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.skipBtn}
              onPress={() => finish(false)}
              disabled={loading}
            >
              <Text style={styles.skipText}>I'll add it later</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  spacer: { flex: 1, minHeight: 40 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    margin: 16,
    marginBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  step: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: "#111827",
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
    lineHeight: 22,
  },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: PRIMARY,
    lineHeight: 20,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#111827",
    marginBottom: 8,
  },
  error: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#EF4444",
    marginBottom: 12,
  },
  btn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  skipBtn: {
    alignItems: "center",
    marginTop: 16,
    padding: 8,
  },
  skipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#9CA3AF",
  },
});
