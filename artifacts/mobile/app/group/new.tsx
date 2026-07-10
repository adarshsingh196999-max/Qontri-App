import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const EMOJIS = [
  "🏖️", "🏔️", "🏠", "🎉", "🍕", "✈️", "🏋️", "🎮",
  "🎵", "📚", "🍻", "🌍", "🏕️", "🚗", "🎂", "💼",
];

export default function NewGroupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { createGroup } = useApp();

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎉");
  const [description, setDescription] = useState("");

  const [inviteModal, setInviteModal] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState("");
  const [createdGroupName, setCreatedGroupName] = useState("");
  const [createdTag, setCreatedTag] = useState("");
  const [creating, setCreating] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const qrData = createdTag ? JSON.stringify({ q: "qontri", tag: createdTag }) : "";
  const inviteLink = createdTag ? `https://qontri.app/join/${createdTag.replace("#", "")}` : "";
  const whatsappMessage = `Hey! I've created a group "${createdGroupName}" on Qontri to split expenses. Tag: ${createdTag} — Join using the Qontri app.`;

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const group = await createGroup(name.trim(), emoji, description.trim() || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCreatedGroupId(group.id);
      setCreatedGroupName(group.name);
      setCreatedTag(group.tagNumber ?? "");
      setInviteModal(true);
    } catch {
      // Group creation failed — stay on screen
    } finally {
      setCreating(false);
    }
  };

  const openWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
    Linking.openURL(url);
  };

  const shareInvite = () => {
    Share.share({ message: whatsappMessage, url: inviteLink });
  };

  const handleDone = () => {
    setInviteModal(false);
    router.replace(`/group/${createdGroupId}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.navBar,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>
          New Group
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.emojiSection}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            CHOOSE AN ICON
          </Text>
          <View style={styles.emojiGrid}>
            {EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => {
                  setEmoji(e);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.emojiOption,
                  {
                    backgroundColor: emoji === e ? colors.primary : colors.muted,
                    borderColor: emoji === e ? colors.primary : "transparent",
                  },
                ]}
              >
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            Group Name *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            placeholder="e.g. Goa Trip, Apartment..."
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            Description (optional)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            placeholder="What's this group for?"
            placeholderTextColor={colors.mutedForeground}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.createBtn,
            {
              backgroundColor: name.trim() ? colors.primary : colors.muted,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          onPress={handleCreate}
          disabled={!name.trim() || creating}
        >
          <Text
            style={[
              styles.createBtnText,
              {
                color: name.trim() && !creating ? colors.primaryForeground : colors.mutedForeground,
              },
            ]}
          >
            {creating ? "Creating..." : "Create Group"}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Invite modal */}
      <Modal
        visible={inviteModal}
        transparent
        animationType="slide"
        onRequestClose={handleDone}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />

            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {emoji} {createdGroupName}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Share this to invite members
            </Text>

            <View style={[styles.qrContainer, { backgroundColor: "#fff" }]}>
              {qrData ? (
                <QRCode
                  value={qrData}
                  size={180}
                  color="#1E3A5F"
                  backgroundColor="#fff"
                />
              ) : null}
            </View>

            <Text
              style={[styles.inviteUrl, { color: colors.mutedForeground, backgroundColor: colors.muted }]}
              numberOfLines={1}
            >
              {inviteLink}
            </Text>

            <View style={styles.shareRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.whatsappBtn,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={openWhatsApp}
              >
                <Text style={styles.whatsappIcon}>💬</Text>
                <Text style={styles.whatsappText}>WhatsApp</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.shareBtn,
                  { backgroundColor: colors.secondary, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={shareInvite}
              >
                <Feather name="share-2" size={18} color={colors.primary} />
                <Text style={[styles.shareBtnText, { color: colors.primary }]}>
                  Share
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.doneBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleDone}
            >
              <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>
                Go to Group
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  navTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  content: { padding: 20, gap: 20 },
  emojiSection: { gap: 10 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emojiOption: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  fieldGroup: { gap: 8 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  createBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  createBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    alignItems: "center",
    gap: 16,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: -8,
  },
  qrContainer: {
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  inviteUrl: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "stretch",
    textAlign: "center",
  },
  shareRow: {
    flexDirection: "row",
    gap: 12,
    alignSelf: "stretch",
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#25D366",
    borderRadius: 14,
    paddingVertical: 14,
  },
  whatsappIcon: { fontSize: 18 },
  whatsappText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  shareBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  doneBtn: {
    alignSelf: "stretch",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
