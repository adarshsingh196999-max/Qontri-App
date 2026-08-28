import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

interface MockAuthState {
  isSignedIn: boolean;
  userEmail: string;
  userId: string;
  token: string;
  onboardingDone: boolean;
  loaded: boolean; 
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
  loaded: false,
  signIn: async () => {},
  signOut: async () => {},
  completeOnboarding: async () => {},
});

const STORAGE_KEY = "qontri_auth_v4";

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [token, setToken] = useState("");
  const [onboardingDone, setOnboardingDoneState] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data.token) {
            setUserEmail(data.email || "");
            setUserId(data.userId || "");
            setToken(data.token);
            setIsSignedIn(true);
            setOnboardingDoneState(data.onboardingDone ?? true);
          }
        }
      } catch (e) {} finally {
        setLoaded(true); 
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, authToken: string, needsOnboarding: boolean) => {
    const normalizedEmail = (email ?? "").trim().toLowerCase();
    const safeToken = (authToken ?? "").trim();

    if (!normalizedEmail || !safeToken) {
      throw new Error("Missing auth data.");
    }

    const uid = `user_${normalizedEmail.replace(/[^a-z0-9]/gi, "_")}`;
    const onboarded = !needsOnboarding;

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ email: normalizedEmail, userId: uid, token: safeToken, onboardingDone: onboarded })
    );

    setUserEmail(normalizedEmail);
    setUserId(uid);
    setToken(safeToken);
    setIsSignedIn(true);
    setOnboardingDoneState(onboarded);
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setUserEmail("");
    setUserId("");
    setIsSignedIn(false);
    setToken("");
    setOnboardingDoneState(true);
  }, []);

  const completeOnboarding = useCallback(async () => {
    setOnboardingDoneState(true);
  }, []);

  return (
    <MockAuthContext.Provider
      value={{
        isSignedIn,
        userEmail,
        userId,
        token,
        onboardingDone,
        loaded,
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