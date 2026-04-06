import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/lib/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";

const RECENT_KEY = "emoji_recent_v1";
const RECENT_MAX = 30;

// ─── Emoji Data ─────────────────────────────────────────────────────────────
const CATEGORIES: { id: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; emojis: string[] }[] = [
  {
    id: "recent",
    icon: "clock-outline",
    label: "לאחרונה",
    emojis: [], // filled dynamically
  },
  {
    id: "smileys",
    icon: "emoticon-outline",
    label: "סמיילים ואנשים",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "🫠", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "☺️",
      "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🫢", "🫣", "🤫", "🤔", "🫡", "🤐", "🤨", "😐", "😑",
      "😶", "🫥", "😏", "😒", "🙄", "😬", "🤥", "🫨", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵",
      "🥶", "🥴", "😵", "💫", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐", "😕", "🫤", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳",
      "🥺", "🥹", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠",
      "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖", "😺", "😸", "😹", "😻", "😼", "😽", "🙀",
      "😿", "😾", "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙",
      "👈", "👉", "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🙏", "✍️",
      "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🫀", "🫁", "🧠", "🦷", "🦴", "👀", "👁️", "👅", "👄", "🫦",
      "👶", "🧒", "👦", "👧", "🧑", "👱", "👨", "🧔", "👩", "🧓", "👴", "👵", "🙍", "🙎", "🙅", "🙆", "💁", "🙋", "🧏", "🙇",
    ],
  },
  {
    id: "animals",
    icon: "paw",
    label: "בעלי חיים וטבע",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔",
      "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌", "🐞", "🐜", "🪲", "🦟",
      "🦗", "🪳", "🕷️", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋",
      "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🦣", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🦬", "🐃", "🐂", "🐄", "🐎",
      "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🦮", "🐕‍🦺", "🐈", "🐈‍⬛", "🪶", "🐓", "🦃", "🦤", "🦚", "🦜", "🦢", "🦩",
      "🕊️", "🐇", "🦝", "🦨", "🦡", "🦫", "🦦", "🦥", "🐁", "🐀", "🐿️", "🦔", "🐾", "🐉", "🐲", "🌵", "🎄", "🌲", "🌳", "🌴",
      "🪵", "🌱", "🌿", "☘️", "🍀", "🎋", "🎍", "🪴", "🍃", "🍂", "🍁", "🪺", "🪹", "🍄", "🐚", "🪸", "🪨", "🌾", "💐", "🌷",
      "🌹", "🥀", "🪷", "🌺", "🌸", "🌼", "🌻", "🌞", "🌝", "🌛", "🌜", "🌚", "🌕", "🌖", "🌗", "🌘", "🌑", "🌒", "🌓", "🌔",
    ],
  },
  {
    id: "food",
    icon: "food-apple-outline",
    label: "אוכל ושתייה",
    emojis: [
      "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🫛",
      "🥦", "🥬", "🥒", "🌶️", "🫑", "🧄", "🧅", "🥔", "🍠", "🫘", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞",
      "🧇", "🥓", "🥩", "🍗", "🍖", "🌭", "🍔", "🍟", "🍕", "🫓", "🥪", "🥙", "🧆", "🌮", "🌯", "🫔", "🥗", "🥘", "🫕", "🥫",
      "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥮", "🍢", "🧁", "🍰", "🎂", "🍮", "🍭",
      "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🥜", "🍯", "🧃", "🥤", "🧋", "☕", "🍵", "🫖", "🍶", "🍺", "🍻", "🥂", "🍷", "🫗",
      "🥃", "🍸", "🍹", "🧉", "🍾", "🧊", "🥄", "🍴", "🍽️", "🥢", "🫙", "🧂",
    ],
  },
  {
    id: "activity",
    icon: "soccer",
    label: "פעילות",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🥍", "🏑", "🏏", "🪃", "🥅", "⛳",
      "🪁", "🛝", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🪂", "🏋️", "🤼", "🤸",
      "⛹️", "🤺", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣", "🧗", "🚵", "🚴", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🏵️",
      "🎗️", "🤺", "🎫", "🎟️", "🎪", "🤹", "🎭", "🩰", "🎨", "🎬", "🎤", "🎧", "🎼", "🎵", "🎶", "🪗", "🎷", "🎺", "🎸", "🪕",
      "🎻", "🪘", "🥁", "🎙️", "📻", "🎮", "🕹️", "🎲", "♟️", "🧩", "🪄", "🪅", "🎯", "🎳", "🎰", "🧸", "🪆", "🪅",
    ],
  },
  {
    id: "travel",
    icon: "airplane",
    label: "נסיעות",
    emojis: [
      "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🛵", "🏍️", "🛺", "🚲", "🛴", "🛹",
      "🛼", "🚏", "🛣️", "🛤️", "⛽", "🛞", "🚨", "🚥", "🚦", "🛑", "🚧", "⚓", "🛟", "⛵", "🚤", "🛥️", "🛳️", "⛴️", "🚢", "✈️",
      "🛩️", "🛫", "🛬", "🪂", "💺", "🚁", "🚟", "🚠", "🚡", "🛰️", "🚀", "🛸", "🌍", "🌎", "🌏", "🌐", "🗺️", "🧭", "🏔️", "⛰️",
      "🌋", "🗻", "🏕️", "🏖️", "🏜️", "🏝️", "🏞️", "🏟️", "🏛️", "🏗️", "🧱", "🏘️", "🏚️", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦",
      "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🏯", "🏰", "💒", "🗼", "🗽", "⛪", "🕌", "🛕", "🕍", "⛩️", "🕋", "⛲", "⛺", "🌁",
      "🌃", "🏙️", "🌄", "🌅", "🌆", "🌇", "🌉", "♾️", "🎠", "🎡", "🎢", "💈", "🎪",
    ],
  },
  {
    id: "objects",
    icon: "lightbulb-outline",
    label: "חפצים",
    emojis: [
      "⌚", "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "💽", "💾", "💿", "📀", "📼", "📷", "📸", "📹", "🎥", "📽️", "🎞️",
      "📞", "☎️", "📟", "📠", "📺", "📻", "🧭", "⏱️", "⌛", "⏰", "🕰️", "⏳", "📡", "🔋", "🪫", "🔌", "💡", "🔦", "🕯️", "🪔",
      "🧯", "🪙", "💰", "💴", "💵", "💶", "💷", "💸", "💳", "🧾", "📈", "📉", "📊", "📋", "📌", "📍", "✂️", "🗃️", "🗄️", "🗑️",
      "🔒", "🔓", "🔏", "🔐", "🔑", "🗝️", "🔨", "🪓", "⛏️", "⚒️", "🛠️", "🗡️", "⚔️", "🛡️", "🪚", "🔧", "🪛", "🔩", "⚙️", "🗜️",
      "🔗", "⛓️", "🪝", "🧲", "🪜", "⚗️", "🔭", "🔬", "🩺", "🩻", "💊", "🩹", "🩼", "🧸", "🪆", "🖼️", "🪞", "🛋️", "🪑", "🚪",
      "🧴", "🪤", "🧹", "🧺", "🧻", "🚽", "🚿", "🛁", "🧼", "🫧", "🪥", "🧽", "🪣", "🧹", "🪠", "🔧", "📿", "💎", "💍", "👑",
    ],
  },
  {
    id: "symbols",
    icon: "pound",
    label: "סמלים",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝",
      "💟", "☮️", "✝️", "☪️", "🪯", "🕉️", "☸️", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐", "⛎", "♈", "♉", "♊", "♋", "♌", "♍",
      "♎", "♏", "♐", "♑", "♒", "♓", "🆔", "⚛️", "🉑", "☢️", "☣️", "📴", "📳", "🈶", "🈚", "🈸", "🈺", "🈷️", "✴️", "🆚",
      "💮", "🉐", "㊙️", "㊗️", "🈴", "🈵", "🈹", "🈲", "🅰️", "🅱️", "🆎", "🆑", "🅾️", "🆘", "❌", "⭕", "🛑", "⛔", "📛",
      "🚫", "💯", "💢", "♨️", "🚷", "🚯", "🚳", "🚱", "🔞", "📵", "🔕", "🔇", "▶️", "⏸️", "⏹️", "⏺️", "⏭️", "⏮️", "⏩", "⏪",
      "🔀", "🔁", "🔂", "🔃", "🔄", "🔙", "🔚", "🔛", "🔜", "🔝", "🔰", "♻️", "✅", "🔱", "📛", "🔰", "⭕", "✅", "✔️", "❎",
      "➕", "➖", "➗", "✖️", "🟰", "♾️", "‼️", "⁉️", "❓", "❔", "❕", "❗", "〽️", "⚠️", "🔅", "🔆", "🔱", "⚜️", "🔰", "♻️",
      "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🟤", "🔺", "🔻", "🔷", "🔶", "🔹", "🔸", "🔲", "🔳", "▪️", "▫️", "◾", "◽",
    ],
  },
];

type Props = {
  onEmojiSelected: (emoji: string) => void;
  height: number;
  recents: string[];
  onRecentsUpdate: (recents: string[]) => void;
  bottomInset?: number;
};

export function EmojiKeyboard({ onEmojiSelected, height, recents, onRecentsUpdate, bottomInset = 0 }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [activeCat, setActiveCat] = useState("smileys");
  const [search, setSearch] = useState("");

  const categoriesWithRecent = useMemo(() =>
    CATEGORIES.map((c) =>
      c.id === "recent" ? { ...c, emojis: recents } : c
    ), [recents]);

  const activeCategory = useMemo(() =>
    categoriesWithRecent.find((c) => c.id === activeCat) ?? categoriesWithRecent[1],
    [categoriesWithRecent, activeCat]
  );

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return activeCategory.emojis;
    // Basic text filter — can't search by name easily without a data file
    return activeCategory.emojis;
  }, [activeCategory, search]);

  const handleEmoji = useCallback((emoji: string) => {
    onEmojiSelected(emoji);
    // Update recents
    const updated = [emoji, ...recents.filter((e) => e !== emoji)].slice(0, RECENT_MAX);
    onRecentsUpdate(updated);
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated)).catch(() => { });
  }, [onEmojiSelected, recents, onRecentsUpdate]);

  const numColumns = 7;

  return (
    <View style={[styles.container, { height }]}>
      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={styles.tabsContent}
      >
        {categoriesWithRecent.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => setActiveCat(cat.id)}
            style={[styles.tab, activeCat === cat.id && styles.tabActive]}
          >
            <MaterialCommunityIcons
              name={cat.icon}
              size={22}
              color={activeCat === cat.id ? theme.colors.accent : theme.colors.textMuted}
            />
          </Pressable>
        ))}
      </ScrollView>

      {/* Emoji grid fills remaining space */}
      <View style={{ flex: 1 }}>

        {/* Emoji grid */}
        {filteredEmojis.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {activeCat === "recent" ? "אין אמוג'י בשימוש לאחרונה עדיין" : "לא נמצאו אמוג'י"}
            </Text>
          </View>
        ) : (
          <FlatList
            key={`grid-${numColumns}`}
            data={filteredEmojis}
            numColumns={numColumns}
            keyExtractor={(item, idx) => `${item}-${idx}`}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleEmoji(item)}
                style={styles.emojiCell}
              >
                <Text style={styles.emoji}>{item}</Text>
              </Pressable>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: bottomInset + 10 }}
            initialNumToRender={42}
            maxToRenderPerBatch={42}
            windowSize={5}
          />
        )}
      </View>
    </View>
  );
}

export { RECENT_KEY };

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      width: "100%",
    },
    tabs: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.separator,
      flexGrow: 0,
    },
    tabsContent: {
      paddingHorizontal: 4,
    },
    tab: {
      paddingHorizontal: 10,
      paddingTop: 11,
      paddingBottom: 11,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: {
      borderBottomColor: theme.colors.accent,
    },

    emojiCell: {
      flex: 1,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      maxWidth: "14.2857%",
    },
    emoji: {
      fontSize: 28,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 14,
    },
  });
}
