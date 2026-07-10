---
name: React Native Image pointerEvents
description: Image component does not accept pointerEvents prop — must wrap in View.
---

## Rule
To make a React Native `Image` non-interactive (pass-through for touches), wrap it in `<View pointerEvents="none" style={...}>` rather than setting `pointerEvents` on the `Image` itself.

**Why:** `Image` does not have `pointerEvents` in its TypeScript types (TS2769). It is a `View`-only prop.

**How to apply:** 
```tsx
<View style={StyleSheet.absoluteFillObject} pointerEvents="none">
  <Image source={...} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
</View>
```
