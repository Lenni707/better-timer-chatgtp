// -----------------------------
// Better Timer - background.js
// -----------------------------

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play sound when timer ends"
  });
}

async function playDing() {
  await ensureOffscreen();
  try {
    await chrome.runtime.sendMessage({ type: "play-ding" });
  } catch (err) {
    console.warn("Offscreen page not ready, retrying…", err);
    setTimeout(() => chrome.runtime.sendMessage({ type: "play-ding" }), 300);
  }
}

// ------------------ Badge Handling ------------------
function clearBadge() {
  chrome.action.setBadgeText({ text: "" });
}

function fmt(sec) {
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }
  return `${sec}s`;
}

async function updateBadge() {
  const { running, endTime } = await chrome.storage.local.get(["running", "endTime"]);
  if (running && endTime) {
    const rem = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    if (rem > 0) {
      chrome.action.setBadgeText({ text: fmt(rem) });
      chrome.action.setBadgeBackgroundColor({ color: "#3b4cca" }); // naval blue
      return;
    }
  }
  clearBadge();
}
setInterval(updateBadge, 1000);
updateBadge();

// ----------------- Install Defaults -----------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ running: false, remaining: 0, total: 0, timerFinished: false });
  clearBadge();
});

// ---------------- Timer Start Handling ---------------
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "start-timer") {
    chrome.alarms.create("done", { delayInMinutes: msg.seconds / 60 });
  }
});

// ---------------- Timer Finished ---------------------
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "done") return;

  await playDing();

  chrome.notifications.create({
    type: "basic",
    iconUrl: "wall-clock.png",
    title: "⏰ Time’s up!",
    message: "Your timer has finished.",
    priority: 2
  });

  await chrome.storage.local.set({
    running: false,
    remaining: 0,
    endTime: null,
    total: 0,
    timerFinished: true
  });

  // ✅ Tell any open popup to switch instantly
  chrome.runtime.sendMessage({ type: "timer-finished" });

  clearBadge();

  try {
    await chrome.action.openPopup();
  } catch (e) {
    console.log("openPopup() not supported; focusing instead.");
    const views = await chrome.extension.getViews({ type: "popup" });
    if (views.length === 0) chrome.action.openPopup();
  }
});
