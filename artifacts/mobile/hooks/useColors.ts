import colors from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

export function useColors() {
  const { resolvedScheme } = useTheme();
  const isDark = resolvedScheme === "dark";
  const palette =
    isDark && "dark" in colors
      ? (colors as unknown as Record<string, typeof colors.light>).dark
      : colors.light;
  return { ...palette, radius: colors.radius, isDark };
}
