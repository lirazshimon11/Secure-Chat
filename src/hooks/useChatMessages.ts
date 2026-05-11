import { useEffect, useMemo } from "react";
import { InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Message, MessageKind } from "@/lib/types";

const PAGE_SIZE = 20;

export type MessagesPage = {
  messages: Message[];
  nextCursor: string | null;
  totalCount?: number | null;
};

export type SendMessageInput = {
  chatId: string;
  senderId: string;
  body: string;
  messageKind: MessageKind;
  replyToId?: string | null;
  expireSeconds?: number | null;
};

type SendMessageMutationInput = SendMessageInput & {
  optimisticId: string;
};

export const chatMessagesQueryKey = (chatId: string) => ["chatMessages", chatId] as const;

function createClientId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function sortAscending(messages: Message[]) {
  return [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function addNewestMessage(
  oldData: InfiniteData<MessagesPage, string | null> | undefined,
  message: Message,
) {
  if (!oldData) {
    return {
      pages: [{ messages: [message], nextCursor: null }],
      pageParams: [null],
    };
  }

  const exists = oldData.pages.some((page) => page.messages.some((item) => item.id === message.id));
  if (exists) return oldData;

  return {
    ...oldData,
    pages: oldData.pages.map((page, index) =>
      index === 0
        ? { ...page, messages: [message, ...page.messages] }
        : page,
    ),
  };
}

function replaceMessage(
  oldData: InfiniteData<MessagesPage, string | null> | undefined,
  optimisticId: string,
  realMessage: Message,
) {
  if (!oldData) return oldData;

  return {
    ...oldData,
    pages: oldData.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.id === optimisticId ? { ...realMessage, optimistic: false } : message,
      ),
    })),
  };
}

function removeMessage(
  oldData: InfiniteData<MessagesPage, string | null> | undefined,
  messageId: string,
) {
  if (!oldData) return oldData;

  return {
    ...oldData,
    pages: oldData.pages.map((page) => ({
      ...page,
      messages: page.messages.filter((message) => message.id !== messageId),
    })),
  };
}

export async function fetchMessagesPage(chatId: string, pageParam: string | null): Promise<MessagesPage> {
  let query = supabase
    .from("messages")
    .select("*", { count: "exact" })
    .eq("chat_id", chatId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (pageParam) {
    query = query.lt("created_at", pageParam);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const messages = ((data ?? []) as Message[]).map((message) => ({ ...message, optimistic: false }));
  const lastMessage = messages[messages.length - 1];

  return {
    messages,
    nextCursor: messages.length === PAGE_SIZE && lastMessage ? lastMessage.created_at : null,
    totalCount: pageParam ? null : count,
  };
}

export function useMessages(chatId: string, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: chatMessagesQueryKey(chatId),
    queryFn: ({ pageParam }) => fetchMessagesPage(chatId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: enabled && !!chatId,
  });

  const messages = useMemo(
    () => sortAscending(query.data?.pages.flatMap((page) => page.messages) ?? []),
    [query.data],
  );
  const totalCount = query.data?.pages.find((page) => typeof page.totalCount === "number")?.totalCount ?? null;

  return { ...query, messages, loadedCount: messages.length, totalCount };
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: SendMessageMutationInput) => {
      const body = input.body.trim();
      const bodyPreview = input.messageKind === "view_once" ? "View once message" : body;
      const expiresAt =
        input.messageKind === "temporary" && input.expireSeconds
          ? new Date(Date.now() + input.expireSeconds * 1000).toISOString()
          : null;

      const { data, error } = await supabase
        .from("messages")
        .insert({
          id: input.optimisticId,
          chat_id: input.chatId,
          sender_id: input.senderId,
          body_ciphertext: body,
          body_preview: bodyPreview,
          message_kind: input.messageKind,
          reply_to_id: input.replyToId ?? null,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Message;
    },
    onMutate: async (input) => {
      const queryKey = chatMessagesQueryKey(input.chatId);
      await queryClient.cancelQueries({ queryKey });

      const previousMessages =
        queryClient.getQueryData<InfiniteData<MessagesPage, string | null>>(queryKey);

      const optimisticId = input.optimisticId;
      const body = input.body.trim();
      const bodyPreview = input.messageKind === "view_once" ? "View once message" : body;
      const expiresAt =
        input.messageKind === "temporary" && input.expireSeconds
          ? new Date(Date.now() + input.expireSeconds * 1000).toISOString()
          : null;

      const optimisticMessage: Message = {
        id: optimisticId,
        chat_id: input.chatId,
        sender_id: input.senderId,
        body_ciphertext: body,
        body_preview: bodyPreview,
        message_kind: input.messageKind,
        reply_to_id: input.replyToId ?? null,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        deleted_at: null,
        optimistic: true,
      };

      queryClient.setQueryData<InfiniteData<MessagesPage, string | null>>(queryKey, (oldData) =>
        addNewestMessage(oldData, optimisticMessage),
      );

      return { previousMessages, optimisticId };
    },
    onError: (_error, input, context) => {
      const queryKey = chatMessagesQueryKey(input.chatId);
      queryClient.setQueryData(queryKey, context?.previousMessages);
    },
    onSuccess: (realMessage, input, context) => {
      const queryKey = chatMessagesQueryKey(input.chatId);
      queryClient.setQueryData<InfiniteData<MessagesPage, string | null>>(queryKey, (oldData) =>
        replaceMessage(oldData, context?.optimisticId ?? realMessage.id, realMessage),
      );
    },
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({ queryKey: chatMessagesQueryKey(input.chatId) });
    },
  });

  return {
    ...mutation,
    sendMessage: (input: SendMessageInput) =>
      mutation.mutate({ ...input, optimisticId: createClientId() }),
    sendMessageAsync: (input: SendMessageInput) =>
      mutation.mutateAsync({ ...input, optimisticId: createClientId() }),
  };
}

export function useMessagesSubscription(chatId: string, currentUserId?: string | null, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !chatId) return;

    const queryKey = chatMessagesQueryKey(chatId);
    const channel = supabase
      .channel(`chat:${chatId}:messages`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const message = payload.new as Message;
          if (!message || message.sender_id === currentUserId) return;

          queryClient.setQueryData<InfiniteData<MessagesPage, string | null>>(queryKey, (oldData) =>
            addNewestMessage(oldData, { ...message, optimistic: false }),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const message = payload.new as Message;
          if (!message) return;

          if (message.deleted_at) {
            queryClient.setQueryData<InfiniteData<MessagesPage, string | null>>(queryKey, (oldData) =>
              removeMessage(oldData, message.id),
            );
            return;
          }

          queryClient.setQueryData<InfiniteData<MessagesPage, string | null>>(queryKey, (oldData) =>
            replaceMessage(oldData, message.id, message),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId, currentUserId, enabled, queryClient]);
}
