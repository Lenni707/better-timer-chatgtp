chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ running: false, remaining: 0, total: 0 });
  });
  
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "start-timer") {
      chrome.alarms.create("timer-finished", { delayInMinutes: msg.seconds / 60 });
    }
  });
  
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "timer-finished") {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "wall-clock.png",
        title: "⏰ Time’s up!",
        message: "Your timer has finished.",
        priority: 2,
      });
      const ding = new Audio(chrome.runtime.getURL("ding.mp3"));
      try { ding.play(); } catch {}
      await chrome.storage.local.set({ running: false, remaining: 0, endTime: null, total: 0 });
    }
  });
  