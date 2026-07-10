import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AmountText } from "@/components/AmountText";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

interface QRGroupData {
  q: string;
  tag: string;
}

export default function GroupsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { groups, getMemberBalance, currentUserId, joinGroup, refreshGroups } = useApp();

  useFocusEffect(
    useCallback(() => {
      void refreshGroups();
    }, [refreshGroups])
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshGroups();
    setRefreshing(false);
  }, [refreshGroups]);

  const [search, setSearch] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [scanProcessed, setScanProcessed] = useState(false);
  const [pendingJoinTag, setPendingJoinTag] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const handleOpenScanner = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          "Camera Permission",
          "Camera access is needed to scan QR codes. Please enable it in your device settings."
        );
        return;
      }
    }
    setScanProcessed(false);
    setShowScanner(true);
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanProcessed) return;
    setScanProcessed(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const parsed = JSON.parse(data) as QRGroupData;
      if (parsed.q !== "qontri" || !parsed.tag) {
        setScanProcessed(false);
        return;
      }
      setJoinError(null);
      setPendingJoinTag(parsed.tag);
    } catch {
      setScanProcessed(false);
    }
  };

  const handleConfirmJoin = async () => {
    if (!pendingJoinTag || isJoining) return;
    setIsJoining(true);
    setJoinError(null);
    try {
      const group = await joinGroup(pendingJoinTag);
      if (group) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPendingJoinTag(null);
        setIsJoining(false);
        setShowScanner(false);
        setScanProcessed(false);
        router.push(`/group/${group.id}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Group not found. Check the tag.";
      setJoinError(msg);
      setIsJoining(false);
    }
  };

  const handleCancelJoin = () => {
    setPendingJoinTag(null);
    setJoinError(null);
    setScanProcessed(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 16, backgroundColor: colors.background },
        ]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              My Qontri's
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
              onPress={handleOpenScanner}
            >
              <Feather name="maximize" size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              style={[styles.newBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/group/new");
              }}
            >
              <Feather name="plus" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search groups..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="never"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad + 100, flexGrow: 1 },
        ]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { borderColor: colors.primary }]}>
              <Feather name="users" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No groups yet
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: colors.mutedForeground }]}
            >
              Create a group to start splitting expenses with friends
            </Text>
            <View style={styles.emptyActions}>
              <Pressable
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/group/new")}
              >
                <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>
                  Create group
                </Text>
              </Pressable>
              <Pressable
                style={[styles.emptyBtnOutline, { borderColor: colors.primary }]}
                onPress={handleOpenScanner}
              >
                <Feather name="maximize" size={16} color={colors.primary} />
                <Text style={[styles.emptyBtnOutlineText, { color: colors.primary }]}>
                  Scan to join
                </Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item: group }) => {
          const balance = getMemberBalance(group.id, currentUserId);
          return (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                {
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                  overflow: "hidden",
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/group/${group.id}`);
              }}
            >
              <LinearGradient
                colors={colors.isDark ? ["#0D1F3C", "#0A2240"] : ["#FFFFFF", "#EFF6FF"]}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.emoji,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Text style={{ fontSize: 22 }}>{group.emoji}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text
                    style={[styles.groupName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {group.name}
                  </Text>
                  <Text style={[styles.memberCount, { color: colors.mutedForeground }]}>
                    {group.members.length}{" "}
                    {group.members.length === 1 ? "member" : "members"}
                  </Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <View style={styles.balanceInfo}>
                  {balance > 0.01 ? (
                    <>
                      <Text
                        style={[styles.balanceLabel, { color: colors.positive }]}
                      >
                        you get back
                      </Text>
                      <AmountText amount={balance} positive size="sm" />
                    </>
                  ) : balance < -0.01 ? (
                    <>
                      <Text
                        style={[styles.balanceLabel, { color: colors.negative }]}
                      >
                        you owe
                      </Text>
                      <AmountText amount={balance} negative size="sm" />
                    </>
                  ) : (
                    <Text
                      style={[styles.settledText, { color: colors.mutedForeground }]}
                    >
                      settled up
                    </Text>
                  )}
                </View>
                <Feather
                  name="chevron-right"
                  size={16}
                  color={colors.mutedForeground}
                />
              </View>
            </Pressable>
          );
        }}
      />

      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => {
          if (pendingJoinTag) { handleCancelJoin(); } else { setShowScanner(false); }
        }}
      >
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Pressable
              style={styles.scannerClose}
              onPress={() => {
                if (pendingJoinTag) { handleCancelJoin(); } else { setShowScanner(false); setScanProcessed(false); }
              }}
            >
              <Feather name="x" size={24} color="#fff" />
            </Pressable>
            <Text style={styles.scannerTitle}>
              {pendingJoinTag ? "Join Group?" : "Scan Group QR"}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {Platform.OS !== "web" ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={scanProcessed ? undefined : handleBarCodeScanned}
            />
          ) : (
            <View style={styles.webScanFallback}>
              <Feather name="maximize" size={60} color="rgba(255,255,255,0.4)" />
              <Text style={styles.webScanText}>
                Camera scanning is available on the mobile app.{"\n"}
                Ask the group creator to share their code instead.
              </Text>
            </View>
          )}

          {!pendingJoinTag && (
            <View style={styles.scannerOverlay}>
              <View style={styles.scanFrame}>
                <View style={[styles.scanCorner, styles.scanCornerTL]} />
                <View style={[styles.scanCorner, styles.scanCornerTR]} />
                <View style={[styles.scanCorner, styles.scanCornerBL]} />
                <View style={[styles.scanCorner, styles.scanCornerBR]} />
              </View>
              <Text style={styles.scanHint}>
                Point camera at a Qontri group QR code
              </Text>
            </View>
          )}

          {/* Inline confirmation shown after QR detected — no Alert.alert needed */}
          {pendingJoinTag && (
            <View style={styles.joinConfirmOverlay}>
              <View style={styles.joinConfirmCard}>
                <View style={styles.joinConfirmIcon}>
                  <Feather name="users" size={28} color="#1E3A5F" />
                </View>
                <Text style={styles.joinConfirmTag}>{pendingJoinTag}</Text>
                <Text style={styles.joinConfirmSubtitle}>
                  You'll be added as a member of this group.
                </Text>
                {joinError ? (
                  <Text style={styles.joinConfirmError}>{joinError}</Text>
                ) : null}
                <Pressable
                  style={[styles.joinConfirmBtn, isJoining && styles.joinConfirmBtnLoading]}
                  onPress={() => { void handleConfirmJoin(); }}
                  disabled={isJoining}
                >
                  {isJoining ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.joinConfirmBtnText}>Join Group</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.joinConfirmCancel}
                  onPress={handleCancelJoin}
                  disabled={isJoining}
                >
                  <Text style={styles.joinConfirmCancelText}>
                    {joinError ? "Scan Again" : "Cancel"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 2,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  newBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  emoji: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: { flex: 1 },
  groupName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 3,
  },
  memberCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  cardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  balanceInfo: {
    alignItems: "flex-end",
    gap: 2,
  },
  balanceLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  settledText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  emptyActions: {
    marginTop: 16,
    flexDirection: "column",
    gap: 12,
    alignSelf: "stretch",
  },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
  },
  emptyBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  emptyBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  emptyBtnOutlineText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  scannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 10,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  scannerClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scannerTitle: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  scanFrame: {
    width: 240,
    height: 240,
    position: "relative",
  },
  scanCorner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#fff",
  },
  scanCornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  scanCornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  scanCornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  scanCornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  scanHint: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  webScanFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 40,
  },
  webScanText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  joinConfirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 40,
    paddingHorizontal: 20,
    zIndex: 20,
  },
  joinConfirmCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
  },
  joinConfirmIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  joinConfirmTag: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#1E3A5F",
    marginBottom: 6,
  },
  joinConfirmSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  joinConfirmError: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 12,
  },
  joinConfirmBtn: {
    width: "100%",
    backgroundColor: "#1E3A5F",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    minHeight: 52,
  },
  joinConfirmBtnLoading: {
    opacity: 0.7,
  },
  joinConfirmBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  joinConfirmCancel: {
    paddingVertical: 10,
  },
  joinConfirmCancelText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#6B7280",
  },
});
