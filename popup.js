const DEFAULTS = {
  target: "React",
  styling: "Tailwind CSS",
  mode: "UI + behavior",
  responsive: true,
  accessibility: true,
  assets: true
};

let preferences = { ...DEFAULTS };
let capture = null;

const $ = (selector) => document.querySelector(selector);
const stateLabel = $("#stateLabel");
const captureTitle = $("#captureTitle");
const captureMeta = $("#captureMeta");
const selectButton = $("#selectButton");
const generateButton = $("#generateButton");
const generateHint = $("#generateHint");
const toast = $("#toast");

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToTab(message) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active tab");
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function render() {
  $("#target").value = preferences.target;
  $("#styling").value = preferences.styling;
  $("#mode").value = preferences.mode;
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", Boolean(preferences[chip.dataset.pref]));
  });

  if (!capture) {
    stateLabel.textContent = "Ready to capture";
    captureTitle.innerHTML = "Select a section<br />from any website.";
    captureMeta.textContent = "We’ll read its structure, visual rules and interactive clues.";
    selectButton.querySelector("span").textContent = "Select on page";
    generateButton.disabled = true;
    generateHint.textContent = "Select a section first";
    return;
  }

  stateLabel.textContent = "Section captured";
  captureTitle.textContent = capture.summary.name;
  const motionCount = (capture.motion?.cssAnimations?.length || 0) + Object.keys(capture.motion?.sampledTracks || {}).length;
  captureMeta.textContent = `${capture.summary.width} × ${capture.summary.height}px · ${capture.summary.nodes} nodes · ${motionCount} motion tracks`;
  selectButton.querySelector("span").textContent = "Select another section";
  generateButton.disabled = false;
  generateHint.textContent = `Build with ${preferences.target} + ${preferences.styling}`;
}

async function savePreferences() {
  await chrome.storage.local.set({ preferences });
  render();
}

function buildPrompt(data) {
  const options = [];
  if (preferences.responsive) options.push("Make it responsive and infer sensible mobile/tablet breakpoints.");
  if (preferences.accessibility) options.push("Use semantic HTML, keyboard support, visible focus states and appropriate ARIA only where needed.");
  if (preferences.assets) options.push("Reuse the referenced public assets when practical; otherwise create visually faithful placeholders.");

  const motion = data.motion || { cssAnimations: [], sampledTracks: {} };
  return `# Implementation task\n\nRecreate the captured interface section as a production-ready ${preferences.target} implementation using ${preferences.styling}.\n\n## Goal\nMatch the visual hierarchy, layout, typography, colors, spacing, borders, radii, continuous motion and available interaction clues. Do not copy analytics, trackers, unrelated page chrome or hidden content.\n\n## Capture mode\n${preferences.mode}\n\n## Requirements\n- Keep the implementation modular and easy to integrate into an existing project.\n- Preserve visible text, controls and meaningful states.\n- Reproduce continuous animations from the motion capture, including timing, easing, direction, looping and coordination between elements.\n- Treat sampled tracks as observed evidence for JavaScript-driven motion. Simplify noisy sub-pixel values into intentional keyframes without removing the motion.\n- Respect prefers-reduced-motion with an equivalent static state.\n- Do not invent a proprietary backend. Mock unavailable network behavior and clearly mark integration points.\n- ${options.join("\n- ")}\n\n## Source page\n- URL: ${data.page.url}\n- Title: ${data.page.title}\n- Viewport: ${data.page.viewport.width} × ${data.page.viewport.height}\n- Selected element: ${data.summary.name}\n- Bounds: ${data.summary.width} × ${data.summary.height}px\n\n## Detected behavior\n${data.behavior.length ? data.behavior.map((item) => `- ${item}`).join("\n") : "- No explicit interactive elements detected. Infer only obvious UI states."}\n\n## Motion specification\nThe capture combines browser animation metadata with visual samples recorded over time. Element IDs match the temporary data-codex-capture-id attributes in the HTML tree.\n\`\`\`json\n${JSON.stringify(motion, null, 2)}\n\`\`\`\n\n## Visual tokens\n\`\`\`json\n${JSON.stringify(data.tokens, null, 2)}\n\`\`\`\n\n## Element tree\n\`\`\`html\n${data.html}\n\`\`\`\n\n## Computed style map\nStyles are keyed by the temporary data-codex-capture-id attributes in the element tree.\n\`\`\`json\n${JSON.stringify(data.styles, null, 2)}\n\`\`\`\n\n## Assets\n${data.assets.length ? data.assets.map((asset) => `- ${asset}`).join("\n") : "- No public image assets detected."}\n\nBefore coding, briefly state assumptions and summarize the detected motion. Then implement the component and include concise run/integration instructions.`;
}

selectButton.addEventListener("click", async () => {
  try {
    await sendToTab({ type: "START_CODEX_CAPTURE" });
    window.close();
  } catch (error) {
    showToast("This page can’t be inspected");
  }
});

generateButton.addEventListener("click", async () => {
  if (!capture) return;
  const prompt = buildPrompt(capture);
  await navigator.clipboard.writeText(prompt);
  generateHint.textContent = "Copied — paste into Codex";
  showToast("Prompt copied");
  setTimeout(render, 1800);
});

$("#resetButton").addEventListener("click", async () => {
  capture = null;
  await chrome.storage.local.remove("capture");
  render();
  showToast("Capture cleared");
});

document.querySelectorAll("select").forEach((select) => {
  select.addEventListener("change", () => {
    preferences[select.id] = select.value;
    savePreferences();
  });
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const key = chip.dataset.pref;
    preferences[key] = !preferences[key];
    savePreferences();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.altKey && event.key.toLowerCase() === "s") selectButton.click();
});

chrome.storage.local.get(["preferences", "capture"]).then((stored) => {
  preferences = { ...DEFAULTS, ...(stored.preferences || {}) };
  capture = stored.capture || null;
  render();
});
