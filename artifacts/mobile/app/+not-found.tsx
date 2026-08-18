import { Link, Stack, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useEffect } from "react";

import { useColors } from "@/hooks/useColors";

export default function NotFoundScreen() {
  const colors = useColors();
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main tabs layout immediately to avoid showing the not-found screen.
    router.replace("/(tabs)");
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ title: "Redirecting..." }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Redirecting to home…</Text>
        <Link href="/(tabs)" style={styles.link}>
          <Text style={[styles.linkText, { color: colors.primary }]}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
  },
});
