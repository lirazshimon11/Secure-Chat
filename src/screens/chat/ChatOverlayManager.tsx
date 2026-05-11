import React, { useMemo } from "react";
import { Alert, Pressable, Text, View, ScrollView, ImageBackground, Platform, Image, Animated, PanResponder, Dimensions } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Chat, Message, Profile } from "@/lib/types";
import { useAppTheme } from "@/lib/theme";
import { describeMute } from "./ChatUtils";
import { MessageBubble } from "@/components/MessageBubble";
import { PERMISSION_DURATION_MS } from "@/context/ScreenshotContext";
import { DecoyManagerOverlay } from "./DecoyManagerOverlay";

type OverlayProps = {
  chat: Chat;
  profile: Profile | null;
  profiles: Record<string, Profile>;
  theme: any;
  styles: any;
  muteSetting: any;

  showOverflowMenu: boolean;
  setShowOverflowMenu: (v: boolean) => void;
  showMoreMenu: boolean;
  setShowMoreMenu: (v: boolean) => void;
  showMuteMenu: boolean;
  setShowMuteMenu: (v: boolean) => void;
  showClearDialog: boolean;
  setShowClearDialog: (v: boolean) => void;
  showExportDialog: boolean;
  setShowExportDialog: (v: boolean) => void;
  showReportDialog: boolean;
  setShowReportDialog: (v: boolean) => void;
  showAttachmentMenu: boolean;
  setShowAttachmentMenu: (v: boolean) => void;
  showSelectionOverflowMenu: boolean;
  setShowSelectionOverflowMenu: (v: boolean) => void;
  showDeleteModal: boolean;
  setShowDeleteModal: (v: boolean) => void;

  muteSelection: "8_hours" | "1_week" | "always";
  setMuteSelection: (v: "8_hours" | "1_week" | "always") => void;
  clearSelection: "all" | "media";
  setClearSelection: (v: "all" | "media") => void;
  clearStarred: boolean;
  setClearStarred: (v: boolean) => void;
  reportExit: boolean;
  setReportExit: (v: boolean) => void;

  selectedIds: string[];
  setSelectedIds: (v: string[]) => void;
  messageMap: Record<string, Message>;
  viewInfoMessage: Message | null;
  setViewInfoMessage: (m: Message | null) => void;

  showReactionsSheetForId: string | null;
  setShowReactionsSheetForId: (v: string | null) => void;
  reactionsByMessage: Record<string, any>;
  contactNicknames: Record<string, any>;

  showEmojiPickerForId: string | null;
  setShowEmojiPickerForId: (v: string | null) => void;

  toastMessage: string | null;

  activeSubScreen: string | null;
  setActiveSubScreen: (v: any) => void;

  onOpenChatSettings: () => void;
  onCreateGroupWith?: (profile: Profile) => void;
  setChatMute: (chatId: string, duration: any) => void;
  clearChatsLocally: (ids: string[]) => void;
  performDelete: (everyone: boolean) => void;
  showToast: (text: string) => void;
  toggleReaction: (msgId: string, emoji: string) => void;
  toggleSelection: (id: string) => void;
  requestScreenshotPermission: (chatId: string, members: string[]) => Promise<any>;
  sendMessage: (payload: any) => Promise<any>;
  hasScreenshotPerm: boolean;
  myRequests: any;
  groupMembers: Profile[];
  setSearchOpen: (v: boolean) => void;
  keyboardHeight?: number;
  showDecoyManager: boolean;
  setShowDecoyManager: (v: boolean) => void;
  onSendSystemMessage: (body: string) => Promise<void>;
  decoyMode?: boolean;
  /** User is viewing swapped decoy conversation under \"מגן הגנה\" — hide conspicuous security tooling. */
  decoyProtectedViewer?: boolean;
  onRequestDecoyMessageEdit?: (messageId: string) => void;
};

export const ChatOverlayManager = (props: OverlayProps) => {
  const {
    chat, profile, profiles, theme, styles, muteSetting,
    showOverflowMenu, setShowOverflowMenu,
    showMoreMenu, setShowMoreMenu,
    showMuteMenu, setShowMuteMenu,
    showClearDialog, setShowClearDialog,
    showExportDialog, setShowExportDialog,
    showReportDialog, setShowReportDialog,
    showAttachmentMenu, setShowAttachmentMenu,
    showSelectionOverflowMenu, setShowSelectionOverflowMenu,
    showDeleteModal, setShowDeleteModal,
    muteSelection, setMuteSelection,
    clearSelection, setClearSelection,
    clearStarred, setClearStarred,
    reportExit, setReportExit,
    selectedIds, setSelectedIds,
    messageMap,
    viewInfoMessage, setViewInfoMessage,
    showReactionsSheetForId, setShowReactionsSheetForId,
    reactionsByMessage, contactNicknames,
    showEmojiPickerForId, setShowEmojiPickerForId,
    toastMessage,
    setActiveSubScreen,
    onOpenChatSettings, onCreateGroupWith,
    setChatMute, clearChatsLocally, performDelete,
    showToast, toggleReaction, toggleSelection,
    requestScreenshotPermission, sendMessage,
    hasScreenshotPerm, myRequests, groupMembers,
    setSearchOpen, keyboardHeight,
    showDecoyManager, setShowDecoyManager, onSendSystemMessage,
    decoyMode,
    decoyProtectedViewer,
    onRequestDecoyMessageEdit,
  } = props;

  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const isScreenshotRequestBlocked = useMemo(() => {
    // 1. If currently have permission, strict block
    if (hasScreenshotPerm) return true;

    const req = myRequests[chat.id];
    if (!req) return false;

    // 2. If it's a pending/approved request, check its age
    const baseTime = req.approved_at
      ? new Date(req.approved_at).getTime()
      : new Date(req.requested_at).getTime();

    // If it's still within the "cooldown" window, block it
    if (Date.now() - baseTime < PERMISSION_DURATION_MS) return true;

    return false;
  }, [hasScreenshotPerm, myRequests, chat.id, tick]);

  return (
    <>
      {showOverflowMenu ? (
        <View pointerEvents="box-none" style={styles.overlayRoot}>
          <Pressable onPress={() => setShowOverflowMenu(false)} style={styles.backdrop} />
          <View {...(Platform.OS === "web" ? ({ dataSet: { chatMenu: "true" } } as any) : {})} style={styles.menuCard}>
            {chat.is_group ? (
              <>
                <MenuItem label="צירוף חברים" onPress={() => { setShowOverflowMenu(false); setActiveSubScreen("addMembers"); }} />
                <MenuDivider />
                <MenuItem label="פרטי הקבוצה" onPress={() => { setShowOverflowMenu(false); onOpenChatSettings(); }} />
                <MenuItem label="מדיה קבוצתית" onPress={() => { setShowOverflowMenu(false); setActiveSubScreen("media"); }} />
                <MenuItem label="חיפוש" onPress={() => { setShowOverflowMenu(false); setSearchOpen(true); }} />
                <MenuItem label="השתקת התראות" secondary={describeMute(muteSetting)} onPress={() => { setShowOverflowMenu(false); setShowMuteMenu(true); }} />
                <MenuItem label="הודעות זמניות" onPress={() => { setShowOverflowMenu(false); setActiveSubScreen("disappearing"); }} />
                <MenuItem label="ערכת הנושא של הצאט" onPress={() => { setShowOverflowMenu(false); setActiveSubScreen("theme"); }} />
                <MenuDivider />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <MenuItem label="עוד" onPress={() => { setShowOverflowMenu(false); setShowMoreMenu(true); }} />
                  <MaterialCommunityIcons name="menu-left" size={24} color={theme.colors.textMuted} style={{ position: "absolute", left: 10, top: 12 }} pointerEvents="none" />
                </View>
              </>
            ) : (
              <>
                <MenuItem label="קבוצה חדשה" onPress={() => {
                  setShowOverflowMenu(false);
                  const otherUser = Object.values(profiles).find(p => p.id !== profile?.id);
                  if (otherUser && onCreateGroupWith) {
                    onCreateGroupWith(otherUser);
                  } else {
                    Alert.alert("שגיאה", "אנא נסה שוב");
                  }
                }} />
                <MenuDivider />
                <MenuItem label="הצגת איש הקשר" onPress={() => { setShowOverflowMenu(false); onOpenChatSettings(); }} />
                <MenuItem label="חיפוש" onPress={() => { setShowOverflowMenu(false); setSearchOpen(true); }} />
                <MenuItem label="מדיה, קישורים ומסמכים" onPress={() => { setShowOverflowMenu(false); setActiveSubScreen("media"); }} />
                <MenuItem label="השתקת התראות" secondary={describeMute(muteSetting)} onPress={() => { setShowOverflowMenu(false); setShowMuteMenu(true); }} />
                <MenuItem label="הודעות זמניות" onPress={() => { setShowOverflowMenu(false); setActiveSubScreen("disappearing"); }} />
                <MenuItem label="ערכת הנושא של הצ'אט" onPress={() => { setShowOverflowMenu(false); setActiveSubScreen("theme"); }} />
                <MenuDivider />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <MenuItem label="עוד" onPress={() => { setShowOverflowMenu(false); setShowMoreMenu(true); }} />
                  <MaterialCommunityIcons name="menu-left" size={24} color={theme.colors.textMuted} style={{ position: "absolute", left: 10, top: 12 }} pointerEvents="none" />
                </View>
              </>
            )}
          </View>
        </View>
      ) : null}

      {showMoreMenu ? (
        <View pointerEvents="box-none" style={styles.overlayRoot}>
          <Pressable onPress={() => setShowMoreMenu(false)} style={styles.backdrop} />
          <View {...(Platform.OS === "web" ? ({ dataSet: { chatMenu: "true" } } as any) : {})} style={styles.menuCard}>
            {chat.is_group ? (
              <>
                <MenuItem label="ניקוי הצאט" onPress={() => { setShowMoreMenu(false); setShowClearDialog(true); }} />
                <MenuItem label="יצוא הצאט" onPress={() => { setShowMoreMenu(false); setShowExportDialog(true); }} />
                <MenuItem label="הוספת קיצור דרך" onPress={() => { setShowMoreMenu(false); Alert.alert("קיצור דרך", "בקרוב"); }} />
                <MenuItem label="הוספה לרשימה" onPress={() => { setShowMoreMenu(false); Alert.alert("רשימה", "בקרוב"); }} />
                <MenuDivider />
                <MenuItem label="דיווח" onPress={() => { setShowMoreMenu(false); setShowReportDialog(true); }} />
                <MenuItem label="יציאה מהקבוצה" onPress={() => { setShowMoreMenu(false); Alert.alert("יציאה מהקבוצה", "האם לעזוב קבוצה זו?", [{ text: "ביטול" }, { text: "עזוב", style: "destructive" }]) }} />
              </>
            ) : (
              <>
                <MenuItem label="דיווח" onPress={() => { setShowMoreMenu(false); setShowReportDialog(true); }} />
                <MenuItem label="חסימה" onPress={() => { setShowMoreMenu(false); Alert.alert("חסימה", "בקרוב"); }} />
                <MenuItem label="ניקוי הצאט" onPress={() => { setShowMoreMenu(false); setShowClearDialog(true); }} />
                <MenuItem label="יצוא הצאט" onPress={() => { setShowMoreMenu(false); setShowExportDialog(true); }} />
                <MenuItem label="הוספת קיצור דרך" onPress={() => { setShowMoreMenu(false); Alert.alert("קיצור דרך", "בקרוב"); }} />
                <MenuItem label="הוספה לרשימה" onPress={() => { setShowMoreMenu(false); Alert.alert("רשימה", "בקרוב"); }} />
              </>
            )}
          </View>
        </View>
      ) : null}

      {showMuteMenu ? (
        <View pointerEvents="box-none" style={styles.overlayRootCenter}>
          <Pressable onPress={() => setShowMuteMenu(false)} style={styles.backdropDark} />
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>השתקת התראות על{'\n'}הודעות</Text>
            <Text style={styles.dialogSub}>חברים אחרים לא יוכלו לראות שהשתקת את הצ'אט הזה. עדיין תשלח לך התראה אם יאזכרו אותך.</Text>
            {["8_hours", "1_week", "always"].map((opt) => (
              <Pressable key={opt} style={styles.radioRow} onPress={() => setMuteSelection(opt as any)}>
                <View style={[styles.radioOut, muteSelection === opt && styles.radioOutActive]}>
                  {muteSelection === opt && <View style={styles.radioIn} />}
                </View>
                <Text style={styles.radioText}>{opt === "8_hours" ? "8 שעות" : opt === "1_week" ? "שבוע" : "תמיד"}</Text>
              </Pressable>
            ))}
            <View style={styles.dialogActions}>
              <Pressable onPress={() => {
                const map = { "8_hours": "8_hours", "1_week": "7_days", "always": "always" } as const;
                setChatMute(chat.id, map[muteSelection]);
                setShowMuteMenu(false);
              }}>
                <Text style={styles.dialogBtn}>אישור</Text>
              </Pressable>
              <Pressable onPress={() => setShowMuteMenu(false)}>
                <Text style={styles.dialogBtn}>ביטול</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {showClearDialog ? (
        <View pointerEvents="box-none" style={styles.overlayRootCenter}>
          <Pressable onPress={() => setShowClearDialog(false)} style={styles.backdropDark} />
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitleSmall}>מחיקת הצ'אט</Text>
            <Pressable style={styles.radioRow} onPress={() => setClearSelection("all")}>
              <View style={[styles.radioOut, clearSelection === "all" && styles.radioOutActive]}>
                {clearSelection === "all" && <View style={styles.radioIn} />}
              </View>
              <Text style={styles.radioText}>כל ההודעות</Text>
            </Pressable>
            <Pressable style={styles.radioRow} onPress={() => setClearSelection("media")}>
              <View style={[styles.radioOut, clearSelection === "media" && styles.radioOutActive]}>
                {clearSelection === "media" && <View style={styles.radioIn} />}
              </View>
              <Text style={styles.radioText}>רק קובצי מדיה</Text>
            </Pressable>
            <Pressable style={styles.checkRow} onPress={() => setClearStarred(!clearStarred)}>
              <View style={[styles.checkBox, clearStarred && styles.checkBoxActive]}>
                {clearStarred && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={styles.radioText}>מחיקת הודעות שמסומנות בכוכב</Text>
            </Pressable>
            <Text style={styles.dialogFooterNotes}>קובצי מדיה ששמרת מתוך WhatsApp יישארו בגלריה של המכשיר.</Text>
            <Pressable style={styles.dialogFullBtn} onPress={() => { clearChatsLocally([chat.id]); setShowClearDialog(false); }}>
              <Text style={styles.dialogFullBtnText}>מחיקת הצ'אט</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showExportDialog ? (
        <View pointerEvents="box-none" style={styles.overlayRootCenter}>
          <Pressable onPress={() => setShowExportDialog(false)} style={styles.backdropDark} />
          <View style={styles.dialogCard}>
            <Text style={styles.dialogSubBold}>צירוף מדיה יגדיל את נפח הקובץ של יצוא הצ'אט.</Text>
            <View style={styles.dialogActionsExpand}>
              <Pressable onPress={() => { setShowExportDialog(false); Alert.alert("יצוא צ'אט", "הכנת קובץ כולל מדיה..."); }}>
                <Text style={styles.dialogBtn}>לכלול מדיה</Text>
              </Pressable>
              <Pressable onPress={() => { setShowExportDialog(false); Alert.alert("יצוא צ'אט", "הכנת קובץ טקסט למייל..."); }}>
                <Text style={styles.dialogBtn}>ללא מדיה</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {showReportDialog ? (
        <View pointerEvents="box-none" style={styles.overlayRootCenter}>
          <Pressable onPress={() => setShowReportDialog(false)} style={styles.backdropDark} />
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitleSmall}>רוצה לדווח ל-WhatsApp על {chat.is_group ? "הקבוצה" : "המשתמש"} הזו?</Text>
            <Text style={styles.dialogSub}>5 ההודעות האחרונות בקבוצה יועברו ל-WhatsApp...</Text>
            <Text style={styles.dialogSub}>לא תישלח על כך הודעה לחברי הקבוצה.</Text>
            <Pressable style={styles.checkRow} onPress={() => setReportExit(!reportExit)}>
              <View style={[styles.checkBox, reportExit && styles.checkBoxActive]}>
                {reportExit && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={styles.radioText}>יציאה מצ'אט ומחיקתו</Text>
            </Pressable>
            <View style={styles.dialogActions}>
              <Pressable onPress={() => {
                setShowReportDialog(false);
                Alert.alert("דיווח", "הדיווח התקבל וייבדק.");
                if (reportExit) clearChatsLocally([chat.id]);
              }}>
                <Text style={styles.dialogBtn}>דיווח</Text>
              </Pressable>
              <Pressable onPress={() => setShowReportDialog(false)}>
                <Text style={styles.dialogBtn}>ביטול</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {showSelectionOverflowMenu ? (
        <View pointerEvents="box-none" style={styles.overlayRoot}>
          <Pressable onPress={() => setShowSelectionOverflowMenu(false)} style={styles.backdrop} />
          <View {...(Platform.OS === "web" ? ({ dataSet: { chatMenu: "true" } } as any) : {})} style={styles.menuCard}>
            {selectedIds.length === 1 &&
              messageMap[selectedIds[0]]?.sender_id === profile?.id &&
              messageMap[selectedIds[0]]?.message_kind === "standard" &&
              onRequestDecoyMessageEdit && (
                <MenuItem
                  label="עריכה"
                  onPress={() => {
                    onRequestDecoyMessageEdit(selectedIds[0]);
                    setShowSelectionOverflowMenu(false);
                  }}
                />
              )}
            {selectedIds.length === 1 && (
              <MenuItem label="פרטים" onPress={() => {
                const msg = messageMap[selectedIds[0]];
                if (msg) setViewInfoMessage(msg);
                setShowSelectionOverflowMenu(false);
                setSelectedIds([]);
              }} />
            )}
            <MenuItem label="הצמדה" onPress={() => {
              showToast("ההודעה הוצמדה");
              setShowSelectionOverflowMenu(false);
              setSelectedIds([]);
            }} />
          </View>
        </View>
      ) : null}

      {showDeleteModal ? (
        <View pointerEvents="box-none" style={styles.overlayRootCenter}>
          <Pressable onPress={() => setShowDeleteModal(false)} style={styles.backdrop} />
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>האם למחוק את ההודעה?</Text>
            <View style={styles.deleteModalActions}>
              {decoyMode ? (
                <Pressable style={styles.deleteModalAction} onPress={() => performDelete(true)}>
                  <Text style={styles.deleteModalActionText}>למחוק לכולם</Text>
                </Pressable>
              ) : (
                <>
                  {selectedIds.every((id) => messageMap[id]?.sender_id === profile?.id) && (
                    <Pressable style={styles.deleteModalAction} onPress={() => performDelete(true)}>
                      <Text style={styles.deleteModalActionText}>למחוק אצל כולם</Text>
                    </Pressable>
                  )}
                  <Pressable style={styles.deleteModalAction} onPress={() => performDelete(false)}>
                    <Text style={styles.deleteModalActionText}>למחוק אצלי</Text>
                  </Pressable>
                </>
              )}
              <Pressable style={styles.deleteModalAction} onPress={() => setShowDeleteModal(false)}>
                <Text style={styles.deleteModalActionText}>ביטול</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {showAttachmentMenu ? (
        <View pointerEvents="box-none" style={styles.overlayRoot}>
          <Pressable onPress={() => { setShowAttachmentMenu(false); setShowDecoyManager(false); }} style={styles.backdrop} />
          <View style={[styles.attachmentMenuCard, keyboardHeight ? { bottom: keyboardHeight + 70 } : {}, showDecoyManager && { minHeight: 440, paddingVertical: 0, paddingHorizontal: 0 }]}>
            {showDecoyManager ? (
              // ── Decoy manager fills the panel ──────────────────────────
              <DecoyManagerOverlay
                chat={chat}
                currentUserId={profile?.id ?? ""}
                groupMembers={groupMembers}
                onClose={() => { setShowDecoyManager(false); setShowAttachmentMenu(false); }}
                onSendSystemMessage={onSendSystemMessage}
              />
            ) : (
              // ── Default attachment grid: 2 rows × 4 (groups get shield in row 2)
              <>
                {/* Row 1: גלריה, מצלמה, מיקום, קבצים */}
                <View style={styles.attachmentRow}>
                  <AttachmentItem icon="image" label="גלריה" color="#0066FF" theme={theme} />
                  <AttachmentItem icon="camera" label="מצלמה" color="#E53935" theme={theme} />
                  <AttachmentItem icon="map-marker" label="מיקום" color="#00C853" theme={theme} />
                  <AttachmentItem icon="file-document" label="קבצים" color="#651FFF" theme={theme} />
                </View>
                {/* Row 2: סקר, אירוע, בקשת צילום, מגן הגנה (groups) / only 3 (non-groups) */}
                <View style={styles.attachmentRow}>
                  <AttachmentItem icon="poll" label="סקר" color="#FFB300" theme={theme} onPress={() => { setShowAttachmentMenu(false); setActiveSubScreen("createPoll"); }} />
                  <AttachmentItem icon="calendar" label="אירוע" color="#D81B60" theme={theme} />
                  {!decoyProtectedViewer ? (
                    <AttachmentItem
                      icon="camera-outline"
                      label="בקשת צילום"
                      color="#00A884"
                      theme={theme}
                      disabled={isScreenshotRequestBlocked}
                      onPress={async () => {
                        if (isScreenshotRequestBlocked) return;
                        setShowAttachmentMenu(false);
                        const targetMemberIds = chat.is_group
                          ? groupMembers.map((m) => m.id)
                          : Object.keys(profiles).filter(id => id !== profile?.id);
                        const reqResult = await requestScreenshotPermission(chat.id, targetMemberIds);
                        if (reqResult?.pollBody) {
                          sendMessage({ chatId: chat.id, body: reqResult.pollBody, messageKind: "standard" });
                        }
                      }}
                    />
                  ) : null}
                  {!decoyProtectedViewer ? (
                    <AttachmentItem
                      icon="shield-check"
                      label="מגן הגנה"
                      color="#5C6BC0"
                      theme={theme}
                      onPress={() => setShowDecoyManager(true)}
                    />
                  ) : null}
                </View>
              </>
            )}
          </View>
        </View>
      ) : null}

      {viewInfoMessage ? (
        <View style={styles.fullscreenOverlay}>
          <View style={styles.infoTitleRow}>
            <Pressable onPress={() => setViewInfoMessage(null)} style={styles.headerButton}>
              <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
            </Pressable>
            <Text style={styles.infoTitle}>פרטי הודעה</Text>
          </View>
          <ScrollView contentContainerStyle={styles.infoScroll}>
            <View style={styles.infoBubbleRow}>
              <MessageBubble
                author={profiles && profiles[viewInfoMessage.sender_id]}
                currentUserId={profile?.id ?? ""}
                message={viewInfoMessage}
                isSelectionMode={false}
                isSelected={false}
                onReply={() => { }}
                onRevealViewOnce={() => { }}
                reactions={reactionsByMessage[viewInfoMessage.id]}
                onShowReactions={() => { }}
                onShowReactionsSheet={() => { }}
                onPlusExtra={() => { }}
                onToggleReaction={() => { }}
                onToggleSelection={() => { }}
                showReactions={false}
              />
            </View>
            {/* Info details omitted for brevity in this component, but can be added back if needed */}
          </ScrollView>
        </View>
      ) : null}

      {showReactionsSheetForId ? (() => {
        const reactions = reactionsByMessage[showReactionsSheetForId] || {};
        const entries = Object.entries(reactions).filter(([e, u]) => Array.isArray(u) && u.length > 0 && !e.startsWith("poll:"));
        const total = entries.reduce((sum, [_, u]) => sum + (Array.isArray(u) ? u.length : 0), 0);
        return (
          <ReactionSheet 
            messageId={showReactionsSheetForId}
            reactions={reactions}
            total={total}
            profiles={profiles}
            profile={profile}
            contactNicknames={contactNicknames}
            onClose={() => setShowReactionsSheetForId(null)}
            onRemove={(emoji: string) => {
              toggleReaction(showReactionsSheetForId, emoji);
              setShowReactionsSheetForId(null);
            }}
            onAddMore={() => {
              setShowReactionsSheetForId(null);
              setShowEmojiPickerForId(showReactionsSheetForId);
            }}
            theme={theme}
            styles={styles}
          />
        );
      })() : null}


      {toastMessage ? (
        <View pointerEvents="none" style={styles.toastContainer}>
          <View style={styles.toastPill}>
            <ImageBackground source={require("../../../public/images/icon2.png")} style={styles.toastIcon} imageStyle={{ opacity: 0.7 }} />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      ) : null}
    </>
  );
};


function MenuDivider() {
  const theme = useAppTheme();
  return <View style={{ height: 1, backgroundColor: theme.colors.separator || "rgba(150,150,150,0.2)", marginVertical: 4 }} />;
}

function MenuItem({ label, secondary, onPress }: { label: string; secondary?: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 20, paddingVertical: 14, width: "100%" }}>
      <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "700", textAlign: "right", writingDirection: "rtl" }}>{label}</Text>
      {secondary ? <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 3, textAlign: "right", writingDirection: "rtl" }}>{secondary}</Text> : null}
    </Pressable>
  );
}

function AttachmentItem({ icon, label, color, theme, disabled, onPress }: { icon: any, label: string, color: string, theme: any, disabled?: boolean, onPress?: () => void }) {
  return (
    <Pressable disabled={disabled} style={{ width: 70, alignItems: "center", gap: 8, opacity: disabled ? 0.35 : 1 }} onPress={onPress}>
      <View style={{ width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.menuIconBackground, borderColor: theme.colors.bubbleBorder, borderWidth: 1 }} >
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <Text style={{ color: theme.colors.menuTextSecondary, fontSize: 13, textAlign: "center", fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

function ReactionSheet({
  messageId,
  reactions,
  profiles,
  profile,
  contactNicknames,
  onClose,
  onRemove,
  onAddMore,
  theme,
  styles,
  total
}: any) {
  const categories = React.useMemo(() => {
    const entries = Object.entries(reactions).filter(([e, u]) => Array.isArray(u) && u.length > 0 && !e.startsWith("poll:"));
    return entries.map(([e, u]) => ({ emoji: e, count: (u as any[]).length }));
  }, [reactions]);

  const [activeTab, setActiveTab] = React.useState(categories[0]?.emoji || "none");

  // Sync active tab if it's no longer present
  React.useEffect(() => {
    if (activeTab === "none" && categories.length > 0) {
      setActiveTab(categories[0].emoji);
    }
  }, [categories]);

  const translateY = React.useRef(new Animated.Value(Dimensions.get("window").height)).current;

  React.useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11
    }).start();
  }, []);

  const closeSheet = () => {
    Animated.timing(translateY, {
      toValue: Dimensions.get("window").height,
      duration: 200,
      useNativeDriver: true
    }).start(onClose);
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.5) {
          closeSheet();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11
          }).start();
        }
      }
    })
  ).current;

  const filteredUsers = React.useMemo(() => {
    return ((reactions[activeTab] as any[]) || []).map(u => ({ ...u, emoji: activeTab }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [reactions, activeTab]);

  return (
    <View pointerEvents="box-none" style={styles.overlayRoot}>
      <Pressable onPress={closeSheet} style={styles.backdrop} />
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.reactionsSheet, { transform: [{ translateY }] }]}
      >
        <View style={styles.sheetHandle} />
        
        <Text style={styles.reactionsSheetHeader}>{total === 1 ? "תגובה אחת" : `${total} תגובות`}</Text>

        <View style={styles.reactionTabsRow}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={{ flexGrow: 0 }} 
            contentContainerStyle={{ flexDirection: "row", gap: 12 }} 
          >
            <Pressable onPress={onAddMore} style={styles.reactionTabPillIcon}>
              <MaterialCommunityIcons name="emoticon-plus-outline" size={24} color={theme.colors.textMuted} />
            </Pressable>
            {categories.map(({ emoji, count }) => (
              <Pressable 
                key={emoji} 
                onPress={() => setActiveTab(emoji)} 
                style={[styles.reactionTabPill, activeTab === emoji && styles.reactionTabPillActive]}
              >
                <Text style={styles.reactionTabPillEmoji}>{emoji}</Text>
                <Text style={[styles.reactionTabPillText, activeTab === emoji && styles.reactionTabPillTextActive, { marginLeft: 6 }]}>{count}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <ScrollView contentContainerStyle={styles.reactionUserList}>
          {filteredUsers.map((item, idx) => {
            const uid = item.userId;
            const uProfile = profiles[uid];
            const isMe = uid === profile?.id;
            const name = isMe ? "התגובה שלך" : contactNicknames[uid]?.first_name || uProfile?.username || "משתמש";

            return (
              <Pressable
                key={`${uid}-${item.emoji}-${idx}`}
                style={styles.reactionUserRow}
                onPress={() => { if (isMe) onRemove(item.emoji); }}
              >
                <Text style={styles.reactionEmojiBadge}>{item.emoji}</Text>

                <View style={styles.reactionUserInfo}>
                  <Text style={styles.reactionUserName}>{name}</Text>
                  {isMe && <Text style={styles.reactionUserAction}>יש להקיש כדי להסיר</Text>}
                </View>

                <View style={[styles.avatar, { width: 44, height: 44, backgroundColor: isMe ? "#00A884" : "#63472b" }]}>
                  {uProfile?.avatar_url ? (
                    <Image source={{ uri: uProfile.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  ) : (
                    <Text style={styles.avatarText}>{(name || "?")[0].toUpperCase()}</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
