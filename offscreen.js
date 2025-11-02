chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "play-ding") {
      try {
        const audio = new Audio(chrome.runtime.getURL("ding.mp3"));
        audio.volume = 1.0;
        audio.play().catch(err => console.warn("Audio play failed:", err));
      } catch (e) {
        console.error("Offscreen audio error:", e);
      }
    }
  });
  