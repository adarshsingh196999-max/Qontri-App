import { Redirect, Stack } from "expo-router";
import React from "react";

import { useMockAuth } from "@/context/MockAuthContext";

export default function AuthLayout() {
  const { isSignedIn, onboardingDone } = useMockAuth();

  if (isSignedIn && !onboardingDone) {
    return <Redirect href="/(onboarding)/step1" />;
  }
  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
    </Stack>
  );
}
