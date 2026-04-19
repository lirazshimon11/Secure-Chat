import { useState, useEffect } from "react";
import { Chat, Profile } from "@/lib/types";
import { useScreenshots } from "@/context/ScreenshotContext";
import { addScreenshotListener } from "@/lib/screenshotPermission";
import { preventScreenCaptureAsync, allowScreenCaptureAsync } from "expo-screen-capture";

export function useChatPermissions(chat: Chat, groupMembers: Profile[], sendMessage: (p: any) => void, isSuspended: boolean = false) {
  const { activePermissions, myRequests, requestScreenshotPermission, hasPermission } = useScreenshots();
  const hasScreenshotPerm = hasPermission(chat.id);
  const [screenshotHold, setScreenshotHold] = useState(false);

  useEffect(() => {
    if (!chat.is_group) return;
    const tag = `sc-${chat.id}`;
    if (hasScreenshotPerm || isSuspended) {
      void allowScreenCaptureAsync(tag);
    } else {
      void preventScreenCaptureAsync(tag);
    }
    return () => { void allowScreenCaptureAsync(tag); };
  }, [hasScreenshotPerm, chat.id, chat.is_group, isSuspended]);

  useEffect(() => {
    if (!chat.is_group) return;
    const sub = addScreenshotListener(() => {
      if (hasScreenshotPerm) return;
      setScreenshotHold(true);
      setTimeout(() => setScreenshotHold(false), 800);
      const curReq = myRequests[chat.id];
      if (curReq?.status === "pending") return;
      const memberIds = groupMembers.map((m) => m.id);
      void requestScreenshotPermission(chat.id, memberIds).then((result) => {
        if (result?.pollBody) {
          sendMessage({ chatId: chat.id, body: result.pollBody, messageKind: "standard" });
        }
      });
    });
    return () => sub.remove();
  }, [chat.id, chat.is_group, hasScreenshotPerm, groupMembers, myRequests, requestScreenshotPermission, sendMessage]);

  return {
    hasScreenshotPerm,
    screenshotHold,
    activePermissions,
    myRequests,
    requestScreenshotPermission,
    approveRequest: useScreenshots().approveRequest,
    denyRequest: useScreenshots().denyRequest,
    revokeApproval: useScreenshots().revokeApproval
  };
}
