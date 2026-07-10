import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { API_BASE } from "@/constants/api";

interface MockAuthState {
  isSignedIn: boolean;
  userEmail: string;
  userId: string;
  token: string;
  onboardingDone: boolean;
  signIn: (email: string, token: string, needsOnboarding: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const MockAuthContext = createContext<MockAuthState>({
  isSignedIn: false,
  userEmail: "",
  userId: "",
  token: "",
  onboardingDone: true,
  signIn: async () => {},
  signOut: async () => {},
  completeOnboarding: async () => {},
});

const STORAGE_KEY = "mock_auth_user_v3";
async function pingServer(token: string) {
  try {
    await fetch(`${API_BASE}/ping`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Best-effort — never block the user
  }
}

/**
 * Decode the JWT payload without signature verification.
 * Used only to check the `exp` (expiry) field client-side so we don't
 * need a server round-trip on every app launch.
 */
function getTokenExpiry(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → base64 → JSON
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(base64 + padding);
    const payload = JSON.parse(json) as { exp?: number };
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const exp = getTokenExpiry(token);
  if (exp === null) return false; // can't decode → assume valid, server will reject if bad
  return Date.now() / 1000 > exp;
}

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [token, setToken] = useState("");
  const [onboardingDone, setOnboardingDoneState] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const tokenRef = useRef("");

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw) as {
            email?: string;
            userId?: string;
            token?: string;
            onboardingDone?: boolean;
          };
          if (data.email && data.token) {
            if (isTokenExpired(data.token)) {
              await AsyncStorage.removeItem(STORAGE_KEY);
            } else {
              setUserEmail(data.email);
              setUserId(data.userId ?? "");
              setToken(data.token);
              tokenRef.current = data.token;
              setIsSignedIn(true);
              setOnboardingDoneState(data.onboardingDone ?? true);
              pingServer(data.token);
            }
          }
        }
      } catch {
        // AsyncStorage read failed — leave signed out, don't crash
      }
      setLoaded(true);
    })();
  }, []);

  // Ping on every foreground event so DAU/WAU/MAU count any open, not just logins
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && tokenRef.current) {
        pingServer(tokenRef.current);
      }
    });
    return () => sub.remove();
  }, []);

  const signIn = useCallback(
    async (email: string, authToken: string, needsOnboarding: boolean) => {
      const uid = `user_${email.replace(/[^a-z0-9]/gi, "_")}`;
      const onboarded = !needsOnboarding;
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ email, userId: uid, token: authToken, onboardingDone: onboarded })
      );
      setUserEmail(email);
      setUserId(uid);
      setToken(authToken);
      tokenRef.current = authToken;
      setIsSignedIn(true);
      setOnboardingDoneState(onboarded);
      pingServer(authToken);
    },
    []
  );

  const completeOnboarding = useCallback(async () => {
    setOnboardingDoneState(true);
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw) as object;
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...data, onboardingDone: true })
        );
      } catch {}
    }
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setUserEmail("");
    setUserId("");
    setToken("");
    setIsSignedIn(false);
    setOnboardingDoneState(true);
  }, []);

  if (!loaded) return null;

  return (
    <MockAuthContext.Provider
      value={{
        isSignedIn,
        userEmail,
        userId,
        token,
        onboardingDone,
        signIn,
        signOut,
        completeOnboarding,
      }}
    >
      {children}
    </MockAuthContext.Provider>
  );
}

export function useMockAuth() {
  return useContext(MockAuthContext);
}
