import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useApp } from "@/context/AppContext";
import { useMockAuth } from "@/context/MockAuthContext";
import { ThemeMode, useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const { themeMode, setThemeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut, userEmail } = useMockAuth();
  const router = useRouter();
  const {
    currentUserName,
    setCurrentUserName,
    currentUserAvatar, setCurrentUserAvatar,
    currentUserTravelStyle, setCurrentUserTravelStyle,
  } = useApp();

  const TRAVEL_STYLES = [
    { emoji: "🏖", label: "Beach Lover" },
    { emoji: "🏔", label: "Mountain Explorer" },
    { emoji: "🌆", label: "City Hopper" },
    { emoji: "🍜", label: "Food Hunter" },
    { emoji: "🎒", label: "Backpacker" },
    { emoji: "💼", label: "Business Traveler" },
    { emoji: "🏕", label: "Adventure Seeker" },
    { emoji: "✈️", label: "Anywhere, I'm In!" },
  ];
  const [editName, setEditName] = useState(false);
  const [nameInput, setNameInput] = useState(currentUserName);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showTravelStylePicker, setShowTravelStylePicker] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);

  const EMOJI_OPTIONS = [
    "😎","🤩","🥳","🤓","😄","😏","🤑","🥸",
    "👻","🤖","👽","🦸","🧙","🦊","🐱","🐶",
    "🦁","🐼","🦋","🌈","⚡","🔥","💫","🎮",
  ];

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const handleSaveName = () => {
    if (nameInput.trim().length < 1) return;
    setCurrentUserName(nameInput.trim());
    setEditName(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handlePickAvatarPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setCurrentUserAvatar(result.assets[0].uri);
      setShowAvatarPicker(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };



  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 40 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={["#0F2040", "#1E3A5F", "#4A90D9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBanner}
      >
        <View style={[styles.header, { paddingTop: topPad + 16 }]}>
          <Text style={[styles.title, { color: "#FFFFFF" }]}>Profile</Text>
        </View>

        <View style={styles.profileSection}>
          <Pressable
            style={({ pressed }) => [styles.avatarWrap, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => setShowAvatarPicker(true)}
          >
            <Avatar name={currentUserName} size={96} avatar={currentUserAvatar || undefined} />
            <View style={[styles.avatarBadge, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
              <Feather name="camera" size={13} color="#fff" />
            </View>
          </Pressable>

          {editName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={[
                  styles.nameInput,
                  {
                    color: "#FFFFFF",
                    borderColor: "rgba(255,255,255,0.4)",
                    backgroundColor: "rgba(255,255,255,0.15)",
                  },
                ]}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                onSubmitEditing={handleSaveName}
              />
              <Pressable
                style={[styles.saveBtn, { backgroundColor: "rgba(255,255,255,0.25)" }]}
                onPress={handleSaveName}
              >
                <Feather name="check" size={18} color="#fff" />
              </Pressable>
              <Pressable
                style={[styles.cancelBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
                onPress={() => {
                  setEditName(false);
                  setNameInput(currentUserName);
                }}
              >
                <Feather name="x" size={18} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.nameRow}
              onPress={() => {
                setNameInput(currentUserName);
                setEditName(true);
              }}
            >
              <Text style={[styles.userName, { color: "#FFFFFF" }]}>
                {currentUserName}
              </Text>
              <Feather name="edit-2" size={16} color="rgba(255,255,255,0.7)" />
            </Pressable>
          )}
          {userEmail ? (
            <Text style={[styles.userSubtitle, { color: "rgba(255,255,255,0.75)" }]}>
              {userEmail}
            </Text>
          ) : null}
          <Text style={[styles.userSubtitle, { color: "rgba(255,255,255,0.6)" }]}>
            Tap name to edit
          </Text>
        </View>
      </LinearGradient>

      {/* Travel Style Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          TRAVEL STYLE
        </Text>
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={() => {
              setShowTravelStylePicker(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                <Text style={{ fontSize: 16 }}>
                  {TRAVEL_STYLES.find((s) => s.label === currentUserTravelStyle)?.emoji ?? "✈️"}
                </Text>
              </View>
              <Text style={[styles.menuLabel, { color: currentUserTravelStyle ? colors.foreground : colors.mutedForeground }]}>
                {currentUserTravelStyle || "Select travel style"}
              </Text>
            </View>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>


      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          APP
        </Text>
        <View
          style={[
            styles.menuCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {/* Dark mode toggle */}
          <View
            style={[
              styles.menuItem,
              { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                <Feather
                  name={themeMode === "dark" ? "moon" : "sun"}
                  size={16}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>
                Dark Mode
              </Text>
            </View>
            <Switch
              value={themeMode === "dark"}
              onValueChange={(val) => {
                setThemeMode(val ? "dark" : "light");
                Haptics.selectionAsync();
              }}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>

          {[
            { icon: "info", label: "About Qontri", url: "https://qontri.in/" },
            { icon: "star", label: "Rate the App", url: null },
          ].map((item, idx, arr) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [
                styles.menuItem,
                {
                  opacity: pressed ? 0.7 : 1,
                  borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (item.url) Linking.openURL(item.url);
              }}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name={item.icon as any} size={16} color={colors.primary} />
                </View>
                <Text style={[styles.menuLabel, { color: colors.foreground }]}>
                  {item.label}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          SUPPORT
        </Text>
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              { borderBottomWidth: 1, borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Linking.openURL("tel:+918905475048");
            }}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="phone" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>Call Support</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Linking.openURL("https://wa.me/918905475048");
            }}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "#E8F8EF" }]}>
                <Feather name="message-circle" size={16} color="#25D366" />
              </View>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>WhatsApp Support</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {/* Legal Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          LEGAL
        </Text>
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { icon: "shield", label: "Privacy Policy", url: "https://qontri.in/privacy" },
            { icon: "file-text", label: "Terms of Service", url: "https://qontri.in/terms" },
          ].map((item, idx, arr) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [
                styles.menuItem,
                {
                  opacity: pressed ? 0.7 : 1,
                  borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Linking.openURL(item.url);
              }}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name={item.icon as any} size={16} color={colors.primary} />
                </View>
                <Text style={[styles.menuLabel, { color: colors.foreground }]}>
                  {item.label}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.signOutBtn,
          { borderColor: "#EF4444", opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowSignOutConfirm(true);
        }}
      >
        <Feather name="log-out" size={16} color="#EF4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.deleteAccountBtn,
          { opacity: pressed ? 0.7 : 1, backgroundColor: colors.negativeSurface, borderColor: colors.negativeBorder },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowDeleteAccountConfirm(true);
        }}
      >
        <Feather name="trash-2" size={16} color="#EF4444" />
        <Text style={styles.deleteAccountText}>Delete Account</Text>
      </Pressable>

      <View style={[styles.versionWrap]}>
        <Text style={[styles.versionText, { color: colors.mutedForeground }]}>
          Qontri v1.0.0
        </Text>
      </View>
    </ScrollView>

    <ConfirmModal
      visible={showSignOutConfirm}
      title="Sign Out"
      message="Are you sure you want to sign out?"
      confirmText="Sign Out"
      destructive
      onConfirm={async () => {
        setShowSignOutConfirm(false);
        await signOut();
        router.replace("/(auth)/sign-in");
      }}
      onCancel={() => setShowSignOutConfirm(false)}
    />

    <ConfirmModal
      visible={showDeleteAccountConfirm}
      title="Delete Account"
      message="This will permanently delete your account and all your data. This action cannot be undone."
      confirmText="Delete Account"
      destructive
      onConfirm={() => {
        setShowDeleteAccountConfirm(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Linking.openURL("https://qontri.in/delete-account");
      }}
      onCancel={() => setShowDeleteAccountConfirm(false)}
    />

    {/* Travel Style Picker Modal */}
    <Modal
      visible={showTravelStylePicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowTravelStylePicker(false)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setShowTravelStylePicker(false)} />
      <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>Travel Style</Text>
        {TRAVEL_STYLES.map((s) => {
          const selected = currentUserTravelStyle === s.label;
          return (
            <Pressable
              key={s.label}
              style={({ pressed }) => [
                styles.tsPickerRow,
                {
                  backgroundColor: selected ? colors.primary + "18" : "transparent",
                  borderBottomColor: colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              onPress={() => {
                setCurrentUserTravelStyle(s.label);
                Haptics.selectionAsync();
                setShowTravelStylePicker(false);
              }}
            >
              <Text style={styles.tsPickerEmoji}>{s.emoji}</Text>
              <Text style={[styles.tsPickerLabel, { color: colors.foreground }]}>{s.label}</Text>
              {selected && <Feather name="check" size={18} color={colors.primary} style={{ marginLeft: "auto" }} />}
            </Pressable>
          );
        })}
      </View>
    </Modal>

    {/* Avatar Picker Modal */}
    <Modal
      visible={showAvatarPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAvatarPicker(false)}
    >
      <Pressable
        style={styles.modalBackdrop}
        onPress={() => setShowAvatarPicker(false)}
      />
      <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>Choose your avatar</Text>

        {/* Photo options */}
        <Pressable
          style={[styles.photoUploadBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handlePickAvatarPhoto}
        >
          <View style={[styles.photoUploadIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="image" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.photoUploadTitle, { color: colors.foreground }]}>Upload a photo</Text>
            <Text style={[styles.photoUploadSub, { color: colors.mutedForeground }]}>Choose from your gallery</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>

        <Text style={[styles.emojiSectionLabel, { color: colors.mutedForeground }]}>OR PICK AN ICON</Text>

        <View style={styles.emojiGrid}>
          {EMOJI_OPTIONS.map((emoji) => {
            const isSelected = currentUserAvatar === emoji;
            return (
              <Pressable
                key={emoji}
                style={[
                  styles.emojiOption,
                  { backgroundColor: isSelected ? colors.primary + "22" : colors.card },
                  isSelected && { borderColor: colors.primary, borderWidth: 2 },
                ]}
                onPress={() => {
                  setCurrentUserAvatar(emoji);
                  setShowAvatarPicker(false);
                  Haptics.selectionAsync();
                }}
              >
                <Text style={styles.emojiOptionText}>{emoji}</Text>
                {isSelected && (
                  <View style={[styles.emojiCheck, { backgroundColor: colors.primary }]}>
                    <Feather name="check" size={9} color="#fff" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {currentUserAvatar ? (
          <Pressable
            style={styles.removeAvatarBtn}
            onPress={() => {
              setCurrentUserAvatar("");
              setShowAvatarPicker(false);
            }}
          >
            <Text style={{ color: "#EF4444", fontFamily: "Inter_500Medium", fontSize: 14 }}>
              Remove avatar
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroBanner: {
    paddingBottom: 10,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 6,
  },
  avatarWrap: {
    position: "relative",
    marginBottom: 4,
  },
  avatarBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  userSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  nameEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  menuCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  versionWrap: {
    alignItems: "center",
    paddingBottom: 16,
  },
  versionText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  signOutText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#EF4444",
  },
  deleteAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  deleteAccountText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#EF4444",
  },
  tsPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tsPickerEmoji: {
    fontSize: 22,
    width: 28,
    textAlign: "center",
  },
  tsPickerLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginBottom: 16,
  },
  photoUploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  photoUploadIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  photoUploadTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  photoUploadSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  emojiSectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  emojiOption: {
    width: "18%",
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  emojiOptionText: {
    fontSize: 28,
  },
  emojiCheck: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  removeAvatarBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
});
