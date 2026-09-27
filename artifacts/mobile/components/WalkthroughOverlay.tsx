import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Defs, Mask, Rect } from "react-native-svg";

export type WalkthroughStep = {
  ref: React.RefObject<View | null>;
  title: string;
  body: string;
};

type Props = {
  visible: boolean;
  steps: WalkthroughStep[];
  onDone: () => void;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const TOOLTIP_MAX_WIDTH = Math.min(SCREEN_WIDTH - 40, 340);
const HOLE_PADDING = 6; // extra space around the target inside the hole

export default function WalkthroughOverlay({ visible, steps, onDone }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      fadeAnim.setValue(0);
      return;
    }
    const current = steps[stepIndex];
    const node = current?.ref?.current;
    if (!node) {
      setTargetRect(null);
      return;
    }
        const timeout = setTimeout(() => {
            node.measureInWindow((x, y, w, h) => {
        // Android: measureInWindow on Pressables inside FlatList/ScrollView can
        // return y relative to the scroll container, not the screen.
        // Workaround: measure the position of the whole screen once via Dimensions
        // and offset. Empirical: header sits below status bar + insets.
                const ANDROID_MEASURE_Y_OFFSET = 54; // empirically measured
        const adjustedY = Platform.OS === "android" ? y + ANDROID_MEASURE_Y_OFFSET : y;
 
        setTargetRect({ x, y: adjustedY, width: w, height: h });
      });
    }, 400);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
    return () => clearTimeout(timeout);
  }, [visible, stepIndex, steps, fadeAnim]);

  if (!visible) return null;

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLast) onDone();
    else setStepIndex((i) => i + 1);
  };


  // Tooltip position: below the hole if there's room, else above
  let tooltipTop = SCREEN_HEIGHT / 2 - 100;
  let tooltipLeft = (SCREEN_WIDTH - TOOLTIP_MAX_WIDTH) / 2; // centered by default

  if (targetRect) {
    const targetBottom = targetRect.y + targetRect.height + HOLE_PADDING;
    const spaceBelow = SCREEN_HEIGHT - targetBottom;
    const CARD_HEIGHT_ESTIMATE = 200;

    if (spaceBelow > CARD_HEIGHT_ESTIMATE + 20) {
      tooltipTop = targetBottom + 16;
    } else {
      // place above the hole
      tooltipTop = Math.max(
        60,
        targetRect.y - HOLE_PADDING - CARD_HEIGHT_ESTIMATE - 16
      );
    }

    // center horizontally on the target, clamped
    const targetCenterX = targetRect.x + targetRect.width / 2;
    const desiredLeft = targetCenterX - TOOLTIP_MAX_WIDTH / 2;
    tooltipLeft = Math.max(
      20,
      Math.min(SCREEN_WIDTH - TOOLTIP_MAX_WIDTH - 20, desiredLeft)
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dim backdrop with hole — whole SVG is pressable to prevent accidental taps */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          /* do nothing — force user to tap Skip or Next */
        }}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
          <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
            <Defs>
              <Mask id="walkthrough-mask">
                {/* White = visible dim. The rect is black = hole (transparent). */}
                <Rect
                  x="0"
                  y="0"
                  width={SCREEN_WIDTH}
                  height={SCREEN_HEIGHT}
                  fill="white"
                />
                {targetRect && (
                  <Rect
                    x={targetRect.x - HOLE_PADDING}
                    y={targetRect.y - HOLE_PADDING}
                    width={targetRect.width + HOLE_PADDING * 2}
                    height={targetRect.height + HOLE_PADDING * 2}
                    rx={12}
                    ry={12}
                    fill="black"
                  />
                )}
              </Mask>
            </Defs>
            <Rect
              x="0"
              y="0"
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT}
              fill="rgba(15, 23, 42, 0.75)"
              mask="url(#walkthrough-mask)"
            />
          </Svg>
        </Animated.View>
      </Pressable>

      {/* Tooltip card */}
      <Animated.View
        style={[
          styles.tooltip,
          {
            top: tooltipTop,
            left: tooltipLeft,
            width: TOOLTIP_MAX_WIDTH,
            opacity: fadeAnim,
          },
        ]}
      >
        <Text style={styles.stepLabel}>
          STEP {stepIndex + 1} OF {steps.length}
        </Text>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === stepIndex && styles.dotActive]}
              />
            ))}
          </View>

          <View style={styles.buttons}>
            <Pressable onPress={onDone} hitSlop={8}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
            <Pressable onPress={handleNext} style={styles.nextBtn}>
              <Text style={styles.nextText}>
                {isLast ? "Got it" : "Next"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    color: "#2563EB",
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 6,
  },
  body: {
    fontSize: 13.5,
    fontWeight: "400",
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 16,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    backgroundColor: "#2563EB",
  },
  buttons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  skipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  nextBtn: {
    backgroundColor: "#1E3A5F",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  nextText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});