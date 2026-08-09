import { useEffect, useState, useRef } from 'react';
import { Animated, StyleSheet, View, StatusBar, Dimensions } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  
  const logoScale = useRef(new Animated.Value(0.8)).current; 
  const logoOpacity = useRef(new Animated.Value(0)).current; 
  const containerOpacity = useRef(new Animated.Value(1)).current; 

  useEffect(() => {
    async function prepare() {
      try {
        // Reduced to 1.5s to speed up the fix
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();

      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 4, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => {
          Animated.timing(containerOpacity, {
            toValue: 0,
            duration: 600, 
            useNativeDriver: true,
          }).start(() => setShowSplash(false));
        }, 1000);
      });
    }
  }, [appIsReady]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A1628' }}>
      <StatusBar barStyle="light-content" />
      
      {/* The App Stack: ALWAYS RENDERED so navigation works */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>

      {/* The Splash Overlay: Sits on top and disappears */}
      {showSplash && (
        <Animated.View style={[styles.container, { opacity: containerOpacity }]} pointerEvents="none">
          <Animated.Image
            source={require('../assets/images/icon.png')}
            style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A1628', 
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999, // Ensure it is on the very top
  },
  logo: {
    width: 320,
    height: 320,
    resizeMode: 'contain',
  },
});