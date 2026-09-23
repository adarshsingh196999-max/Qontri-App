import React, { useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/react-native";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
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
import Constants from "expo-constants";
import { useMockAuth } from "@/context/MockAuthContext";
import { API_BASE } from "@/constants/api";

// Helper: fetch with timeout using AbortController
async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs = 10000
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Quick external probe to check if device has general connectivity
async function externalConnectivityProbe() {
  try {
    const probe = await fetchWithTimeout(
      "https://www.google.com/generate_204",
      {},
      5000
    );

    return probe && probe.status === 204;
  } catch (e) {
    return false;
  }
}

const PRIMARY = "#1E3A5F";
const ERROR = "#EF4444";

type Step = "email" | "otp";
type AuthMethod = "mobile" | "email";

type CountryOption = {
  name: string;
  flag: string;
  code: string;
  dialCode: string;
};

const COUNTRY_OPTIONS: CountryOption[] = [
  { name: "India", flag: "🇮🇳", code: "IN", dialCode: "+91" },
  { name: "United States", flag: "🇺🇸", code: "US", dialCode: "+1" },
  { name: "United Kingdom", flag: "🇬🇧", code: "GB", dialCode: "+44" },
  { name: "Canada", flag: "🇨🇦", code: "CA", dialCode: "+1" },
  { name: "Australia", flag: "🇦🇺", code: "AU", dialCode: "+61" },
  { name: "United Arab Emirates", flag: "🇦🇪", code: "AE", dialCode: "+971" },
  { name: "Saudi Arabia", flag: "🇸🇦", code: "SA", dialCode: "+966" },
  { name: "Singapore", flag: "🇸🇬", code: "SG", dialCode: "+65" },
  { name: "Malaysia", flag: "🇲🇾", code: "MY", dialCode: "+60" },
  { name: "Pakistan", flag: "🇵🇰", code: "PK", dialCode: "+92" },
  { name: "Bangladesh", flag: "🇧🇩", code: "BD", dialCode: "+880" },
  { name: "Nepal", flag: "🇳🇵", code: "NP", dialCode: "+977" },
  { name: "Sri Lanka", flag: "🇱🇰", code: "LK", dialCode: "+94" },
  { name: "Germany", flag: "🇩🇪", code: "DE", dialCode: "+49" },
  { name: "France", flag: "🇫🇷", code: "FR", dialCode: "+33" },
  { name: "Spain", flag: "🇪🇸", code: "ES", dialCode: "+34" },
  { name: "Italy", flag: "🇮🇹", code: "IT", dialCode: "+39" },
  { name: "Netherlands", flag: "🇳🇱", code: "NL", dialCode: "+31" },
  { name: "Belgium", flag: "🇧🇪", code: "BE", dialCode: "+32" },
  { name: "Switzerland", flag: "🇨🇭", code: "CH", dialCode: "+41" },
  { name: "Sweden", flag: "🇸🇪", code: "SE", dialCode: "+46" },
  { name: "Norway", flag: "🇳🇴", code: "NO", dialCode: "+47" },
  { name: "Denmark", flag: "🇩🇰", code: "DK", dialCode: "+45" },
  { name: "Finland", flag: "🇫🇮", code: "FI", dialCode: "+358" },
  { name: "Poland", flag: "🇵🇱", code: "PL", dialCode: "+48" },
  { name: "Czech Republic", flag: "🇨🇿", code: "CZ", dialCode: "+420" },
  { name: "Austria", flag: "🇦🇹", code: "AT", dialCode: "+43" },
  { name: "Portugal", flag: "🇵🇹", code: "PT", dialCode: "+351" },
  { name: "Ireland", flag: "🇮🇪", code: "IE", dialCode: "+353" },
  { name: "Greece", flag: "🇬🇷", code: "GR", dialCode: "+30" },
  { name: "Turkey", flag: "🇹🇷", code: "TR", dialCode: "+90" },
  { name: "Russia", flag: "🇷🇺", code: "RU", dialCode: "+7" },
  { name: "Ukraine", flag: "🇺🇦", code: "UA", dialCode: "+380" },
  { name: "Romania", flag: "🇷🇴", code: "RO", dialCode: "+40" },
  { name: "Hungary", flag: "🇭🇺", code: "HU", dialCode: "+36" },
  { name: "Brazil", flag: "🇧🇷", code: "BR", dialCode: "+55" },
  { name: "Mexico", flag: "🇲🇽", code: "MX", dialCode: "+52" },
  { name: "Argentina", flag: "🇦🇷", code: "AR", dialCode: "+54" },
  { name: "Chile", flag: "🇨🇱", code: "CL", dialCode: "+56" },
  { name: "Colombia", flag: "🇨🇴", code: "CO", dialCode: "+57" },
  { name: "Peru", flag: "🇵🇪", code: "PE", dialCode: "+51" },
  { name: "Japan", flag: "🇯🇵", code: "JP", dialCode: "+81" },
  { name: "South Korea", flag: "🇰🇷", code: "KR", dialCode: "+82" },
  { name: "China", flag: "🇨🇳", code: "CN", dialCode: "+86" },
  { name: "Indonesia", flag: "🇮🇩", code: "ID", dialCode: "+62" },
  { name: "Thailand", flag: "🇹🇭", code: "TH", dialCode: "+66" },
  { name: "Vietnam", flag: "🇻🇳", code: "VN", dialCode: "+84" },
  { name: "Philippines", flag: "🇵🇭", code: "PH", dialCode: "+63" },
  { name: "South Africa", flag: "🇿🇦", code: "ZA", dialCode: "+27" },
  { name: "Nigeria", flag: "🇳🇬", code: "NG", dialCode: "+234" },
  { name: "Kenya", flag: "🇰🇪", code: "KE", dialCode: "+254" },
  { name: "Egypt", flag: "🇪🇬", code: "EG", dialCode: "+20" },
  { name: "Morocco", flag: "🇲🇦", code: "MA", dialCode: "+212" },
  { name: "Algeria", flag: "🇩🇿", code: "DZ", dialCode: "+213" },
  { name: "Israel", flag: "🇮🇱", code: "IL", dialCode: "+972" },
  { name: "New Zealand", flag: "🇳🇿", code: "NZ", dialCode: "+64" },
];

const DEFAULT_COUNTRY = COUNTRY_OPTIONS.find((country) => country.code === "IN") ?? COUNTRY_OPTIONS[0];

export default function SignInPage() {
  const { signIn } = useMockAuth();

  const [step, setStep] = useState<Step>("email");
  const [loginMethod, setLoginMethod] = useState<AuthMethod>("mobile");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(DEFAULT_COUNTRY);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [localError, setLocalError] = useState("");
  const [loading, setLoading] = useState(false);

  const otpRefs = useRef<(TextInput | null)[]>([]);

  const handleSendCode = async () => {
    setLocalError("");

    const trimmed = email.trim().toLowerCase();

    if (!trimmed.includes("@")) {
      setLocalError("Enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const url = `${API_BASE}/auth/send-otp`;

      const hasExternal = await externalConnectivityProbe();

      if (!hasExternal) {
        const msg =
          "No general internet connectivity detected (external probe failed).";

        Sentry.captureMessage(msg);
        setLocalError("Network error. Check connection.");
        return;
      }

      try {
        const health = await fetchWithTimeout(
          `${API_BASE}/auth/health`,
          {},
          4000
        );

        if (!health.ok) {
          const text = await health.text().catch(() => "no-body");

          Sentry.captureMessage(
            `Health check failed: ${health.status} ${text}`
          );
          setLocalError(`Server error: ${health.status}. Please try again.`);
        }
      } catch (e: any) {
        Sentry.captureException(e, { level: "warning" });
      }

      let attempt = 0;
      let lastErr: any = null;
      let data: any = null;

      while (attempt < 2) {
        attempt += 1;

        try {
          const res = await fetchWithTimeout(
            url,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                email: trimmed,
              }),
            },
            10000
          );

          try {
            data = await res.json();
          } catch (e) {
            data = null;
          }

          if (!res.ok) {
            const errText = data?.error ?? `status ${res.status}`;

            setLocalError(errText ?? "Failed to send code.");

            Sentry.captureMessage(
              `Send-OTP failed (attempt ${attempt}): ${errText}`
            );

            return;
          }

          if (!data || !data.success) {
            setLocalError(data?.error ?? "Failed to send code.");
            return;
          }

          const testCode = typeof data?.testCode === "string" ? data.testCode : "";
          if (testCode) {
            setLocalError(`Test mode active. Use code: ${testCode}`);
          }

          break;
        } catch (error: any) {
          lastErr = error;

          Sentry.captureException(error);

          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 700));
          }
        }
      }

      if (lastErr) {
        const errMsg = lastErr?.message ?? String(lastErr);
        setLocalError(`Network error: ${errMsg}`);
        return;
      }

      setOtp(["", "", "", "", "", ""]);
      setStep("otp");

      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 100);
    } catch (error: any) {
      Sentry.captureException(error);
      setLocalError(
        error?.message ?? "Email OTP failed. Please check backend configuration."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLocalError("");

    const entered = otp.join("");

    if (entered.length < 6) {
      setLocalError("Enter 6 digits");
      return;
    }

    setLoading(true);

    try {
      const url = `${API_BASE}/auth/verify-otp`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: entered,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setLocalError(data.error ?? "Incorrect code.");
        return;
      }

      const tok =
        typeof data?.token === "string" ? data.token.trim() : "";

      if (!tok) {
        setLocalError(
          "Verification failed. Please request a new code."
        );
        return;
      }

      let needsOnboarding = true;

      try {
        const profileRes = await fetch(`${API_BASE}/me`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${tok}`,
          },
        });

        if (profileRes.ok) {
          const profile = await profileRes.json();

          needsOnboarding =
            !profile.name || profile.name.trim().length === 0;
        }
      } catch (err) {
        console.error(err);
      }

      const normalizedEmail = email.trim().toLowerCase();

      await signIn(
        normalizedEmail,
        tok,
        needsOnboarding
      );
    } catch (error: any) {
      Sentry.captureException(error);

      console.error(
        "OTP verification network error:",
        error
      );

      setLocalError(
        error?.message
          ? `Network error: ${error.message}`
          : "Error verifying code."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendMobileOtp = async () => {
    setLocalError("");

    const trimmedPhone = phone.trim();
    const cleanPhone = trimmedPhone.replace(/\D/g, "");

    if (!cleanPhone) {
      setLocalError("Enter a phone number");
      return;
    }

    const fullPhone = `${selectedCountry.dialCode}${cleanPhone}`;

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/send-sms-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: fullPhone }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? "Could not send SMS code.");
      }

      setOtp(["", "", "", "", "", ""]);
      setStep("otp");
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 100);
    } catch (error: any) {
      Sentry.captureException(error);
      console.error("[AUTH] Mobile OTP send failed:", error);
      setLocalError(
        error?.message ?? "Could not send the SMS code. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMobileOtp = async () => {
    setLocalError("");

    const entered = otp.join("");

    if (entered.length < 6) {
      setLocalError("Enter 6 digits");
      return;
    }

    setLoading(true);

    try {
      const fullPhone = `${selectedCountry.dialCode}${phone.replace(/\D/g, "")}`;

      const res = await fetch(`${API_BASE}/auth/verify-sms-otp`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: fullPhone,
          code: entered,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        const token = typeof data?.token === "string" ? data.token.trim() : "";

        if (!token) {
          setLocalError("Verification failed. Please request a new code.");
          return;
        }

        const profileRes = await fetch(`${API_BASE}/me`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        let needsOnboarding = true;
        if (profileRes.ok) {
          const profile = await profileRes.json().catch(() => null);
          needsOnboarding = !profile?.name || profile.name.trim().length === 0;
        }

        await signIn(data.email ?? `phone_${phone.replace(/[^\d]/g, "")}@qontri.local`, token, needsOnboarding);
        return;
      }

      setLocalError(data?.error ?? "Incorrect SMS code.");
    } catch (error: any) {
      Sentry.captureException(error);
      console.error("[AUTH] Mobile OTP verification failed:", error);
      setLocalError(error?.message ?? "Could not verify the SMS code.");
    } finally {
      setLoading(false);
    }
  };

  const handleMobileSubmit = () => {
    if (loginMethod === "mobile") {
      void handleSendMobileOtp();
      return;
    }

    void handleSendCode();
  };

  const handleOtpSubmit = () => {
    if (loginMethod === "mobile") {
      void handleVerifyMobileOtp();
      return;
    }

    void handleVerifyOtp();
  };

  const otpBackLabel = loginMethod === "mobile" ? "← Change number" : "← Change email";
  const otpTitle = loginMethod === "mobile" ? "Check your phone" : "Check your email";

  const handleOtpChange = (
    value: string,
    index: number
  ) => {
    const newOtp = [...otp];

    if (value.length > 1) {
      const digits = value
        .replace(/\D/g, "")
        .slice(0, 6)
        .split("");

      digits.forEach((d, i) => {
        if (index + i < 6) {
          newOtp[index + i] = d;
        }
      });

      setOtp(newOtp);

      otpRefs.current[
        Math.min(index + digits.length, 5)
      ]?.focus();
    } else {
      newOtp[index] = value.replace(/\D/g, "");

      setOtp(newOtp);

      if (value && index < 5) {
        otpRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleOtpKeyPress = (
    key: string,
    index: number
  ) => {
    if (
      key === "Backspace" &&
      !otp[index] &&
      index > 0
    ) {
      const newOtp = [...otp];

      newOtp[index - 1] = "";

      setOtp(newOtp);

      otpRefs.current[index - 1]?.focus();
    }
  };

  return (
    <ImageBackground
      source={require("@/assets/images/splash.png")}
      style={styles.bg}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.spacer} />

          <View style={styles.card}>
            {step === "email" ? (
              <>
                <Text style={styles.title}>
                  Welcome
                </Text>

                <Text style={styles.subtitle}>
                  Choose how you want to continue
                </Text>

                <View style={styles.methodToggleRow}>
                  <Pressable
                    style={[
                      styles.methodToggle,
                      loginMethod === "mobile" && styles.methodToggleActive,
                    ]}
                    onPress={() => {
                      setLoginMethod("mobile");
                      setLocalError("");
                    }}
                  >
                    <Text
                      style={[
                        styles.methodToggleText,
                        loginMethod === "mobile" && styles.methodToggleTextActive,
                      ]}
                    >
                      Mobile OTP
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.methodToggle,
                      loginMethod === "email" && styles.methodToggleActive,
                    ]}
                    onPress={() => {
                      setLoginMethod("email");
                      setLocalError("");
                    }}
                  >
                    <Text
                      style={[
                        styles.methodToggleText,
                        loginMethod === "email" && styles.methodToggleTextActive,
                      ]}
                    >
                      Email OTP
                    </Text>
                  </Pressable>
                </View>

                {loginMethod === "mobile" ? (
                  <View style={styles.phoneRow}>
                    <Pressable
                      style={styles.countrySelector}
                      onPress={() => setCountryPickerVisible(true)}
                      disabled={loading}
                    >
                      <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                      <Text style={styles.countryCode}>{selectedCountry.dialCode}</Text>
                    </Pressable>

                    <TextInput
                      style={styles.phoneInput}
                      placeholder="98765 43210"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={(t) => {
                        setLocalError("");
                        setPhone(t);
                      }}
                      editable={!loading}
                    />
                  </View>
                ) : (
                  <TextInput
                    style={styles.emailInput}
                    placeholder="you@example.com"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={(t) => {
                      setLocalError("");
                      setEmail(t);
                    }}
                    editable={!loading}
                  />
                )}

                {localError ? (
                  <Text style={styles.error}>
                    {localError}
                  </Text>
                ) : null}

                <Pressable
                  style={styles.primaryBtn}
                  onPress={handleMobileSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      Send OTP
                    </Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    setStep("email");
                    setLocalError("");
                  }}
                  style={styles.backBtn}
                >
                  <Text
                    style={styles.backBtnText}
                  >
                    {otpBackLabel}
                  </Text>
                </Pressable>

                <Text style={styles.title}>
                  {otpTitle}
                </Text>

                <View style={styles.otpRow}>
                  {otp.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={(ref) => {
                        otpRefs.current[i] = ref;
                      }}
                      style={[
                        styles.otpBox,
                        digit
                          ? styles.otpBoxFilled
                          : null,
                      ]}
                      value={digit}
                      onChangeText={(v) =>
                        handleOtpChange(v, i)
                      }
                      onKeyPress={({
                        nativeEvent,
                      }) =>
                        handleOtpKeyPress(
                          nativeEvent.key,
                          i
                        )
                      }
                      keyboardType="number-pad"
                      maxLength={1}
                      editable={!loading}
                    />
                  ))}
                </View>

                {localError ? (
                  <Text style={styles.error}>
                    {localError}
                  </Text>
                ) : null}

                <Pressable
                  style={styles.primaryBtn}
                  onPress={handleOtpSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      Verify Code
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={countryPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCountryPickerVisible(false)}
      >
        <Pressable
          style={styles.countryModalContent}
          onPress={() => setCountryPickerVisible(false)}
        >
          <Pressable style={styles.countrySheet}>
            <Text style={styles.countrySheetHeader}>Select country</Text>
            <ScrollView>
              {COUNTRY_OPTIONS.map((country) => (
                <Pressable
                  key={`${country.code}-${country.dialCode}`}
                  style={styles.countryItem}
                  onPress={() => {
                    setSelectedCountry(country);
                    setCountryPickerVisible(false);
                  }}
                >
                  <Text style={styles.countryItemFlag}>{country.flag}</Text>
                  <Text style={styles.countryItemName}>{country.name}</Text>
                  <Text style={styles.countryItemCode}>{country.dialCode}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },

  flex: {
    flex: 1,
  },

  scroll: {
    flexGrow: 1,
  },

  spacer: {
    flex: 1,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    margin: 16,
    marginBottom: 40,
    elevation: 4,
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
  },

  emailInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },

  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },

  otpBox: {
    width: 44,
    height: 54,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    fontSize: 22,
    textAlign: "center",
  },

  otpBoxFilled: {
    borderColor: PRIMARY,
    backgroundColor: "#EFF6FF",
  },

  error: {
    fontSize: 12,
    color: ERROR,
    marginBottom: 12,
    marginTop: 4,
  },

  primaryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },

  primaryBtnText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
  },

  backBtn: {
    marginBottom: 16,
  },

  backBtnText: {
    fontSize: 14,
    color: PRIMARY,
  },

  methodToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },

  methodToggle: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    paddingVertical: 12,
    alignItems: "center",
  },

  methodToggleActive: {
    backgroundColor: "#E0F2FE",
    borderColor: PRIMARY,
  },

  methodToggleText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },

  methodToggleTextActive: {
    color: PRIMARY,
  },

  countrySelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minWidth: 90,
    marginRight: 8,
  },

  countryFlag: {
    fontSize: 18,
    marginRight: 6,
  },

  countryCode: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "600",
  },

  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  phoneInput: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },

  countryModalContent: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.35)",
    justifyContent: "flex-end",
  },

  countrySheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 26,
    maxHeight: "75%",
  },

  countrySheetHeader: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },

  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  countryItemFlag: {
    fontSize: 20,
    width: 28,
  },

  countryItemName: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    marginLeft: 10,
  },

  countryItemCode: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "600",
  },
});