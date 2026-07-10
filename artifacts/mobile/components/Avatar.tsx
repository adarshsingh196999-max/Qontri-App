import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
  avatar?: string;
}

function isPhotoUri(s: string) {
  return (
    s.startsWith("http") ||
    s.startsWith("file") ||
    s.startsWith("content") ||
    s.startsWith("blob") ||
    s.startsWith("/")
  );
}

export function Avatar({ name, color, size = 36, avatar }: AvatarProps) {
  const colors = useColors();
  const fontSize = size * 0.38;

  if (avatar && isPhotoUri(avatar)) {
    return (
      <Image
        source={{ uri: avatar }}
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
        contentFit="cover"
        transition={200}
      />
    );
  }

  if (avatar && avatar.length <= 8) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color ?? colors.primary,
          },
        ]}
      >
        <Text style={{ fontSize: size * 0.52 }}>{avatar}</Text>
      </View>
    );
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color ?? colors.primary,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize, color: "#FFFFFF" }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  text: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
});
