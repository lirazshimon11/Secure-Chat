import { supabase } from "@/lib/supabase";
import { Message, Profile, Chat } from "@/lib/types";

export const ChatService = {
  async fetchMemberDetails(userId: string) {
    return supabase
      .from("chat_member_details")
      .select("*")
      .eq("user_id", userId)
      .order("last_message_at", { ascending: false, nullsFirst: false });
  },

  async fetchDirectPartners(chatIds: string[]) {
    if (!chatIds.length) return { data: [] };
    return supabase.from("chat_members").select("chat_id,user_id").in("chat_id", chatIds);
  },

  async fetchProfiles(userIds: string[]) {
    if (!userIds.length) return { data: [] };
    return supabase.from("profiles").select("*").in("id", userIds);
  },

  async fetchLastReadAt(userId: string, chatIds: string[]) {
    if (!chatIds.length) return { data: [] };
    return supabase.from("chat_members").select("chat_id,last_read_at").eq("user_id", userId).in("chat_id", chatIds);
  },

  async fetchMessages(chatId: string) {
    return supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
  },

  async fetchReactions(messageIds: string[]) {
    if (!messageIds.length) return { data: [] };
    return supabase.from("message_reactions").select("message_id,emoji,user_id,created_at").in("message_id", messageIds);
  },

  async fetchViewOnceOpened(userId: string, messageIds: string[]) {
    if (!messageIds.length) return { data: [] };
    return supabase
      .from("message_views")
      .select("message_id,opened_at")
      .eq("viewer_id", userId)
      .in("message_id", messageIds);
  },

  async markSeen(userId: string, chatId: string, timestamp: string) {
    return supabase
      .from("chat_members")
      .update({ last_read_at: timestamp })
      .eq("chat_id", chatId)
      .eq("user_id", userId);
  },

  async sendMessage(chatId: string, senderId: string, body: string, preview: string, kind: string, replyToId: string | null = null, expiresAt: string | null = null, id?: string) {
    return supabase.from("messages").insert({
      id, // Client-side ID to prevent flickering
      chat_id: chatId,
      sender_id: senderId,
      body_ciphertext: body,
      body_preview: preview,
      message_kind: kind,
      reply_to_id: replyToId,
      expires_at: expiresAt
    }).select().single();
  },

  async createChat(title: string, isGroup: boolean, creatorId: string) {
    return supabase
      .from("chats")
      .insert({ title, is_group: isGroup, created_by: creatorId })
      .select()
      .single();
  },

  async addChatMembers(chatId: string, members: { user_id: string; role: string }[]) {
    return supabase.from("chat_members").insert(
      members.map(m => ({ chat_id: chatId, user_id: m.user_id, role: m.role }))
    );
  },

  async deleteMessages(ids: string[]) {
    return supabase.from("messages").update({ deleted_at: new Date().toISOString() }).in("id", ids);
  },

  async toggleReaction(messageId: string, userId: string, emoji: string, alreadyReacted: boolean) {
    if (alreadyReacted) {
      return supabase.from("message_reactions").delete().match({ message_id: messageId, user_id: userId, emoji: emoji });
    }
    return supabase.from("message_reactions").upsert({ message_id: messageId, user_id: userId, emoji: emoji });
  },

  async openViewOnce(messageId: string, viewerId: string) {
    return supabase.from("message_views").upsert({ message_id: messageId, viewer_id: viewerId, opened_at: new Date().toISOString() });
  },

  async updateChatInfo(chatId: string, data: Partial<Chat>) {
    return supabase.from("chats").update(data).eq("id", chatId);
  },

  async searchGlobalMessages(query: string) {
     return supabase
      .from("messages")
      .select("*")
      .ilike("body_ciphertext", `%${query}%`)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
  },
  async removeChatMember(chatId: string, userId: string) {
    return supabase.from("chat_members").delete().match({ chat_id: chatId, user_id: userId });
  },
  async updateChatMemberRole(chatId: string, userId: string, role: string) {
    const update: any = { role };
    if (role === "removed") update.removed_at = new Date().toISOString();
    return supabase.from("chat_members").update(update).match({ chat_id: chatId, user_id: userId });
  }
};
