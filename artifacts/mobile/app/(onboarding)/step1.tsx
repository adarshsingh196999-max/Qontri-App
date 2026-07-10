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
import { useMockAuth } from "@/context/MockAuthContext";

const PRIMARY = "#1E3A5F";
import { API_BASE } from "@/constants/api";

const TRAVEL_STYLES = [
  { emoji: "🏖", label: "Beach Lover" },
  { emoji: "🏔", label: "Mountain Explorer" },
  { emoji: "🌆", label: "City Hopper" },
  { emoji: "🍜", label: "Food Hunter" },
  { emoji: "🎒", label: "Backpacker" },
  { emoji: "💼", label: "Business Traveler" },
  { emoji: "🏕", label: "Adventure Seeker" },
  { emoji: "✈️", label: "Anywhere, I'm In!" },
];

export default function OnboardingStep1() {
  const { token } = useMockAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [travelStyle, setTravelStyle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canContinue = name.trim().length >= 2 && travelStyle.length > 0;

  const handleContinue = async () => {
    if (!canContinue) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), travelStyle }),
      });
      if (!res.ok) throw new Error("Failed to save");
      router.replace("/(onboarding)/step2" as Href);
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
            <Text style={styles.step}>Step 1 of 2</Text>
            <Text style={styles.title}>Tell us about you</Text>
            <Text style={styles.subtitle}>
              This helps your group members recognise you
            </Text>

            <Text style={styles.label}>Your name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Adarsh"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={(t) => { setError(""); setName(t); }}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="done"
              editable={!loading}
            />

            <Text style={styles.label}>Your travel style *</Text>
            <View style={styles.grid}>
              {TRAVEL_STYLES.map((style) => {
                const selected = travelStyle === style.label;
                return (
                  <Pressable
                    key={style.label}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => { setError(""); setTravelStyle(style.label); }}
                  >
                    <Text style={styles.chipEmoji}>{style.emoji}</Text>
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {style.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.btn, !canContinue && styles.btnDisabled]}
              onPress={handleContinue}
              disabled={!canContinue || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Continue →</Text>
              )}
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
    marginBottom: 24,
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
    marginBottom: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: PRIMARY,
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#374151",
  },
  chipTextSelected: {
    color: PRIMARY,
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
});
