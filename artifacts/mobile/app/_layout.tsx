import * as Sentry from '@sentry/react-native';
import crashlytics from '@react-native-firebase/crashlytics';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  debug: false, // Set to true only if you want to see Sentry's internal logs
});

// Initialize Crashlytics collection and wire global JS error handlers
try {
  crashlytics().setCrashlyticsCollectionEnabled(true);
  const globalAny: any = global;
  const defaultHandler = (globalAny.ErrorUtils && globalAny.ErrorUtils.getGlobalHandler && globalAny.ErrorUtils.getGlobalHandler()) || null;
  if (globalAny.ErrorUtils && globalAny.ErrorUtils.setGlobalHandler) {
    globalAny.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      try { crashlytics().recordError ? crashlytics().recordError(error) : crashlytics().log(error?.toString?.() ?? 'JS Error'); } catch (e) {}
      if (defaultHandler) defaultHandler(error, isFatal);
    });
  }
  if (globalAny.addEventListener) {
    globalAny.addEventListener('unhandledrejection', (ev: any) => {
      try { crashlytics().recordError ? crashlytics().recordError(ev?.reason) : crashlytics().log('UnhandledRejection'); } catch (e) {}
    });
  } else {
    (globalAny as any).onunhandledrejection = (ev: any) => {
      try { crashlytics().recordError ? crashlytics().recordError(ev?.reason) : crashlytics().log('UnhandledRejection'); } catch (e) {}
    };
  }
} catch (err) {
  // If packages are not installed yet, don't block app startup
  // console.warn('Crashlytics init skipped:', err);
}
import { useEffect, useState, useRef } from 'react';
import { Animated, StyleSheet, View, StatusBar } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// --- CHECK THESE IMPORTS ---
// If these show red, it means the name inside { } might be different in your files
import { MockAuthProvider, useMockAuth } from "../context/MockAuthContext";
import { AppProvider } from "../context/AppContext";
import { ThemeProvider } from "../context/ThemeContext";
import { initializeSentry } from "../lib/sentry";

SplashScreen.preventAutoHideAsync();
initializeSentry();

function InitialLayout() {
  const { isSignedIn, onboardingDone, loaded } = useMockAuth();
  const segments = useSegments();
  const router = useRouter();
  
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(1.0)).current;

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => {});
      
      // Keep the logo on screen for 2 seconds then fade it
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            toValue: 1.02,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start(() => setShowSplash(false));
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace((onboardingDone ? "/(tabs)" : "/(onboarding)") as any);
    }
  }, [isSignedIn, loaded, segments, onboardingDone]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      
      {loaded && (
        <Stack screenOptions={{ headerShown: false }}>
          {!isSignedIn && <Stack.Screen name="(auth)" />}
          {isSignedIn && <Stack.Screen name="(tabs)" />}
          {isSignedIn && <Stack.Screen name="(onboarding)" />}
        </Stack>
      )}

      {showSplash && (
        <Animated.View style={[styles.splashOverlay, { opacity: fadeAnim }]} pointerEvents="none">
          <Animated.Image
            source={require('../assets/images/icon-symbol.png')}
            style={[styles.logo, { transform: [{ scale: logoScale }] }]}
          />
        </Animated.View>
      )}
    </View>
  );
}

// 1. Define the RootLayout function first
function RootLayout() {
  return (
    <SafeAreaProvider>
      <MockAuthProvider>
        <ThemeProvider>
          <AppProvider>
            <InitialLayout />
          </AppProvider>
        </ThemeProvider>
      </MockAuthProvider>
    </SafeAreaProvider>
  );
}

// 2. Wrap it with Sentry at the very end
export default Sentry.wrap(RootLayout);


const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A1628',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  logo: {
    width: 320,
    height: 320,
    resizeMode: 'contain',
  },
});