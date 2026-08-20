(() => {
  if (window.__codexCaptureLoaded) return;
  window.__codexCaptureLoaded = true;

  const MAX_NODES = 180;
  const MAX_HTML = 45000;
  const STYLE_KEYS = [
    "display", "position", "boxSizing", "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
    "marginTop", "marginRight", "marginBottom", "marginLeft", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "gap", "rowGap", "columnGap", "gridTemplateColumns", "gridTemplateRows", "gridAutoFlow", "alignItems", "alignContent",
    "justifyContent", "justifyItems", "flexDirection", "flexWrap", "flexGrow", "flexShrink", "order", "overflow", "overflowX", "overflowY",
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textAlign", "textTransform", "textDecoration",
    "color", "backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition", "borderTopWidth", "borderRightWidth",
    "borderBottomWidth", "borderLeftWidth", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "borderRadius",
    "boxShadow", "opacity", "transform", "filter", "backdropFilter", "objectFit", "objectPosition", "cursor", "zIndex"
  ];

  let overlay;
  let tooltip;
  let active = false;
  let hovered = null;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    tooltip = document.createElement("div");
    overlay.id = "__codex_capture_overlay";
    tooltip.id = "__codex_capture_tooltip";
    const style = document.createElement("style");
    style.id = "__codex_capture_styles";
    style.textContent = `
      #__codex_capture_overlay { position: fixed; z-index: 2147483646; pointer-events: none; display: none; border: 2px solid rgba(151, 209, 255, .96); border-radius: 10px; background: rgba(108, 177, 255, .12); box-shadow: 0 0 0 1px rgba(255,255,255,.7), 0 0 0 9999px rgba(4,8,14,.2), 0 0 30px rgba(88,163,255,.45), inset 0 0 22px rgba(121,192,255,.12); transition: left 80ms ease-out, top 80ms ease-out, width 80ms ease-out, height 80ms ease-out; }
      #__codex_capture_tooltip { position: fixed; z-index: 2147483647; pointer-events: none; display: none; max-width: 290px; padding: 8px 11px; color: rgba(255,255,255,.96); border: 1px solid rgba(255,255,255,.18); border-radius: 11px; background: rgba(13,19,29,.86); box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 10px 28px rgba(0,0,0,.35); backdrop-filter: blur(18px) saturate(140%); font: 600 12px/1.25 -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: -.1px; }
      #__codex_capture_tooltip small { margin-left: 7px; color: rgba(255,255,255,.48); font-size: 10px; font-weight: 500; }
    `;
    document.documentElement.append(style, overlay, tooltip);
  }

  function isOwnElement(element) {
    return element === overlay || element === tooltip || element?.id?.startsWith("__codex_capture_");
  }

  function describe(element) {
    if (!element) return "element";
    let value = element.tagName.toLowerCase();
    if (element.id) value += `#${element.id}`;
    if (element.classList.length) value += `.${[...element.classList].slice(0, 2).join(".")}`;
    return value.slice(0, 80);
  }

  function positionOverlay(element) {
    const rect = element.getBoundingClientRect();
    overlay.style.display = "block";
    overlay.style.left = `${Math.max(0, rect.left)}px`;
    overlay.style.top = `${Math.max(0, rect.top)}px`;
    overlay.style.width = `${Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left))}px`;
    overlay.style.height = `${Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top))}px`;
    tooltip.innerHTML = `${describe(element)} <small>${Math.round(rect.width)} × ${Math.round(rect.height)}</small>`;
    tooltip.style.display = "block";
    const tipTop = rect.top > 48 ? rect.top - 39 : Math.min(innerHeight - 38, rect.bottom + 8);
    tooltip.style.left = `${Math.max(8, Math.min(innerWidth - 300, rect.left))}px`;
    tooltip.style.top = `${Math.max(8, tipTop)}px`;
  }

  function onMove(event) {
    if (!active || isOwnElement(event.target)) return;
    hovered = event.target;
    positionOverlay(hovered);
  }

  function stop() {
    active = false;
    overlay.style.display = "none";
    tooltip.style.display = "none";
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.documentElement.style.cursor = "";
  }

  function onKeyDown(event) {
    if (event.key === "Escape") stop();
  }

  function cleanClone(element, idMap) {
    const clone = element.cloneNode(true);
    const originals = [element, ...element.querySelectorAll("*")].slice(0, MAX_NODES);
    const clones = [clone, ...clone.querySelectorAll("*")].slice(0, MAX_NODES);
    clones.forEach((node, index) => {
      const original = originals[index];
      if (!original || !(node instanceof Element)) return;
      const captureId = `cc-${index}`;
      node.setAttribute("data-codex-capture-id", captureId);
      idMap.set(captureId, original);
      [...node.attributes].forEach((attribute) => {
        if (/^on/i.test(attribute.name) || attribute.name === "nonce" || attribute.name === "integrity") node.removeAttribute(attribute.name);
      });
      if (["SCRIPT", "NOSCRIPT", "STYLE", "LINK", "META"].includes(node.tagName)) node.remove();
    });
    return clone.outerHTML.slice(0, MAX_HTML);
  }

  function captureStyles(idMap) {
    const styles = {};
    for (const [id, element] of idMap) {
      const computed = getComputedStyle(element);
      const entry = {};
      STYLE_KEYS.forEach((key) => {
        const value = computed[key];
        if (value && value !== "normal" && value !== "none" && value !== "0px" && value !== "auto" && value !== "rgba(0, 0, 0, 0)") entry[key] = value;
      });
      styles[id] = entry;
    }
    return styles;
  }

  function collectAssets(element) {
    const assets = new Set();
    [element, ...element.querySelectorAll("img, source, video, svg, [style]")].slice(0, MAX_NODES).forEach((node) => {
      if (node.currentSrc) assets.add(node.currentSrc);
      if (node.src) assets.add(node.src);
      const background = getComputedStyle(node).backgroundImage;
      for (const match of background.matchAll(/url\(["']?(.*?)["']?\)/g)) {
        try { assets.add(new URL(match[1], location.href).href); } catch (_) {}
      }
    });
    return [...assets].filter((url) => /^https?:/.test(url)).slice(0, 30);
  }

  function collectBehavior(element) {
    const results = [];
    const interactive = [element, ...element.querySelectorAll("a, button, input, select, textarea, details, summary, [role], [tabindex]")].slice(0, 60);
    interactive.forEach((node) => {
      const label = (node.getAttribute("aria-label") || node.innerText || node.value || node.placeholder || node.tagName).trim().replace(/\s+/g, " ").slice(0, 80);
      const type = node.getAttribute("role") || node.type || node.tagName.toLowerCase();
      const destination = node.href ? ` → ${node.href}` : "";
      results.push(`${type}: “${label}”${destination}`);
    });
    return [...new Set(results)].slice(0, 40);
  }

  function mostCommon(values) {
    const counts = new Map();
    values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([value]) => value);
  }

  function collectTokens(element) {
    const nodes = [element, ...element.querySelectorAll("*")].slice(0, MAX_NODES);
    const computed = nodes.map((node) => getComputedStyle(node));
    return {
      colors: mostCommon(computed.flatMap((style) => [style.color, style.backgroundColor, style.borderTopColor])),
      fonts: mostCommon(computed.map((style) => `${style.fontFamily} / ${style.fontSize} / ${style.fontWeight}`)),
      radii: mostCommon(computed.map((style) => style.borderRadius)),
      shadows: mostCommon(computed.map((style) => style.boxShadow).filter((value) => value !== "none"))
    };
  }

  async function onClick(event) {
    if (!active || !hovered || isOwnElement(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const selected = hovered;
    const rect = selected.getBoundingClientRect();
    const idMap = new Map();
    const html = cleanClone(selected, idMap);
    const behavior = collectBehavior(selected);
    const data = {
      capturedAt: new Date().toISOString(),
      page: { url: location.href, title: document.title, viewport: { width: innerWidth, height: innerHeight, devicePixelRatio } },
      summary: { name: describe(selected), width: Math.round(rect.width), height: Math.round(rect.height), nodes: idMap.size, interactive: behavior.length },
      html,
      styles: captureStyles(idMap),
      tokens: collectTokens(selected),
      assets: collectAssets(selected),
      behavior
    };
    await chrome.storage.local.set({ capture: data });
    stop();
    showConfirmation(selected);
  }

  function showConfirmation(element) {
    positionOverlay(element);
    overlay.style.borderColor = "rgba(139, 240, 200, .96)";
    overlay.style.background = "rgba(84, 220, 166, .12)";
    tooltip.innerHTML = `Captured <small>Open Codex Capture to generate</small>`;
    setTimeout(() => {
      overlay.style.display = "none";
      tooltip.style.display = "none";
      overlay.style.borderColor = "";
      overlay.style.background = "";
    }, 1500);
  }

  function start() {
    ensureOverlay();
    active = true;
    hovered = null;
    document.documentElement.style.cursor = "crosshair";
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "START_CODEX_CAPTURE") {
      start();
      sendResponse({ ok: true });
    }
  });
})();
