---
name: expo-camera version lock
description: expo-camera must be pinned to ^17.0.10 — newer versions crash on web.
---

## Rule
Keep `expo-camera` at `^17.0.10` in artifacts/mobile.

**Why:** Installing a newer version causes `createPermissionHook is not a function` crash on web/Expo web preview. This was confirmed by direct testing.

**How to apply:** When running `pnpm add expo-camera`, pin explicitly: `expo-camera@^17.0.10`. Do not upgrade without testing on web.
