import * as ScreenCapture from "expo-screen-capture";

/** Block screenshots / screen recording for a given tag. Call per chat. */
export async function blockScreenshots(tag: string = "default"): Promise<void> {
  try {
    await ScreenCapture.preventScreenCaptureAsync(tag);
  } catch {
    // Silently fail on simulators / web
  }
}

/** Lift the block for a given tag (e.g. when permission is granted). */
export async function unblockScreenshots(tag: string = "default"): Promise<void> {
  try {
    await ScreenCapture.allowScreenCaptureAsync(tag);
  } catch {
    // Silently fail
  }
}

type Subscription = { remove: () => void };

/**
 * Listen for screenshot attempts.
 */
export function addScreenshotListener(cb: () => void): Subscription {
  try {
    const sub = ScreenCapture.addScreenshotListener(cb);
    if (sub) return sub;
  } catch {}
  return { remove: () => {} };
}
