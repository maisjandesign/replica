const DEFAULTS = {
  target: "React", styling: "Tailwind CSS", mode: "UI + behavior", captureKind: "exact",
  responsive: true, accessibility: true, assets: true
};

let preferences = { ...DEFAULTS };
let capture = null;
let promptDismissed = false;
const $ = (selector) => document.querySelector(selector);
const stateLabel = $("#stateLabel");
const captureTitle = $("#captureTitle");
const captureMeta = $("#captureMeta");
const selectButton = $("#selectButton");
const generateButton = $("#generateButton");
const generateHint = $("#generateHint");
const capturePreview = $("#capturePreview");
const previewImage = $("#previewImage");
const previewBadge = $("#previewBadge");
const secondaryActions = $("#secondaryActions");
const promptSheet = $("#promptSheet");
const promptOutput = $("#promptOutput");
const toast = $("#toast");

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function hydrateLiveBackdrop() {
  try {
    const tab = await activeTab();
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 68 });
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const cropWidth = Math.min(image.naturalWidth, Math.round(390 * ratio));
    const cropHeight = Math.min(image.naturalHeight, Math.round(590 * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    canvas.getContext("2d").drawImage(
      image,
      Math.max(0, image.naturalWidth - cropWidth),
      0,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );
    document.querySelector(".shell").style.setProperty("--live-backdrop", `url(${canvas.toDataURL("image/jpeg", .72)})`);
    document.querySelector(".shell").classList.add("backdrop-ready");
  } catch (_) {
    document.querySelector(".shell").classList.add("backdrop-fallback");
  }
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
  document.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("active", Boolean(preferences[chip.dataset.pref])));
  document.querySelectorAll("[data-kind]").forEach((button) => button.setAttribute("aria-checked", String(button.dataset.kind === preferences.captureKind)));

  if (!capture) {
    promptSheet.hidden = true;
    stateLabel.textContent = preferences.captureKind === "exact" ? "Exact capture ready" : "Quick capture ready";
    captureTitle.innerHTML = "Turn any interface<br />into a Codex prompt.";
    captureMeta.textContent = preferences.captureKind === "exact"
      ? "Capture pixels, structure, motion and visual rules in one pass."
      : "Capture structure, styles and motion with a smaller payload.";
    capturePreview.hidden = true;
    secondaryActions.hidden = true;
    selectButton.querySelector("span").textContent = "Select on page";
    generateButton.disabled = true;
    generateHint.textContent = "Select a section first";
    return;
  }

  const isExact = Boolean(capture.screenshot?.dataUrl);
  stateLabel.textContent = isExact ? "Exact capture ready" : "Section captured";
  captureTitle.textContent = capture.summary.name;
  const motionCount = (capture.motion?.cssAnimations?.length || 0) + (capture.motion?.declaredAnimations?.length || 0) + Object.keys(capture.motion?.sampledTracks || {}).length;
  captureMeta.textContent = `${capture.summary.width} × ${capture.summary.height}px · ${capture.summary.nodes} nodes · ${motionCount} motion tracks`;
  capturePreview.hidden = !isExact;
  secondaryActions.hidden = !isExact;
  if (isExact) {
    previewImage.src = capture.screenshot.dataUrl;
    previewBadge.textContent = capture.screenshot.coverage?.complete ? "Exact · full section" : "Exact · visible crop";
  }
  selectButton.querySelector("span").textContent = "Select another section";
  generateButton.disabled = false;
  generateHint.textContent = `Build with ${preferences.target} + ${preferences.styling}`;

  promptOutput.value = buildPrompt(capture);
  $("#promptElementName").textContent = capture.summary.name;
  $("#promptStats").textContent = `${capture.summary.width} × ${capture.summary.height}px · ${motionCount} motion tracks`;
  $("#promptPreview").src = capture.screenshot?.dataUrl || "";
  $("#promptPreview").hidden = !isExact;
  $(".prompt-summary > span").textContent = isExact ? "Exact" : "Quick";
  promptSheet.hidden = promptDismissed;
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
  const motion = data.motion || { cssAnimations: [], declaredAnimations: [], sampledTracks: {} };
  const exactEvidence = data.screenshot?.dataUrl
    ? `A pixel reference is included in the downloaded reference pack. Treat it as the visual source of truth. Its coverage is ${data.screenshot.coverage?.complete ? "the full selected section" : "the visible portion of the selected section"}.`
    : "No pixel reference was captured; use the DOM and computed styles as visual evidence.";

  return `# Implementation task\n\nRecreate the captured interface section as a production-ready ${preferences.target} implementation using ${preferences.styling}.\n\n## Goal\nMatch the source as closely as possible: composition, typography, spacing, colors, effects, responsive behavior, entrance motion, continuous motion and interaction clues. Do not copy analytics, trackers, unrelated page chrome or hidden content.\n\n## Capture fidelity\n${data.captureKind || "quick"}\n\n${exactEvidence}\n\n## Requirements\n- Keep the implementation modular and easy to integrate into an existing project.\n- Use the screenshot to resolve visual ambiguity, then use the element tree and computed style map for exact measurements.\n- Preserve visible text, controls, pseudo-elements, CSS custom properties and meaningful states.\n- Preserve entrance/reveal animations separately from continuous illustration loops so one animation does not overwrite the other. Use wrapper elements when both affect the same component.\n- Reproduce continuous animations from the motion capture, including timing, easing, direction, looping and coordination between elements.\n- Declared animations may describe entrance motion that finished before recording began. Recreate them using the captured names/timing as evidence.\n- If no entrance animation was captured, add a restrained one-time reveal for the section hierarchy: opacity plus a small vertical offset, with subtle stagger for sibling cards. Do not replay it on routine interactions.\n- Treat sampled tracks as observed evidence for JavaScript-driven motion. Simplify noisy sub-pixel values into intentional keyframes without removing the motion.\n- Respect prefers-reduced-motion with an equivalent static state.\n- Do not invent a proprietary backend. Mock unavailable network behavior and clearly mark integration points.\n- ${options.join("\n- ")}\n\n## Source page\n- URL: ${data.page.url}\n- Title: ${data.page.title}\n- Viewport: ${data.page.viewport.width} × ${data.page.viewport.height}\n- Selected element: ${data.summary.name}\n- Bounds: ${data.summary.width} × ${data.summary.height}px\n\n## Detected behavior\n${data.behavior.length ? data.behavior.map((item) => `- ${item}`).join("\n") : "- No explicit interactive elements detected. Infer only obvious UI states."}\n\n## Motion specification\nElement IDs match the temporary data-codex-capture-id attributes in the HTML tree.\n\`\`\`json\n${JSON.stringify(motion, null, 2)}\n\`\`\`\n\n## Visual tokens and CSS variables\n\`\`\`json\n${JSON.stringify({ ...data.tokens, cssVariables: data.cssVariables || {} }, null, 2)}\n\`\`\`\n\n## Element tree\n\`\`\`html\n${data.html}\n\`\`\`\n\n## Computed style map\n\`\`\`json\n${JSON.stringify(data.styles, null, 2)}\n\`\`\`\n\n## Pseudo-elements\n\`\`\`json\n${JSON.stringify(data.pseudoStyles || {}, null, 2)}\n\`\`\`\n\n## Assets\n${data.assets.length ? data.assets.map((asset) => `- ${asset}`).join("\n") : "- No public image assets detected."}\n\nBefore coding, briefly state assumptions and summarize both entrance and continuous motion. Then implement the component and include concise run/integration instructions.`;
}

function camelToKebab(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function styleRule(selector, declarations) {
  const body = Object.entries(declarations || {}).map(([key, value]) => `  ${camelToKebab(key)}: ${value};`).join("\n");
  return body ? `${selector} {\n${body}\n}` : "";
}

function buildSnapshotHtml(data) {
  const rules = Object.entries(data.styles || {}).map(([id, values]) => styleRule(`[data-codex-capture-id="${id}"]`, values));
  Object.entries(data.pseudoStyles || {}).forEach(([id, pseudos]) => {
    ["before", "after"].forEach((pseudo) => {
      if (pseudos[pseudo]) rules.push(styleRule(`[data-codex-capture-id="${id}"]::${pseudo}`, pseudos[pseudo]));
    });
  });
  const variables = Object.entries(data.cssVariables || {}).map(([key, value]) => `  ${key}: ${value};`).join("\n");
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Codex Capture snapshot</title>\n<style>\n:root {\n${variables}\n}\n* { box-sizing: border-box; }\nbody { margin: 0; min-height: 100vh; }\n${rules.filter(Boolean).join("\n")}\n</style>\n</head>\n<body>\n${data.html}\n</body>\n</html>`;
}

function downloadReferencePack(data) {
  const pack = {
    format: "codex-capture-reference-pack", version: "0.7.2", createdAt: new Date().toISOString(),
    instructions: "Paste prompt.md into Codex and attach the reference image when exact visual matching matters. snapshot.html is a reconstruction aid.",
    files: {
      "prompt.md": buildPrompt(data),
      "snapshot.html": buildSnapshotHtml(data),
      "capture.json": JSON.stringify({ ...data, screenshot: data.screenshot ? { ...data.screenshot, dataUrl: "See referenceImageDataUrl" } : null }, null, 2)
    },
    referenceImageDataUrl: data.screenshot?.dataUrl || null
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `codex-capture-${Date.now()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

selectButton.addEventListener("click", async () => {
  try {
    await sendToTab({ type: "START_CODEX_CAPTURE", captureKind: preferences.captureKind });
    window.close();
  } catch (_) { showToast("This page can’t be inspected"); }
});

generateButton.addEventListener("click", async () => {
  if (!capture) return;
  await navigator.clipboard.writeText(buildPrompt(capture));
  generateHint.textContent = "Copied — paste into Codex";
  showToast("Prompt copied");
  setTimeout(render, 1800);
});

$("#copyPromptButton").addEventListener("click", async () => {
  if (!capture) return;
  await navigator.clipboard.writeText(promptOutput.value);
  $("#copyPromptButton").classList.add("copied");
  $("#copyPromptButton strong").textContent = "Prompt copied";
  $("#copyPromptButton small").textContent = "Paste it directly into Codex";
  showToast("Prompt copied");
  setTimeout(() => {
    $("#copyPromptButton").classList.remove("copied");
    $("#copyPromptButton strong").textContent = "Copy prompt";
  }, 1800);
});

$("#closePromptButton").addEventListener("click", () => {
  promptDismissed = true;
  promptSheet.hidden = true;
  selectButton.focus();
});

$("#sheetRecaptureButton").addEventListener("click", async () => {
  try {
    await sendToTab({ type: "START_CODEX_CAPTURE", captureKind: preferences.captureKind });
    window.close();
  } catch (_) { showToast("Open a regular webpage and try again"); }
});

$("#sheetDownloadButton").addEventListener("click", () => {
  if (!capture) return;
  downloadReferencePack(capture);
  showToast("Reference pack downloaded");
});

$("#copyImageButton").addEventListener("click", async () => {
  if (!capture?.screenshot?.dataUrl) return;
  try {
    const source = await fetch(capture.screenshot.dataUrl).then((response) => response.blob());
    await navigator.clipboard.write([new ClipboardItem({ [source.type]: source })]);
    showToast("Reference image copied");
  } catch (_) { showToast("Image copy is not supported here"); }
});

$("#downloadButton").addEventListener("click", () => {
  if (!capture) return;
  downloadReferencePack(capture);
  showToast("Reference pack downloaded");
});

$("#resetButton").addEventListener("click", async () => {
  capture = null;
  await chrome.storage.local.remove("capture");
  render();
  showToast("Capture cleared");
});

document.querySelectorAll("select").forEach((select) => select.addEventListener("change", () => {
  preferences[select.id] = select.value;
  savePreferences();
}));
document.querySelectorAll(".chip").forEach((chip) => chip.addEventListener("click", () => {
  preferences[chip.dataset.pref] = !preferences[chip.dataset.pref];
  savePreferences();
}));
document.querySelectorAll("[data-kind]").forEach((button) => button.addEventListener("click", () => {
  preferences.captureKind = button.dataset.kind;
  savePreferences();
}));
document.addEventListener("keydown", (event) => {
  if (event.altKey && event.key.toLowerCase() === "s") selectButton.click();
});

chrome.storage.local.get(["preferences", "capture"]).then((stored) => {
  preferences = { ...DEFAULTS, ...(stored.preferences || {}) };
  capture = stored.capture || null;
  render();
});

hydrateLiveBackdrop();
