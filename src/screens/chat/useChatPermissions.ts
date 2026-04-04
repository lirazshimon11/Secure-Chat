import { useState, useEffect } from "react";
import { Chat, Profile } from "@/lib/types";
import { useScreenshots } from "@/context/ScreenshotContext";
import { blockScreenshots, unblockScreenshots, addScreenshotListener } from "@/lib/screenshotPermission";

export function useChatPermissions(chat: Chat, groupMembers: Profile[], sendMessage: (p: any) => void) {
  const { activePermissions, myRequests, requestScreenshotPermission } = useScreenshots();
  const hasScreenshotPerm = (activePermissions[chat.id] ?? 0) > Date.now();
  const [screenshotBanner, setScreenshotBanner] = useState<"none" | "approved">("none");
  const [, setBannerTick] = useState(0);

  useEffect(() => {
    if (!chat.is_group) return;
    const tag = `sc-${chat.id}`;
    if (hasScreenshotPerm) {
      void unblockScreenshots(tag);
    } else {
      void blockScreenshots(tag);
    }
    return () => { void unblockScreenshots(tag); };
  }, [hasScreenshotPerm, chat.id, chat.is_group]);

  useEffect(() => {
    if (!chat.is_group) return;
    const sub = addScreenshotListener(() => {
      if ((activePermissions[chat.id] ?? 0) > Date.now()) return;
      const curReq = myRequests[chat.id];
      if (curReq?.status === "pending") return;
      
      const memberIds = groupMembers.map((m) => m.id);
      void requestScreenshotPermission(chat.id, memberIds).then((result) => {
        if (result?.id) {
          sendMessage({ chatId: chat.id, body: `[SCREENSHOT_REQUEST]:${result.id}`, messageKind: "standard" });
        }
      });
    });
    return () => sub.remove();
  }, [chat.id, chat.is_group, hasScreenshotPerm, groupMembers, myRequests, requestScreenshotPermission, sendMessage]);

  useEffect(() => {
    if (!chat.is_group) return;
    const req = myRequests[chat.id];
    if (req?.status === "approved" && hasScreenshotPerm) {
      setScreenshotBanner("approved");
    } else {
      setScreenshotBanner("none");
    }
  }, [myRequests[chat.id]?.status, chat.id, chat.is_group, hasScreenshotPerm]);

  useEffect(() => {
    if (screenshotBanner !== "approved") return;
    const iv = setInterval(() => setBannerTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [screenshotBanner]);

  return {
    hasScreenshotPerm,
    screenshotBanner,
    activePermissions,
    myRequests,
    requestScreenshotPermission
  };
}
