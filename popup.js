const mainView = document.getElementById("main-view");
const finishedView = document.getElementById("finished-view");
const newTimerBtn = document.getElementById("new-timer");

const display = document.getElementById("time-display");
const progress = document.getElementById("progress-circle");
const input = document.getElementById("time-input");
const addBtns = document.querySelectorAll(".add-buttons button");
const startBtn = document.getElementById("start");
const resetBtn = document.getElementById("reset");

const RADIUS = 80;
const CIRC = 2 * Math.PI * RADIUS;
progress.style.strokeDasharray = CIRC;
progress.style.strokeDashoffset = CIRC;

// ✅ Listen for background "timer-finished" messages
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === "timer-finished") {
    await chrome.storage.local.set({ timerFinished: true });
    showCorrectView();
  }
});

function parseTime(str) {
  if (!str) return 0;
  if (str.includes(":")) {
    const [m, s] = str.split(":").map(Number);
    return (m || 0) * 60 + (s || 0);
  }
  return Number(str) || 0;
}

function fmt(sec) {
  const m = Math.floor(sec / 60).toString().padStart(1, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function showCorrectView() {
  const { timerFinished } = await chrome.storage.local.get("timerFinished");
  if (timerFinished) {
    mainView.style.display = "none";
    finishedView.style.display = "flex";
  } else {
    mainView.style.display = "block";
    finishedView.style.display = "none";
  }
}

async function updateUI() {
  const { endTime, running, total } = await chrome.storage.local.get(["endTime", "running", "total"]);
  let remaining = 0;

  if (running && endTime) {
    remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
  } else {
    const { remaining: stored } = await chrome.storage.local.get("remaining");
    remaining = stored || 0;
  }

  display.textContent = fmt(remaining);
  if (total > 0) {
    const offset = CIRC * (1 - remaining / total);
    progress.style.strokeDashoffset = offset;
  } else {
    progress.style.strokeDashoffset = CIRC;
  }

  startBtn.textContent = running ? "⏸" : "▶";
}

setInterval(updateUI, 1000);
updateUI();
showCorrectView();

// "Start New Timer" button
newTimerBtn.onclick = async () => {
  await chrome.storage.local.set({ timerFinished: false });
  mainView.style.display = "block";
  finishedView.style.display = "none";
  display.textContent = "00:00";
  input.value = "";
};

// Disable input effects while running
input.addEventListener("input", async () => {
  const { running } = await chrome.storage.local.get("running");
  if (running) return;
  const seconds = parseTime(input.value);
  display.textContent = fmt(seconds);
  await chrome.storage.local.set({ remaining: seconds, total: seconds });
});

// ✅ Press Enter in input starts the timer
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    startBtn.click();
  }
});

// ▶ Start / ⏸ Pause
startBtn.onclick = async () => {
  const { running } = await chrome.storage.local.get("running");
  if (!running) {
    let seconds = parseTime(input.value);
    const stored = await chrome.storage.local.get("remaining");
    if (stored.remaining > 0) seconds = stored.remaining;
    if (seconds <= 0) return;

    const endTime = Date.now() + seconds * 1000;
    await chrome.storage.local.set({
      running: true,
      endTime,
      total: seconds,
      remaining: seconds,
      timerFinished: false
    });
    chrome.runtime.sendMessage({ type: "start-timer", seconds });
    startBtn.textContent = "⏸";
  } else {
    const { endTime } = await chrome.storage.local.get("endTime");
    const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    await chrome.storage.local.set({ running: false, remaining, endTime: null });
    startBtn.textContent = "▶";
  }
  updateUI();
};

// ↺ Reset
resetBtn.onclick = async () => {
  await chrome.storage.local.set({
    running: false,
    remaining: 0,
    endTime: null,
    total: 0,
    timerFinished: false
  });

  input.value = "";
  progress.style.strokeDashoffset = CIRC;
  display.textContent = fmt(0); // "00:00"
  startBtn.textContent = "▶";
};

// ➕ Add time buttons
addBtns.forEach((btn) => {
  btn.onclick = async () => {
    const add = parseInt(btn.dataset.add);
    const data = await chrome.storage.local.get(["remaining", "running", "endTime", "total"]);
    let { remaining, running, endTime, total } = data;
    remaining = remaining || 0;
    total = total || 0;

    if (running && endTime) {
      const currentRemaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000)) + add;
      const newEnd = Date.now() + currentRemaining * 1000;
      await chrome.storage.local.set({ endTime: newEnd, total: total + add });
    } else {
      const newRemaining = remaining + add;
      await chrome.storage.local.set({ remaining: newRemaining, total: newRemaining });
      input.value = fmt(newRemaining);
      display.textContent = fmt(newRemaining);
    }
    updateUI();
  };
});
