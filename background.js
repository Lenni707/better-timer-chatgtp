async function ensureOffscreenDocument() {
  const existing = await chrome.offscreen.hasDocument?.();
  if (existing) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play timer sound when popup is closed"
  });
}

async function playDingSound() {
  await ensureOffscreenDocument();
  await chrome.runtime.sendMessage({ type: "play-ding" });
}

function clearBadge() {
  chrome.action.setBadgeText({ text: "" });
}

function formatBadge(seconds) {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  } else {
    return `${seconds}s`;
  }
}

async function updateBadge() {
  const { running, endTime } = await chrome.storage.local.get(["running", "endTime"]);
  if (running && endTime) {
    const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    if (remaining > 0) {
      chrome.action.setBadgeText({ text: formatBadge(remaining) });
      chrome.action.setBadgeBackgroundColor({ color: "#3b4cca" });
    } else clearBadge();
  } else clearBadge();
}

setInterval(updateBadge, 1000);
updateBadge();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ running: false, remaining: 0, total: 0 });
  clearBadge();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "start-timer") {
    chrome.alarms.create("timer-finished", { delayInMinutes: msg.seconds / 60 });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "timer-finished") {
    clearBadge();
    await playDingSound();

    chrome.notifications.create({
      type: "basic",
      iconUrl: "wall-clock.png",
      title: "⏰ Time’s up!",
      message: "Your timer has finished.",
      priority: 2
    });

    await chrome.storage.local.set({ running: false, remaining: 0, endTime: null, total: 0 });

    try {
      await chrome.action.openPopup();
    } catch {
      console.log("Popup reopen not supported on this Chrome version.");
    }
  }
});
