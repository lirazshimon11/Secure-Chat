import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Chat, ChatMuteSetting } from "@/lib/types";
import { describeMute } from "./ChatUtils";

type Props = {
  chat: Chat;
  theme: any;
  styles: any;
  isSelectionMode: boolean;
  selectedIds: string[];
  savedMessageIds: Set<string>;
  chatMuted: boolean;
  muteSetting?: ChatMuteSetting;
  groupSubtitle: string;
  chatLocked: boolean;
  onBack: () => void;
  onOpenChatSettings: () => void;
  onReplyToSelected: () => void;
  onToggleStarSelected: () => void;
  onDeleteSelected: () => void;
  onForwardSelected: () => void;
  onShowSelectionOverflow: () => void;
  onShowOverflowMenu: () => void;
  decoyMode?: boolean;
};

export const ChatHeader = ({
  chat,
  theme,
  styles,
  isSelectionMode,
  selectedIds,
  savedMessageIds,
  chatMuted,
  muteSetting,
  groupSubtitle,
  chatLocked,
  onBack,
  onOpenChatSettings,
  onReplyToSelected,
  onToggleStarSelected,
  onDeleteSelected,
  onForwardSelected,
  onShowSelectionOverflow,
  onShowOverflowMenu,
  decoyMode,
}: Props) => {
  const webAction = (action: string) =>
    Platform.OS === "web" ? ({ dataSet: { chatAction: action } } as any) : {};

  return (
    <View style={styles.header}>
      <Pressable {...webAction("back")} onPress={onBack} style={styles.headerButton}>
        <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
      </Pressable>

      {isSelectionMode ? (
        <>
          <Text style={styles.selectionCount}>{selectedIds.length}</Text>
          <View style={styles.selectionActions}>
            {selectedIds.length === 1 && (
              <Pressable {...webAction("reply-selected")} onPress={onReplyToSelected} style={styles.headerButton}>
                <MaterialCommunityIcons color={theme.colors.headerIcon} name="reply" size={22} />
              </Pressable>
            )}
            <Pressable {...webAction("star-selected")} onPress={onToggleStarSelected} style={styles.headerButton}>
              <MaterialCommunityIcons 
                color={theme.colors.headerIcon} 
                name={selectedIds.every((id) => savedMessageIds.has(id)) ? "star" : "star-outline"} 
                size={24} 
              />
            </Pressable>
            <Pressable {...webAction("delete-selected")} onPress={onDeleteSelected} style={styles.headerButton}>
              <MaterialCommunityIcons color={theme.colors.headerIcon} name="trash-can-outline" size={24} />
            </Pressable>
            <Pressable {...webAction("forward-selected")} onPress={onForwardSelected} style={styles.headerButton}>
              <MaterialCommunityIcons color={theme.colors.headerIcon} name="share-all-outline" size={24} />
            </Pressable>
            <Pressable {...webAction("selection-overflow")} onPress={onShowSelectionOverflow} style={styles.headerButton}>
              <MaterialCommunityIcons color={theme.colors.headerIcon} name="dots-vertical" size={26} />
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Pressable {...webAction("settings")} onPress={onOpenChatSettings} style={styles.avatar}>
            <Text style={styles.avatarText}>{(chat.title || "?").slice(0, 1).toUpperCase()}</Text>
          </Pressable>
          <Pressable {...webAction("settings")} onPress={onOpenChatSettings} style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.title}>
              {chat.title}
            </Text>
            {chatLocked || chatMuted || chat.is_group ? (
              <Text numberOfLines={1} style={styles.subtitle}>
                {chatLocked
                  ? "נעול במכשיר זה"
                  : chatMuted
                    ? `מושתק · ${describeMute(muteSetting)}`
                    : groupSubtitle}
              </Text>
            ) : null}
          </Pressable>
          
          {!decoyMode && (
            <Pressable {...webAction("video")} onPress={() => {}} style={styles.headerButtonSmall}>
              <Feather color={theme.colors.headerIcon} name="video" size={20} />
            </Pressable>
          )}
          {!decoyMode && (
            <Pressable {...webAction("phone")} onPress={() => {}} style={styles.headerButtonSmall}>
              <Feather color={theme.colors.headerIcon} name="phone" size={19} />
            </Pressable>
          )}

          <Pressable {...webAction("overflow")} onPress={onShowOverflowMenu} style={styles.headerButtonSmall}>
            <MaterialCommunityIcons color={theme.colors.headerIcon} name="dots-vertical" size={24} />
          </Pressable>
        </>
      )}
    </View>
  );
};
