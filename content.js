(() => {
  if (window.__codexCaptureLoaded) return;
  window.__codexCaptureLoaded = true;

  const MAX_NODES = 180;
  const MAX_HTML = 45000;
  const MOTION_DURATION_MS = 2400;
  const MOTION_SAMPLE_MS = 200;
  const MAX_MOTION_NODES = 80;
  const MAX_MOTION_TRACKS = 30;
  const MOTION_KEYS = ["transform", "opacity", "filter", "backgroundPosition"];
  const STYLE_KEYS = [
    "display", "position", "boxSizing", "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
    "marginTop", "marginRight", "marginBottom", "marginLeft", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "gap", "rowGap", "columnGap", "gridTemplateColumns", "gridTemplateRows", "gridAutoFlow", "alignItems", "alignContent",
    "justifyContent", "justifyItems", "flexDirection", "flexWrap", "flexGrow", "flexShrink", "order", "overflow", "overflowX", "overflowY",
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textAlign", "textTransform", "textDecoration",
    "color", "backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition", "borderTopWidth", "borderRightWidth",
    "borderBottomWidth", "borderLeftWidth", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "borderRadius",
    "boxShadow", "opacity", "transform", "filter", "backdropFilter", "objectFit", "objectPosition", "cursor", "zIndex",
    "animationName", "animationDuration", "animationDelay", "animationTimingFunction", "animationIterationCount",
    "animationDirection", "animationFillMode", "animationPlayState", "transitionProperty", "transitionDuration",
    "transitionDelay", "transitionTimingFunction"
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

  function stop(hide = true) {
    active = false;
    if (hide) {
      overlay.style.display = "none";
      tooltip.style.display = "none";
    }
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
      ["src", "poster"].forEach((attribute) => {
        const value = node.getAttribute(attribute);
        if (!value || value.startsWith("data:") || value.startsWith("blob:")) return;
        try { node.setAttribute(attribute, new URL(value, location.href).href); } catch (_) {}
      });
      const srcset = node.getAttribute("srcset");
      if (srcset) {
        node.setAttribute("srcset", srcset.split(",").map((candidate) => {
          const [url, descriptor] = candidate.trim().split(/\s+/, 2);
          try { return `${new URL(url, location.href).href}${descriptor ? ` ${descriptor}` : ""}`; } catch (_) { return candidate; }
        }).join(", "));
      }
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

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  function serializeNumber(value) {
    return typeof value === "number" && !Number.isFinite(value) ? String(value) : value;
  }

  function serializeTiming(effect) {
    const specified = effect.getTiming();
    const computed = effect.getComputedTiming();
    return {
      delay: serializeNumber(specified.delay),
      duration: serializeNumber(specified.duration),
      easing: specified.easing,
      endDelay: serializeNumber(specified.endDelay),
      fill: specified.fill,
      direction: specified.direction,
      iterations: serializeNumber(specified.iterations),
      iterationStart: specified.iterationStart,
      activeDuration: serializeNumber(computed.activeDuration),
      endTime: serializeNumber(computed.endTime)
    };
  }

  function collectNativeAnimations(element, reverseIds) {
    if (typeof element.getAnimations !== "function") return [];
    let animations = [];
    try { animations = element.getAnimations({ subtree: true }); } catch (_) { animations = element.getAnimations(); }
    return animations.slice(0, 60).map((animation, index) => {
      const effect = animation.effect;
      const target = effect?.target;
      const keyframes = typeof effect?.getKeyframes === "function"
        ? effect.getKeyframes().map((frame) => {
            const clean = {};
            ["offset", "computedOffset", "easing", "composite", ...MOTION_KEYS, "translate", "rotate", "scale", "clipPath"].forEach((key) => {
              if (frame[key] !== undefined && frame[key] !== "") clean[key] = frame[key];
            });
            return clean;
          })
        : [];
      return {
        id: `animation-${index}`,
        target: target instanceof Element ? reverseIds.get(target) || describe(target) : "unknown",
        playState: animation.playState,
        currentTime: typeof animation.currentTime === "number" ? round(animation.currentTime) : animation.currentTime,
        playbackRate: animation.playbackRate,
        timing: effect && typeof effect.getTiming === "function" ? serializeTiming(effect) : null,
        keyframes
      };
    });
  }

  function hasNonZeroTime(value) {
    return value.split(",").some((part) => Number.parseFloat(part) > 0);
  }

  function collectDeclaredAnimations(idMap) {
    const declared = [];
    for (const [id, element] of idMap) {
      const style = getComputedStyle(element);
      const hasAnimation = style.animationName.split(",").some((name) => name.trim() !== "none");
      const hasTransition = hasNonZeroTime(style.transitionDuration) || hasNonZeroTime(style.transitionDelay);
      if (!hasAnimation && !hasTransition) continue;
      declared.push({
        target: id,
        animation: hasAnimation ? {
          name: style.animationName,
          duration: style.animationDuration,
          delay: style.animationDelay,
          easing: style.animationTimingFunction,
          iterations: style.animationIterationCount,
          direction: style.animationDirection,
          fillMode: style.animationFillMode,
          playState: style.animationPlayState
        } : null,
        transition: hasTransition ? {
          property: style.transitionProperty,
          duration: style.transitionDuration,
          delay: style.transitionDelay,
          easing: style.transitionTimingFunction
        } : null
      });
      if (declared.length >= 60) break;
    }
    return declared;
  }

  function readMotionFrame(element, startedAt) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      time: Math.round(performance.now() - startedAt),
      transform: style.transform,
      opacity: style.opacity,
      filter: style.filter,
      backgroundPosition: style.backgroundPosition,
      rect: { x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height) }
    };
  }

  async function sampleMotion(idMap) {
    const candidates = [...idMap.entries()]
      .filter(([, element]) => element.isConnected && getComputedStyle(element).display !== "none")
      .slice(0, MAX_MOTION_NODES);
    const tracks = new Map(candidates.map(([id]) => [id, []]));
    const startedAt = performance.now();
    const sampleCount = Math.ceil(MOTION_DURATION_MS / MOTION_SAMPLE_MS) + 1;

    for (let sample = 0; sample < sampleCount; sample += 1) {
      candidates.forEach(([id, element]) => tracks.get(id).push(readMotionFrame(element, startedAt)));
      if (sample < sampleCount - 1) await new Promise((resolve) => setTimeout(resolve, MOTION_SAMPLE_MS));
    }

    const changedTracks = {};
    let trackCount = 0;
    for (const [id, frames] of tracks) {
      const signatures = new Set(frames.map((frame) => JSON.stringify({ ...frame, time: 0 })));
      if (signatures.size > 1 && trackCount < MAX_MOTION_TRACKS) {
        changedTracks[id] = frames;
        trackCount += 1;
      }
    }
    return changedTracks;
  }

  async function captureMotion(idMap) {
    const reverseIds = new Map([...idMap].map(([id, element]) => [element, id]));
    const root = idMap.get("cc-0");
    const cssAnimations = collectNativeAnimations(root, reverseIds);
    const declaredAnimations = collectDeclaredAnimations(idMap);
    const sampledTracks = await sampleMotion(idMap);
    return {
      recordingDurationMs: MOTION_DURATION_MS,
      sampleIntervalMs: MOTION_SAMPLE_MS,
      cssAnimations,
      declaredAnimations,
      sampledTracks
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
    stop(false);
    positionOverlay(selected);
    tooltip.innerHTML = `Recording motion <small>${MOTION_DURATION_MS / 1000}s · keep the section visible</small>`;
    const motion = await captureMotion(idMap);
    const data = {
      capturedAt: new Date().toISOString(),
      page: { url: location.href, title: document.title, viewport: { width: innerWidth, height: innerHeight, devicePixelRatio } },
      summary: { name: describe(selected), width: Math.round(rect.width), height: Math.round(rect.height), nodes: idMap.size, interactive: behavior.length },
      html,
      styles: captureStyles(idMap),
      tokens: collectTokens(selected),
      assets: collectAssets(selected),
      behavior,
      motion
    };
    await chrome.storage.local.set({ capture: data });
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
