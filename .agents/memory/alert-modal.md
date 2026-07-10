---
name: Alert.alert broken in Replit iframe
description: Why Alert.alert is permanently broken in the Replit canvas preview and how to replace it.
---

## Rule
Never use `Alert.alert` for confirmations or informational dialogs in this app. Use `ConfirmModal` (components/ConfirmModal.tsx) instead.

**Why:** The app runs with `router = "expo-domain"` making it cross-origin inside the Replit canvas iframe. Browsers silently block `window.confirm()` / `window.alert()` in cross-origin iframes — Expo's `Alert.alert` calls these internally on web, so all alerts are silently dropped and button callbacks never fire.

**How to apply:** For every new confirmation flow, import and render `<ConfirmModal>` with `visible`, `title`, `message?`, `confirmText?`, `destructive?`, `onConfirm`, `onCancel` props. Add a state variable to track visibility.
