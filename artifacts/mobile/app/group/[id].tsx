import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  RefreshControl,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AmountText } from "@/components/AmountText";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Avatar } from "@/components/Avatar";
import { CategoryBadge } from "@/components/CategoryBadge";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { ROLE_META } from "@/utils/groupInsights";

const EMOJIS = [
  "🏖️", "🏔️", "🏠", "🎉", "🍕", "✈️", "🏋️", "🎮",
  "🎵", "📚", "🍻", "🌍", "🏕️", "🚗", "🎂", "💼",
];

const EMOJI_IMAGES: Record<string, string> = {
  "🏖️": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80&fit=crop",
  "🏔️": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80&fit=crop",
  "🏠": "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80&fit=crop",
  "🎉": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80&fit=crop",
  "🍕": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80&fit=crop",
  "✈️": "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80&fit=crop",
  "🏋️": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80&fit=crop",
  "🎮": "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&q=80&fit=crop",
  "🎵": "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=600&q=80&fit=crop",
  "📚": "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&q=80&fit=crop",
  "🍻": "https://images.unsplash.com/photo-1555658636-6e4a36218be7?w=600&q=80&fit=crop",
  "🌍": "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80&fit=crop",
  "🏕️": "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80&fit=crop",
  "🚗": "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&q=80&fit=crop",
  "🎂": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80&fit=crop",
  "💼": "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&q=80&fit=crop",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

type Tab = "overview" | "activity" | "vibes";

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function GroupDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    groups,
    activities,
    getGroupExpenses,
    getGroupSettlements,
    getSimplifiedDebts,
    getGroupBalances,
    deleteGroup,
    deleteExpense,
    updateGroup,
    removeMember,
    currentUserId,
    computeGroupInsights,
    getGroupBanter,
    refreshGroups,
  } = useApp();

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

  const [tab, setTab] = useState<Tab>("overview");
  const [showSimplified, setShowSimplified] = useState(true);

  const [showQRModal, setShowQRModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [unreadActivity, setUnreadActivity] = useState(0);
  const lastSeenRef = useRef<string | null>(null);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expenseActionTarget, setExpenseActionTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<{ id: string; title: string } | null>(null);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<{ id: string; name: string } | null>(null);

  const group = groups.find((g) => g.id === id);
  const expenses = getGroupExpenses(id ?? "");
  const settlements = getGroupSettlements(id ?? "");
  const debts = getSimplifiedDebts(id ?? "");
  const rawDebts = getGroupBalances(id ?? "");

  const LAST_SEEN_KEY = `activity_lastseen_${id}`;

  useEffect(() => {
    AsyncStorage.getItem(LAST_SEEN_KEY).then((ts) => {
      lastSeenRef.current = ts;
      const groupActivities = activities.filter((a) => a.groupId === id);
      const count = [
        ...expenses.map((e) => e.date),
        ...settlements.map((s) => s.date),
        ...groupActivities.map((a) => a.date),
      ].filter((d) => !ts || new Date(d).getTime() > new Date(ts).getTime()).length;
      setUnreadActivity(count);
    });
  }, [activities, expenses, settlements]);

  // Auto-refresh if expense splits reference member IDs not in group.members
  // (handles stale client state where some members are missing)
  useEffect(() => {
    if (!group) return;
    const memberIds = new Set(group.members.map((m) => m.id));
    const hasStaleMembers = expenses.some(
      (e) => !memberIds.has(e.paidById) || e.splits.some((s) => !memberIds.has(s.memberId))
    );
    if (hasStaleMembers) {
      void refreshGroups();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id]);

  const markActivityRead = useCallback(() => {
    const now = new Date().toISOString();
    lastSeenRef.current = now;
    AsyncStorage.setItem(LAST_SEEN_KEY, now);
    setUnreadActivity(0);
  }, [LAST_SEEN_KEY]);
  const savedTransactions = rawDebts.length - debts.length;
  const displayedDebts = showSimplified ? debts : rawDebts;
  const insights = id ? computeGroupInsights(id) : [];
  const banter = id ? getGroupBanter(id) : [];

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  if (!group) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, padding: 20 }}>
          Group not found
        </Text>
      </View>
    );
  }

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

  const qrData = group.tagNumber
    ? JSON.stringify({ q: "qontri", tag: group.tagNumber })
    : "";

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowDeleteGroupConfirm(true);
  };

  const handleOpenEditGroup = () => {
    setEditName(group.name);
    setEditEmoji(group.emoji);
    setEditDescription(group.description ?? "");
    setShowEditGroup(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveEditGroup = () => {
    if (!editName.trim()) return;
    void updateGroup(group.id, {
      name: editName.trim(),
      emoji: editEmoji,
      description: editDescription.trim() || undefined,
    });
    setShowEditGroup(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const inviteTag = group.tagNumber ?? group.id;
  const inviteLink = `https://qontri.app/join/${inviteTag.replace("#", "")}`;
  const inviteText = `Hey! Join "${group.emoji} ${group.name}" on Qontri.\nGroup tag: ${inviteTag}\n\nDownload the Qontri app and scan the QR code or enter the tag to join.`;

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowShareSheet(true);
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(inviteText)}`);
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({ message: inviteText, title: `Join ${group.name} on Qontri` });
    } catch {
      handleCopyLink();
    }
  };

  const handleExpenseOptions = (expenseId: string, expenseTitle: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExpenseActionTarget({ id: expenseId, title: expenseTitle });
  };

  const resolveName = (memberId: string): string => {
    // 1. Check current group members (fast path)
    const found = group.members.find((m) => m.id === memberId);
    if (found) return found.name;
    // 2. Current user
    if (memberId === currentUserId) return "You";
    // 3. Cross-group lookup — handles stale group.members state
    for (const g of groups) {
      const crossMember = g.members.find((m) => m.id === memberId);
      if (crossMember) return crossMember.name;
    }
    // 4. Parse from user_* ID format, strip trailing digits
    if (memberId.startsWith("user_")) {
      const parts = memberId.slice(5).split("_");
      const nameParts = parts.length > 2 ? parts.slice(0, -2) : parts;
      const name = nameParts
        .map((p) => p.replace(/\d+$/, ""))
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
      if (name.trim()) return name;
    }
    return "Member";
  };
  const getMemberName = (memberId: string) => resolveName(memberId);
  const getMemberColor = (memberId: string) =>
    group.members.find((m) => m.id === memberId)?.color ?? "#6B7280";

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
        <View style={styles.navCenter}>
          <Text style={{ fontSize: 20 }}>{group.emoji}</Text>
          <Text style={[styles.navTitle, { color: colors.foreground }]}>
            {group.name}
          </Text>
        </View>
        <View style={styles.navActions}>
          <Pressable
            style={[styles.navIconBtn, { backgroundColor: colors.secondary }]}
            onPress={() => {
              setShowQRModal(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            style={[styles.navIconBtn, { backgroundColor: colors.secondary }]}
            onPress={handleOpenEditGroup}
          >
            <Feather name="edit-2" size={17} color={colors.primary} />
          </Pressable>
          <Pressable
            style={[styles.navIconBtn, { backgroundColor: colors.secondary }]}
            onPress={handleShare}
          >
            <Feather name="share-2" size={17} color={colors.primary} />
          </Pressable>
          <Pressable
            style={[styles.navIconBtn, { backgroundColor: "#FEF2F2" }]}
            onPress={handleDelete}
          >
            <Feather name="trash-2" size={17} color={colors.destructive} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.summaryCard}>
          {/* Destination photo — decorative, must not capture touches */}
          {EMOJI_IMAGES[group.emoji] && (
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <Image
                source={{ uri: EMOJI_IMAGES[group.emoji] }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            </View>
          )}
          {/* Gradient overlay — decorative, must not capture touches */}
          <LinearGradient
            colors={
              colors.isDark
                ? ["rgba(4,12,30,0.88)", "rgba(15,32,64,0.78)", "rgba(37,99,235,0.65)"]
                : ["rgba(10,22,50,0.86)", "rgba(20,44,90,0.76)", "rgba(37,99,235,0.62)"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* Content */}
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Total Spent</Text>
              <AmountText
                amount={totalSpent}
                size="xl"
                style={{ color: "#FFFFFF" }}
              />
            </View>
            <View style={styles.memberAvatars}>
              {group.members.slice(0, 4).map((m, idx) => (
                <View
                  key={m.id}
                  style={[styles.avatarOverlap, { marginLeft: idx === 0 ? 0 : -10 }]}
                >
                  <Avatar name={m.name} color={m.color} size={32} avatar={m.avatar} />
                </View>
              ))}
              {group.members.length > 4 && (
                <View
                  style={[
                    styles.avatarOverlap,
                    styles.moreAvatar,
                    { marginLeft: -10, backgroundColor: "rgba(255,255,255,0.3)" },
                  ]}
                >
                  <Text style={styles.moreAvatarText}>
                    +{group.members.length - 4}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.summaryMetaRow}>
            <Text style={styles.summaryMeta}>
              {expenses.length} expense{expenses.length !== 1 ? "s" : ""} ·{" "}
              {group.members.length} members
            </Text>
            <View style={styles.summaryMetaRight}>
              {group.tagNumber ? (
                <View style={styles.tripTagPill}>
                  <Feather name="hash" size={10} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.tripTagText}>
                    Trip {group.tagNumber.replace("#", "")}
                  </Text>
                </View>
              ) : null}
              <Pressable
                style={styles.viewMembersHint}
                onPress={() => {
                  setShowMembersModal(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Ionicons name="people-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.viewMembersHintText}>View</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.tabs}>
          {([
            { key: "overview", label: "Overview" },
            { key: "activity", label: "Activity" },
            { key: "vibes",    label: "📊 Insights" },
          ] as { key: Tab; label: string }[]).map(({ key: t, label }) => {
            const showDot = (t === "vibes" && tab !== "vibes" && insights.length > 0)
              || (t === "activity" && tab !== "activity" && unreadActivity > 0);
            return (
              <Pressable
                key={t}
                style={[
                  styles.tabBtn,
                  {
                    backgroundColor: tab === t ? colors.primary : colors.muted,
                    borderColor:     tab === t ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  setTab(t);
                  if (t === "activity") markActivityRead();
                  Haptics.selectionAsync();
                }}
              >
                <View style={styles.tabInner}>
                  <Text
                    style={[
                      styles.tabText,
                      { color: tab === t ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {label}
                  </Text>
                  {showDot && (
                    <View style={[styles.tabDot, { backgroundColor: "#F59E0B" }]} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {tab === "overview" && (
          <View style={styles.section}>
            {/* ── Balances (always shown at top of overview) ── */}
            {debts.length === 0 ? (
              <View
                style={[
                  styles.settledBanner,
                  { backgroundColor: colors.secondary, borderColor: colors.accent },
                ]}
              >
                <Feather name="check-circle" size={28} color={colors.primary} />
                <Text style={[styles.settledTitle, { color: colors.primary }]}>
                  All settled up!
                </Text>
                <Text style={[styles.settledSubtitle, { color: colors.mutedForeground }]}>
                  No outstanding balances in this group
                </Text>
              </View>
            ) : (
              <>
                {savedTransactions > 0 && (
                  <View style={[styles.simplifyBanner, { backgroundColor: colors.isDark ? "#0D1F3C" : "#EFF6FF", borderColor: colors.accent }]}>
                    <View style={styles.simplifyBannerTop}>
                      <View style={styles.simplifyBannerLeft}>
                        <Text style={styles.simplifyBannerEmoji}>✨</Text>
                        <View>
                          <Text style={[styles.simplifyBannerTitle, { color: colors.primary }]}>
                            Debts Simplified
                          </Text>
                          <Text style={[styles.simplifyBannerSub, { color: colors.mutedForeground }]}>
                            {rawDebts.length} debts → {debts.length} {debts.length === 1 ? "transaction" : "transactions"} · saved {savedTransactions} {savedTransactions === 1 ? "payment" : "payments"}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.simplifyToggle, { backgroundColor: colors.isDark ? "#1E3A5F" : "#DBEAFE" }]}>
                      <Pressable
                        style={[styles.simplifyToggleBtn, showSimplified && { backgroundColor: colors.primary }]}
                        onPress={() => { setShowSimplified(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      >
                        <Text style={[styles.simplifyToggleBtnText, { color: showSimplified ? "#fff" : colors.mutedForeground }]}>Simplified</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.simplifyToggleBtn, !showSimplified && { backgroundColor: colors.primary }]}
                        onPress={() => { setShowSimplified(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      >
                        <Text style={[styles.simplifyToggleBtnText, { color: !showSimplified ? "#fff" : colors.mutedForeground }]}>All Debts</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
                <Text style={[styles.balancesHeader, { color: colors.mutedForeground }]}>
                  {showSimplified ? "OPTIMISED SETTLEMENT PLAN" : "ALL INDIVIDUAL DEBTS"}
                </Text>
                {displayedDebts.filter((d) => Math.round(d.amount) >= 1).map((debt, idx) => {
                  const isYouOwe = debt.fromId === currentUserId;
                  const isOwedToYou = debt.toId === currentUserId;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.debtCard,
                        {
                          backgroundColor: isYouOwe ? colors.negativeSurface : isOwedToYou ? colors.positiveSurface : colors.card,
                          borderColor: isYouOwe ? colors.negativeBorder : isOwedToYou ? colors.positiveBorder : colors.border,
                        },
                      ]}
                    >
                      <Avatar name={getMemberName(debt.fromId)} color={getMemberColor(debt.fromId)} size={36} />
                      <View style={styles.debtMiddle}>
                        <Text style={[styles.debtFrom, { color: colors.foreground }]}>
                          {debt.fromId === currentUserId ? "You" : getMemberName(debt.fromId)}
                        </Text>
                        <View style={styles.debtArrow}>
                          <View style={[styles.debtLine, { backgroundColor: isYouOwe ? colors.negative : isOwedToYou ? colors.positive : colors.border }]} />
                          <Feather name="arrow-right" size={14} color={isYouOwe ? colors.negative : isOwedToYou ? colors.positive : colors.mutedForeground} />
                        </View>
                        <Text style={[styles.debtTo, { color: colors.foreground }]}>
                          {debt.toId === currentUserId ? "You" : getMemberName(debt.toId)}
                        </Text>
                      </View>
                      <View style={styles.debtRight}>
                        <AmountText amount={debt.amount} positive={isOwedToYou} negative={isYouOwe} size="md" />
                        {showSimplified && (
                          <Pressable
                            style={[styles.settleBtn, { backgroundColor: colors.primary }]}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              router.push({ pathname: "/group/settle", params: { groupId: group.id, fromId: debt.fromId, toId: debt.toId, amount: String(debt.amount) } });
                            }}
                          >
                            <Text style={styles.settleBtnText}>Settle</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
                {!showSimplified && (
                  <Pressable
                    style={[styles.switchToSimplifiedBtn, { backgroundColor: colors.primary }]}
                    onPress={() => { setShowSimplified(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                  >
                    <Feather name="zap" size={15} color="#fff" />
                    <Text style={styles.switchToSimplifiedText}>Switch to Simplified Plan</Text>
                  </Pressable>
                )}
              </>
            )}

            {/* ── Expenses ── */}
            <Text style={[styles.balancesHeader, { color: colors.mutedForeground, marginTop: 20 }]}>
              EXPENSES
            </Text>
            {expenses.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="dollar-sign" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  No expenses yet
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  Tap the + button to add your first expense
                </Text>
              </View>
            ) : (
              expenses.map((expense) => {
                const payer = group.members.find(
                  (m) => m.id === expense.paidById
                );
                const mySplit = expense.splits.find(
                  (s) => s.memberId === currentUserId
                );
                return (
                  <Pressable
                    key={expense.id}
                    style={({ pressed }) => [
                      styles.expenseCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleExpenseOptions(expense.id, expense.title);
                    }}
                    onLongPress={() => handleExpenseOptions(expense.id, expense.title)}
                  >
                    <View style={styles.expenseLeft}>
                      <CategoryBadge category={expense.category} />
                      <View style={styles.expenseInfo}>
                        <Text
                          style={[
                            styles.expenseTitle,
                            { color: colors.foreground },
                          ]}
                          numberOfLines={1}
                        >
                          {expense.title}
                        </Text>
                        <Text
                          style={[
                            styles.expenseMeta,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {payer?.id === currentUserId
                            ? "You paid"
                            : `${payer?.name} paid`}{" "}
                          · {formatDate(expense.date)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.expenseRight}>
                      <AmountText amount={expense.amount} size="md" />
                      {mySplit && (
                        <Text
                          style={[
                            styles.expenseShare,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          Your share: ₹{Math.round(mySplit.amount).toLocaleString("en-IN")}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        )}


        {tab === "activity" && (() => {
          const groupActivities = activities.filter((a) => a.groupId === id);
          const lastSeen = lastSeenRef.current;
          const isNew = (date: string) =>
            !lastSeen || new Date(date).getTime() > new Date(lastSeen).getTime();

          type FeedItem =
            | { kind: "expense"; id: string; date: string; title: string; amount: number; paidBy: string; isNew: boolean }
            | { kind: "settlement"; id: string; date: string; from: string; to: string; amount: number; mode: string; isNew: boolean }
            | { kind: "log"; id: string; date: string; label: string; meta: string; isNew: boolean };

          const getMemberName = (mid: string) => resolveName(mid);

          const feed: FeedItem[] = [
            ...expenses.map((e) => ({
              kind: "expense" as const,
              id: e.id,
              date: e.date,
              title: e.title,
              amount: e.amount,
              paidBy: getMemberName(e.paidById),
              isNew: isNew(e.date),
            })),
            ...settlements.map((s) => ({
              kind: "settlement" as const,
              id: s.id,
              date: s.date,
              from: getMemberName(s.fromId),
              to: getMemberName(s.toId),
              amount: s.amount,
              mode: s.mode,
              isNew: isNew(s.date),
            })),
            ...groupActivities.map((a) => ({
              kind: "log" as const,
              id: a.id,
              date: a.date,
              label: a.label,
              meta: a.meta,
              isNew: isNew(a.date),
            })),
          ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          const getDateLabel = (dateStr: string) => {
            const d = new Date(dateStr);
            const diffDays = Math.floor((new Date().getTime() - d.getTime()) / 86400000);
            if (diffDays === 0) return "Today";
            if (diffDays === 1) return "Yesterday";
            return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: diffDays > 365 ? "numeric" : undefined });
          };

          let lastGroup = "";
          const feedNodes = feed.map((item, idx) => {
            const dayLabel = getDateLabel(item.date);
            const showGroup = dayLabel !== lastGroup;
            if (showGroup) lastGroup = dayLabel;
            const isLast = idx === feed.length - 1;

            const iconBg =
              item.kind === "expense" ? colors.secondary
              : item.kind === "settlement" ? "#DCFCE7"
              : colors.muted;
            const iconColor =
              item.kind === "expense" ? colors.primary
              : item.kind === "settlement" ? "#16a34a"
              : colors.mutedForeground;
            const iconName: "file-text" | "check-circle" | "edit-3" =
              item.kind === "expense" ? "file-text"
              : item.kind === "settlement" ? "check-circle"
              : "edit-3";
            const titleText =
              item.kind === "expense" ? item.title
              : item.kind === "settlement" ? `${item.from} paid ${item.to}`
              : item.label;
            const metaText =
              item.kind === "expense" ? `Paid by ${item.paidBy}`
              : item.kind === "settlement" ? item.mode.charAt(0).toUpperCase() + item.mode.slice(1)
              : item.meta;
            const amountText =
              item.kind !== "log" ? `\u20B9${item.amount.toLocaleString("en-IN")}` : null;
            const amountColor = item.kind === "settlement" ? "#16a34a" : colors.foreground;

            return (
              <View key={item.id}>
                {showGroup && (
                  <View style={styles.activityDateRow}>
                    <View style={[styles.activityDateLine, { backgroundColor: colors.border }]} />
                    <Text style={[styles.activityDateLabel, { color: colors.mutedForeground, backgroundColor: colors.background }]}>
                      {dayLabel}
                    </Text>
                    <View style={[styles.activityDateLine, { backgroundColor: colors.border }]} />
                  </View>
                )}
                <View style={styles.activityTimelineRow}>
                  <View style={styles.activityLeft}>
                    <View style={[styles.activityIcon, { backgroundColor: iconBg }]}>
                      <Feather name={iconName} size={15} color={iconColor} />
                    </View>
                    {!isLast && <View style={[styles.activityLine, { backgroundColor: colors.border }]} />}
                  </View>
                  <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: item.isNew ? colors.primary : colors.border }]}>
                    {item.isNew && (
                      <View style={[styles.activityNewPill, { backgroundColor: colors.primary }]}>
                        <Text style={styles.activityNewPillText}>NEW</Text>
                      </View>
                    )}
                    <View style={styles.activityCardTop}>
                      <Text style={[styles.activityLabel, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>
                        {titleText}
                      </Text>
                      {amountText && (
                        <Text style={[styles.activityAmount, { color: amountColor }]}>{amountText}</Text>
                      )}
                    </View>
                    <Text style={[styles.activityMeta, { color: colors.mutedForeground }]}>
                      {metaText} {"\u00B7"} {formatTimeAgo(item.date)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          });

          return (
            <View style={styles.section}>
              {feed.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="clock" size={36} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No activity yet</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                    Expenses and payments will appear here
                  </Text>
                </View>
              ) : feedNodes}
            </View>
          );
        })()}

        {tab === "vibes" && (
          <View style={styles.section}>
            <View style={[styles.vibesHeader, { backgroundColor: colors.isDark ? "#0D1F3C" : "#EFF6FF", borderColor: colors.accent }]}>
              <Text style={[styles.vibesHeaderTitle, { color: colors.primary }]}>
                📊 Group Insights
              </Text>
              <Text style={[styles.vibesHeaderSub, { color: colors.mutedForeground }]}>
                Based on expense patterns in this group
              </Text>
            </View>

            {insights.length === 0 ? (
              <View style={styles.vibesEmpty}>
                <Text style={{ fontSize: 40 }}>🌱</Text>
                <Text style={[styles.vibesEmptyText, { color: colors.mutedForeground }]}>
                  Add more expenses to unlock group insights and roles
                </Text>
              </View>
            ) : (
              insights.map((insight) => {
                const meta = ROLE_META[insight.role];
                if (!meta) return null;
                return (
                  <View
                    key={insight.memberId}
                    style={[
                      styles.roleCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <Avatar
                      name={insight.name}
                      color={insight.color}
                      size={44}
                    />
                    <View style={styles.roleCardInfo}>
                      <Text style={[styles.roleCardName, { color: colors.foreground }]}>
                        {insight.memberId === currentUserId ? "You" : insight.name}
                      </Text>
                      <Text style={[styles.roleCardDesc, { color: colors.mutedForeground }]}>
                        {meta.description}
                      </Text>
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: meta.bg }]}>
                      <Text style={styles.roleBadgeEmoji}>{meta.emoji}</Text>
                      <Text style={[styles.roleBadgeLabel, { color: meta.text }]}>
                        {insight.role}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            {banter.length > 0 && (
              <>
                <View style={[styles.banterHeader, { borderTopColor: colors.border }]}>
                  <Text style={[styles.vibesHeaderTitle, { color: colors.primary }]}>
                    💬 Group Chat
                  </Text>
                  <Text style={[styles.vibesHeaderSub, { color: colors.mutedForeground }]}>
                    AI commentary on your spending
                  </Text>
                </View>
                {banter.map((msg) => (
                  <View
                    key={msg.id}
                    style={[styles.banterMsg, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={[styles.banterEmojiWrap, { backgroundColor: colors.secondary }]}>
                      <Text style={styles.banterEmojiText}>{msg.emoji}</Text>
                    </View>
                    <View style={styles.banterContent}>
                      <Text style={[styles.banterText, { color: colors.foreground }]}>
                        {msg.message}
                      </Text>
                      <Text style={[styles.banterTime, { color: colors.mutedForeground }]}>
                        {formatTimeAgo(msg.createdAt)}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {banter.length === 0 && insights.length === 0 && (
              <View style={[styles.banterEmpty, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={{ fontSize: 32 }}>🤫</Text>
                <Text style={[styles.banterEmptyText, { color: colors.mutedForeground }]}>
                  No group commentary yet.{"\n"}Add some expenses and the group will start talking!
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {tab === "overview" && (
        <Pressable
          style={[styles.fab, { bottom: bottomPad + 24, backgroundColor: colors.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({
              pathname: "/group/add-expense",
              params: { groupId: group.id },
            });
          }}
        >
          <View style={styles.fabInner}>
            <Feather name="plus" size={20} color="#fff" />
            <Text style={styles.fabText}>Add Expense</Text>
          </View>
        </Pressable>
      )}

      {/* Members Modal */}
      <Modal
        visible={showMembersModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMembersModal(false)}
      >
        <Pressable style={styles.membersOverlay} onPress={() => setShowMembersModal(false)}>
          <Pressable
            style={[styles.membersSheet, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <View style={[styles.membersHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.membersTitle, { color: colors.foreground }]}>
              👥 Group Members
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {group.members.map((member) => (
                <View
                  key={member.id}
                  style={[styles.memberSheetRow, { borderBottomColor: colors.border }]}
                >
                  <Avatar name={member.name} color={member.color} size={42} avatar={member.avatar} />
                  <View style={styles.memberSheetInfo}>
                    <Text style={[styles.memberSheetName, { color: colors.foreground }]}>
                      {member.id === currentUserId ? `${member.name} (You)` : member.name}
                    </Text>
                    {member.travelStyle ? (
                      <View style={[styles.travelStyleBadge, { backgroundColor: colors.secondary }]}>
                        <Text style={[styles.travelStyleText, { color: colors.mutedForeground }]}>
                          {member.travelStyle}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.travelStyleNone, { color: colors.mutedForeground }]}>
                        No travel style set
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowQRModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowQRModal(false)}
        >
          <Pressable
            style={[styles.qrModalCard, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <View style={styles.qrModalHeader}>
              <Text style={{ fontSize: 28 }}>{group.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.qrModalTitle, { color: colors.foreground }]}>
                  {group.name}
                </Text>
                <Text style={[styles.qrModalSub, { color: colors.mutedForeground }]}>
                  {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                </Text>
              </View>
              <Pressable onPress={() => setShowQRModal(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <View style={[styles.qrWrapper, { backgroundColor: "#fff" }]}>
              <QRCode
                value={qrData}
                size={220}
                color="#1E3A5F"
                backgroundColor="#ffffff"
              />
            </View>

            <Text style={[styles.qrHint, { color: colors.mutedForeground }]}>
              Ask friends to scan this QR code in Qontri to join this group
            </Text>

            <View style={styles.qrActions}>
              <Pressable
                style={[styles.qrShareBtn, { backgroundColor: colors.primary }]}
                onPress={handleShare}
              >
                <Feather name="share-2" size={16} color="#fff" />
                <Text style={styles.qrShareBtnText}>Share Invite</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Group Modal */}
      <Modal
        visible={showEditGroup}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditGroup(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowEditGroup(false)}
        >
          <Pressable
            style={[styles.editModalCard, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <View style={styles.editModalHeader}>
              <Text style={[styles.editModalTitle, { color: colors.foreground }]}>
                Edit Group
              </Text>
              <Pressable onPress={() => setShowEditGroup(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Icon</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiScroll}
            >
              {EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  style={[
                    styles.emojiOption,
                    {
                      backgroundColor: editEmoji === e ? colors.primary : colors.muted,
                      borderColor: editEmoji === e ? colors.primary : "transparent",
                    },
                  ]}
                  onPress={() => {
                    setEditEmoji(e);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
              Group Name *
            </Text>
            <TextInput
              style={[
                styles.fieldInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="Group name"
              placeholderTextColor={colors.mutedForeground}
              value={editName}
              onChangeText={setEditName}
            />

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
              Description (optional)
            </Text>
            <TextInput
              style={[
                styles.fieldInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="What's this group for?"
              placeholderTextColor={colors.mutedForeground}
              value={editDescription}
              onChangeText={setEditDescription}
            />

            {group && group.members.filter(m => m.id !== currentUserId).length > 0 && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                  Members
                </Text>
                <View style={styles.editMemberList}>
                  {group.members.map((m) => {
                    if (m.id === currentUserId) return null;
                    const hasSplits = expenses.some(
                      (e) => e.paidById === m.id || e.splits.some((s) => s.memberId === m.id)
                    );
                    const hasSettles = settlements.some(
                      (s) => s.fromId === m.id || s.toId === m.id
                    );
                    const hasHistory = hasSplits || hasSettles;
                    return (
                      <View
                        key={m.id}
                        style={[
                          styles.editMemberRow,
                          { backgroundColor: colors.background, borderColor: colors.border },
                        ]}
                      >
                        <Avatar name={m.name} color={m.color} size={32} />
                        <Text style={[styles.editMemberName, { color: colors.foreground }]}>
                          {m.name}
                        </Text>
                        {hasHistory ? (
                          <View
                            style={[
                              styles.removeMemberBtn,
                              { backgroundColor: colors.muted, opacity: 0.6 },
                            ]}
                          >
                            <Feather name="lock" size={15} color={colors.mutedForeground} />
                          </View>
                        ) : (
                          <Pressable
                            style={[styles.removeMemberBtn, { backgroundColor: "#FEF2F2" }]}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              setRemoveMemberTarget({ id: m.id, name: m.name });
                            }}
                          >
                            <Feather name="user-minus" size={15} color={colors.destructive} />
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            <View style={styles.editModalActions}>
              <Pressable
                style={[styles.editCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowEditGroup(false)}
              >
                <Text style={[styles.editCancelText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.editSaveBtn,
                  { backgroundColor: editName.trim() ? colors.primary : colors.muted },
                ]}
                onPress={handleSaveEditGroup}
                disabled={!editName.trim()}
              >
                <Text
                  style={[
                    styles.editSaveText,
                    { color: editName.trim() ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  Save Changes
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete group */}
      <ConfirmModal
        visible={showDeleteGroupConfirm}
        title="Delete Group"
        message={`Delete "${group.name}"? All expenses will be removed.`}
        confirmText="Delete"
        destructive
        onConfirm={() => {
          setShowDeleteGroupConfirm(false);
          void deleteGroup(group.id);
          router.replace("/(tabs)");
        }}
        onCancel={() => setShowDeleteGroupConfirm(false)}
      />

      {/* Expense action sheet (long-press: edit or delete) */}
      <Modal
        visible={!!expenseActionTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setExpenseActionTarget(null)}
      >
        <Pressable style={styles.actionBackdrop} onPress={() => setExpenseActionTarget(null)}>
          <View style={[styles.actionSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.actionTitle, { color: colors.foreground }]} numberOfLines={1}>
              {expenseActionTarget?.title}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}
              onPress={() => {
                const target = expenseActionTarget;
                setExpenseActionTarget(null);
                if (target) {
                  router.push({ pathname: "/group/add-expense", params: { groupId: group.id, expenseId: target.id } });
                }
              }}
            >
              <Feather name="edit-2" size={18} color={colors.primary} />
              <Text style={[styles.actionRowText, { color: colors.foreground }]}>Edit expense</Text>
            </Pressable>
            <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}
              onPress={() => {
                const target = expenseActionTarget;
                setExpenseActionTarget(null);
                if (target) setDeleteExpenseTarget(target);
              }}
            >
              <Feather name="trash-2" size={18} color={colors.destructive} />
              <Text style={[styles.actionRowText, { color: colors.destructive }]}>Delete expense</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionCancelRow, pressed && { opacity: 0.6 }]}
              onPress={() => setExpenseActionTarget(null)}
            >
              <Text style={[styles.actionCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Delete expense confirm */}
      <ConfirmModal
        visible={!!deleteExpenseTarget}
        title="Delete Expense"
        message={`Remove "${deleteExpenseTarget?.title}"?`}
        confirmText="Delete"
        destructive
        onConfirm={() => {
          if (deleteExpenseTarget) void deleteExpense(deleteExpenseTarget.id);
          setDeleteExpenseTarget(null);
        }}
        onCancel={() => setDeleteExpenseTarget(null)}
      />

      {/* Remove member confirm */}
      <ConfirmModal
        visible={!!removeMemberTarget}
        title={`Remove ${removeMemberTarget?.name ?? "member"}?`}
        message="They will be removed from the group. Their expense history will remain intact."
        confirmText="Remove"
        destructive
        onConfirm={() => {
          if (removeMemberTarget) void removeMember(group.id, removeMemberTarget.id);
          setRemoveMemberTarget(null);
        }}
        onCancel={() => setRemoveMemberTarget(null)}
      />

      {/* Share / Invite sheet */}
      <Modal
        visible={showShareSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareSheet(false)}
      >
        <Pressable style={styles.shareOverlay} onPress={() => setShowShareSheet(false)}>
          <Pressable style={[styles.shareSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={styles.shareHandle} />

            <Text style={[styles.shareTitle, { color: colors.foreground }]}>
              Invite to {group.emoji} {group.name}
            </Text>

            <View style={[styles.shareLinkBox, { backgroundColor: colors.muted }]}>
              <Text style={[styles.shareLinkText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {inviteLink}
              </Text>
            </View>

            <View style={styles.shareActions}>
              {/* WhatsApp */}
              <Pressable
                style={({ pressed }) => [styles.shareActionBtn, styles.whatsappBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => { setShowShareSheet(false); handleWhatsApp(); }}
              >
                <Text style={styles.shareActionIcon}>💬</Text>
                <Text style={styles.whatsappBtnText}>WhatsApp</Text>
              </Pressable>

              {/* Copy link */}
              <Pressable
                style={({ pressed }) => [
                  styles.shareActionBtn,
                  { backgroundColor: copied ? "#22c55e" : colors.secondary, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={handleCopyLink}
              >
                <Feather name={copied ? "check" : "copy"} size={18} color={copied ? "#fff" : colors.primary} />
                <Text style={[styles.shareActionText, { color: copied ? "#fff" : colors.primary }]}>
                  {copied ? "Copied!" : "Copy Link"}
                </Text>
              </Pressable>

              {/* More (native share, non-web only) */}
              {Platform.OS !== "web" && (
                <Pressable
                  style={({ pressed }) => [
                    styles.shareActionBtn,
                    { backgroundColor: colors.secondary, opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => { setShowShareSheet(false); handleNativeShare(); }}
                >
                  <Feather name="share-2" size={18} color={colors.primary} />
                  <Text style={[styles.shareActionText, { color: colors.primary }]}>More</Text>
                </Pressable>
              )}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.shareDismiss,
                { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => setShowShareSheet(false)}
            >
              <Text style={[styles.shareDismissText, { color: colors.mutedForeground }]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
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
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  navCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginHorizontal: 8,
  },
  navTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  navActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  navIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 16, gap: 16 },
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    gap: 12,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
  },
  memberAvatars: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarOverlap: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  moreAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  moreAvatarText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  summaryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryMeta: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  tripTagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tripTagText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  tabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  section: { gap: 10 },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  expenseCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  expenseLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  expenseInfo: { flex: 1 },
  expenseTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  expenseMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  expenseRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  expenseShare: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  settledBanner: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
  },
  settledTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  settledSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  simplifyBanner: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  simplifyBannerTop: { flexDirection: "row", alignItems: "center" },
  simplifyBannerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  simplifyBannerEmoji: { fontSize: 22 },
  simplifyBannerTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  simplifyBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  simplifyToggle: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  simplifyToggleBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
  },
  simplifyToggleBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  balancesHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  debtCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  debtMiddle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  debtFrom: { fontSize: 13, fontFamily: "Inter_500Medium", flexShrink: 1 },
  debtArrow: { flexDirection: "row", alignItems: "center", gap: 2 },
  debtLine: { width: 20, height: 1.5 },
  debtTo: { fontSize: 13, fontFamily: "Inter_500Medium", flexShrink: 1 },
  debtRight: { alignItems: "flex-end", gap: 6 },
  settleBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  settleBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  switchToSimplifiedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  switchToSimplifiedText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  memberName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  memberSettled: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  fab: {
    position: "absolute",
    right: 20,
    borderRadius: 30,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  fabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  fabText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  vibesHeader: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 4,
  },
  vibesHeaderTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  vibesHeaderSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  vibesEmpty: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  vibesEmptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  roleCardInfo: { flex: 1 },
  roleCardName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  roleCardDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleBadgeEmoji: { fontSize: 14 },
  roleBadgeLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  banterHeader: {
    paddingTop: 16,
    paddingBottom: 4,
    borderTopWidth: 1,
    marginTop: 4,
    gap: 4,
  },
  banterEmpty: {
    alignItems: "center",
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  banterEmptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  banterMsg: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  banterEmojiWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  banterEmojiText: { fontSize: 20 },
  banterContent: { flex: 1 },
  banterText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },
  banterTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  qrModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  qrModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  qrModalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  qrModalSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  qrWrapper: {
    alignSelf: "center",
    borderRadius: 16,
    padding: 16,
  },
  qrHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  qrActions: {
    flexDirection: "row",
    gap: 10,
  },
  qrShareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  qrShareBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  editModalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  editModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  editModalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 0,
  },
  emojiScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  editModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  editCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  editCancelText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  editSaveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  editSaveText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  editMemberList: {
    gap: 8,
  },
  editMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
  },
  editMemberName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  removeMemberBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    padding: 16,
  },
  actionSheet: {
    borderRadius: 20,
    paddingTop: 16,
    paddingBottom: 8,
    overflow: "hidden",
  },
  actionTitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    opacity: 0.6,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  actionRowText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  actionDivider: {
    height: 1,
    marginHorizontal: 20,
  },
  actionCancelRow: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
  actionCancelText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  shareOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  shareSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
    alignItems: "center",
  },
  shareHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    marginBottom: 4,
  },
  shareTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  shareLinkBox: {
    alignSelf: "stretch",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  shareLinkText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  shareActions: {
    flexDirection: "row",
    gap: 10,
    alignSelf: "stretch",
  },
  shareActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareActionIcon: { fontSize: 18 },
  shareActionText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  whatsappBtn: {
    backgroundColor: "#25D366",
  },
  whatsappBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  shareDismiss: {
    alignSelf: "stretch",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  shareDismissText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  activityDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  activityDateLine: {
    flex: 1,
    height: 1,
  },
  activityDateLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 4,
  },
  activityTimelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  activityLeft: {
    alignItems: "center",
    width: 36,
  },
  activityLine: {
    width: 2,
    flex: 1,
    minHeight: 16,
    marginTop: 4,
    borderRadius: 1,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  activityCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  activityCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activityNewPill: {
    position: "absolute",
    top: -1,
    right: -1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 8,
  },
  activityNewPillText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  activityLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  activityMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  activityAmount: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  summaryMetaRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewMembersHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  viewMembersHintText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.8)",
  },
  membersCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  membersCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  membersCardTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  memberInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  memberInlineInfo: {
    flex: 1,
    gap: 4,
  },
  memberInlineName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  membersStripLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  membersStripLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  membersStripCount: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  membersStripCountText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  membersStripAvatars: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarOverlapSm: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  moreAvatarSm: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  moreAvatarSmText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  membersOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  membersSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  membersHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  membersTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  memberSheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  memberSheetInfo: {
    flex: 1,
    gap: 4,
  },
  memberSheetName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  travelStyleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  travelStyleText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  travelStyleNone: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
});
