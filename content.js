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
  const PSEUDO_KEYS = [
    "content", "display", "position", "inset", "top", "right", "bottom", "left", "width", "height",
    "margin", "padding", "color", "backgroundColor", "backgroundImage", "border", "borderRadius", "boxShadow",
    "opacity", "transform", "filter", "backdropFilter", "fontFamily", "fontSize", "fontWeight", "lineHeight", "zIndex"
  ];
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
  let captureKind = "exact";

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    tooltip = document.createElement("div");
    overlay.id = "__codex_capture_overlay";
    tooltip.id = "__codex_capture_tooltip";
    const style = document.createElement("style");
    style.id = "__codex_capture_styles";
    style.textContent = `
      #__codex_capture_overlay { position:fixed; z-index:2147483646; pointer-events:none; display:none; border:2px solid rgba(53,151,255,.95); border-radius:14px; background:linear-gradient(145deg,rgba(207,235,255,.22),rgba(255,255,255,.08)); box-shadow:0 0 0 1px rgba(255,255,255,.92),0 0 0 9999px rgba(22,31,44,.16),0 0 34px rgba(46,145,255,.42),inset 0 1px 0 rgba(255,255,255,.75),inset 0 0 26px rgba(97,184,255,.15); backdrop-filter:brightness(1.04) saturate(115%); transition:left 80ms ease-out,top 80ms ease-out,width 80ms ease-out,height 80ms ease-out,border-color 160ms ease-out,background-color 160ms ease-out; }
      #__codex_capture_tooltip { position:fixed; z-index:2147483647; pointer-events:none; display:none; max-width:310px; padding:10px 13px; color:rgba(15,22,32,.9); border:1px solid rgba(255,255,255,.82); border-radius:14px; background:linear-gradient(145deg,rgba(255,255,255,.88),rgba(235,246,255,.7)); box-shadow:inset 0 1px 0 white,inset 0 0 0 1px rgba(69,91,120,.06),0 12px 30px rgba(39,61,91,.22); backdrop-filter:blur(24px) saturate(155%); font:650 12px/1.25 -apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif; letter-spacing:-.12px; }
      #__codex_capture_tooltip::before { content:""; display:inline-block; width:7px; height:7px; margin-right:8px; border:2px solid white; border-radius:50%; vertical-align:-1px; background:#1675f8; box-shadow:0 0 0 4px rgba(22,117,248,.11); }
      #__codex_capture_tooltip small { margin-left:7px; color:rgba(31,42,57,.45); font-size:10px; font-weight:550; }
      @media (prefers-reduced-motion:reduce) { #__codex_capture_overlay { transition:none; } }
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

  function capturePseudoStyles(idMap) {
    const result = {};
    for (const [id, element] of idMap) {
      const entry = {};
      [["before", "::before"], ["after", "::after"]].forEach(([key, pseudo]) => {
        const computed = getComputedStyle(element, pseudo);
        const content = computed.content;
        if (!content || content === "none" || content === "normal" || content === "\"\"") return;
        const values = {};
        PSEUDO_KEYS.forEach((property) => {
          const value = computed[property];
          if (value && value !== "normal" && value !== "none" && value !== "auto" && value !== "rgba(0, 0, 0, 0)") values[property] = value;
        });
        entry[key] = values;
      });
      if (Object.keys(entry).length) result[id] = entry;
    }
    return result;
  }

  function collectCssVariables(element) {
    const variables = {};
    [document.documentElement, element].forEach((node) => {
      const computed = getComputedStyle(node);
      for (let index = 0; index < computed.length && Object.keys(variables).length < 120; index += 1) {
        const property = computed[index];
        if (!property.startsWith("--")) continue;
        const value = computed.getPropertyValue(property).trim();
        if (value) variables[property] = value;
      }
    });
    return variables;
  }

  function afterPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function captureScreenshot(element) {
    const rect = element.getBoundingClientRect();
    overlay.style.display = "none";
    tooltip.style.display = "none";
    await afterPaint();
    const response = await chrome.runtime.sendMessage({ type: "CAPTURE_VISIBLE_TAB" });
    if (!response?.ok || !response.dataUrl) throw new Error(response?.error || "Screenshot failed");
    const image = new Image();
    image.src = response.dataUrl;
    await image.decode();

    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(innerWidth, rect.right);
    const bottom = Math.min(innerHeight, rect.bottom);
    if (right <= left || bottom <= top) throw new Error("Selected section is outside the viewport");
    const scaleX = image.naturalWidth / innerWidth;
    const scaleY = image.naturalHeight / innerHeight;
    const sourceWidth = (right - left) * scaleX;
    const sourceHeight = (bottom - top) * scaleY;
    const maxDimension = 1200;
    const outputScale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * outputScale));
    canvas.height = Math.max(1, Math.round(sourceHeight * outputScale));
    canvas.getContext("2d").drawImage(
      image, left * scaleX, top * scaleY, sourceWidth, sourceHeight,
      0, 0, canvas.width, canvas.height
    );
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
      coverage: {
        complete: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        width: round((right - left) / Math.max(1, rect.width)),
        height: round((bottom - top) / Math.max(1, rect.height))
      }
    };
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

  function buildCapturedPrompt(data, preferences = {}, compact = false) {
    const target = preferences.target || "React";
    const styling = preferences.styling || "Tailwind CSS";
    const motion = data.motion || {};
    const motionCount = (motion.cssAnimations?.length || 0) + (motion.declaredAnimations?.length || 0) + Object.keys(motion.sampledTracks || {}).length;
    const base = `# Implementation task\n\nRecreate the captured ${data.summary.name} from ${data.page.url} as a production-ready ${target} component using ${styling}.\n\n## Goal\nMatch the reference closely: layout, typography, spacing, colors, assets, interactions, entrance motion and continuous motion. Keep entrance and looping motion on separate wrapper layers. Respect prefers-reduced-motion.\n\n## Capture\n- Fidelity: ${data.captureKind}\n- Viewport: ${data.page.viewport.width} × ${data.page.viewport.height}\n- Bounds: ${data.summary.width} × ${data.summary.height}px\n- Elements: ${data.summary.nodes}\n- Motion tracks: ${motionCount}\n- Screenshot: ${data.screenshot ? (data.screenshot.coverage?.complete ? "full section" : "visible crop") : "not included"}\n\n## Requirements\n- Preserve visible text, controls and meaningful states.\n- Make the result responsive and accessible.\n- Reuse public assets when practical.\n- Mock unavailable backend behavior and mark integration points.\n- Briefly state assumptions, then implement and provide run instructions.`;
    if (compact) return base;
    return `${base}\n\n## Behavior\n${data.behavior.length ? data.behavior.map((item) => `- ${item}`).join("\n") : "- No explicit controls detected."}\n\n## Visual tokens\n\`\`\`json\n${JSON.stringify({ ...data.tokens, cssVariables: data.cssVariables || {} }, null, 2)}\n\`\`\`\n\n## Element tree\n\`\`\`html\n${data.html}\n\`\`\`\n\n## Computed styles\n\`\`\`json\n${JSON.stringify(data.styles, null, 2)}\n\`\`\`\n\n## Pseudo-elements\n\`\`\`json\n${JSON.stringify(data.pseudoStyles || {}, null, 2)}\n\`\`\`\n\n## Motion evidence\n\`\`\`json\n${JSON.stringify(motion, null, 2)}\n\`\`\`\n\n## Assets\n${data.assets.length ? data.assets.map((asset) => `- ${asset}`).join("\n") : "- No public assets detected."}`;
  }

  function closePromptCard() {
    document.getElementById("__codex_promptcard_host")?.remove();
  }

  async function showLauncher() {
    ensureOverlay();
    closePromptCard();
    const stored = await chrome.storage.local.get("preferences");
    const preferences = { captureKind: "exact", target: "React", styling: "Tailwind CSS", mode: "UI + behavior", responsive: true, accessibility: true, assets: true, ...(stored.preferences || {}) };
    const host = document.createElement("div");
    host.id = "__codex_promptcard_host";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host{all:initial;position:fixed;z-index:2147483647;inset:0;display:block;color:#f7f4ee;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif}*{box-sizing:border-box}.scrim{position:absolute;inset:0;background:rgba(9,9,8,.32);backdrop-filter:blur(6px) saturate(90%);animation:fade .25s ease-out both}.card{position:absolute;left:clamp(16px,4vw,56px);top:50%;width:min(420px,calc(100vw - 32px));translate:0 -50%;overflow:hidden;border:1px solid rgba(255,255,255,.2);border-radius:24px;background:linear-gradient(145deg,rgba(24,24,21,.7),rgba(7,7,6,.5));box-shadow:inset 0 1px rgba(255,255,255,.14),inset 0 0 0 1px rgba(0,0,0,.13),0 30px 90px rgba(0,0,0,.44);backdrop-filter:blur(34px) saturate(125%);animation:card-in .48s cubic-bezier(.2,.8,.2,1) both}.card:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.12;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 140 140' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E")}.content{position:relative;padding:20px}.top{display:flex;align-items:center;gap:9px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.1)}.brand{flex:1;font-size:10px;letter-spacing:.16em}.version{color:rgba(255,255,255,.42)}button,select{font:inherit}.icon{width:34px;height:34px;display:grid;place-items:center;padding:0;color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.13);border-radius:11px;cursor:pointer;background:rgba(255,255,255,.05)}.icon svg,.select svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round}.status{display:flex;align-items:center;gap:7px;margin-top:22px;color:rgba(255,255,255,.64);font-size:9px;font-weight:650;letter-spacing:.09em;text-transform:uppercase}.status i{width:6px;height:6px;border-radius:50%;background:#75e3b5;box-shadow:0 0 8px #75e3b5}.hero h1{margin:12px 0 8px;font-size:26px;line-height:1.04;letter-spacing:-.04em}.hero p{margin:0;color:rgba(255,255,255,.58);font-size:11px;line-height:1.5}.switch{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-top:22px;padding:3px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(0,0,0,.16)}.switch button{min-height:46px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:0 12px;color:rgba(255,255,255,.4);border:0;border-radius:9px;cursor:pointer;background:transparent}.switch button[aria-pressed=true]{color:#fff;background:rgba(255,255,255,.11);box-shadow:inset 0 1px rgba(255,255,255,.08)}.switch strong{font-size:10px}.switch small{margin-top:3px;color:rgba(255,255,255,.38);font-size:8px}.select{width:100%;min-height:52px;display:flex;align-items:center;gap:11px;margin-top:12px;padding:0 14px;color:#171713;border:1px solid rgba(255,255,255,.74);border-radius:16px;cursor:pointer;background:linear-gradient(180deg,#f4f2ed,#c9c7c2);box-shadow:inset 0 1px #fff,0 12px 28px rgba(0,0,0,.27);font-size:11px;font-weight:700}.select kbd{margin-left:auto;color:rgba(20,20,17,.46);font-family:inherit;font-size:8px}.recipe{margin-top:10px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(0,0,0,.14)}summary{min-height:43px;display:flex;align-items:center;padding:0 13px;cursor:pointer;list-style:none;font-size:9px;font-weight:650;letter-spacing:.04em}summary::-webkit-details-marker{display:none}summary small{margin-left:auto;color:#7bddb5;font-size:8px;font-weight:500}summary:after{content:"+";margin-left:10px;color:rgba(255,255,255,.4);font-size:14px}.recipe[open] summary:after{content:"−"}.recipe-body{padding:0 12px 12px}.row{min-height:38px;display:flex;align-items:center;border-top:1px solid rgba(255,255,255,.07)}.row span{color:rgba(255,255,255,.42);font-size:8px}.row select{flex:1;margin-left:auto;color:white;border:0;appearance:none;background:transparent;text-align:right;font-size:9px}.privacy{margin:11px 0 0;color:rgba(255,255,255,.36);text-align:center;font-size:8px}button:active{transform:scale(.96)}button:focus-visible,summary:focus-visible,select:focus-visible{outline:2px solid white;outline-offset:2px}@keyframes fade{from{opacity:0}to{opacity:1}}@keyframes card-in{from{opacity:0;translate:-14px -50%;filter:blur(7px)}to{opacity:1;translate:0 -50%;filter:blur(0)}}@media(max-width:520px){.card{left:8px;width:calc(100vw - 16px)}}@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
      </style><style>.card{left:auto!important;right:30px!important;top:30px!important;bottom:30px!important;width:min(420px,calc(100vw - 60px))!important;max-height:none!important;translate:0!important;animation:right-card-in .48s cubic-bezier(.2,.8,.2,1) both!important}@keyframes right-card-in{from{opacity:0;transform:translateX(14px);filter:blur(7px)}to{opacity:1;transform:none;filter:blur(0)}}@media(max-width:520px){.card{right:12px!important;top:12px!important;bottom:12px!important;width:calc(100vw - 24px)!important}}</style>
      <style>.scrim{background:rgba(3,17,22,.18)!important;backdrop-filter:blur(8px) saturate(92%)!important}.card{border-color:rgba(225,250,255,.34)!important;background:linear-gradient(145deg,rgba(75,101,108,.56),rgba(28,51,58,.4))!important;box-shadow:inset 0 1px rgba(255,255,255,.28),inset 0 0 0 1px rgba(118,222,236,.06),0 30px 90px rgba(0,15,24,.38),0 0 45px rgba(59,196,218,.1)!important;backdrop-filter:blur(38px) saturate(145%) brightness(1.04)!important}.card:before{opacity:.07!important}.card:after{content:"";position:absolute;z-index:0;left:-76px;top:-92px;width:270px;height:230px;border-radius:50%;pointer-events:none;background:conic-gradient(from 205deg,transparent 0 12%,rgba(255,72,117,.74) 15%,rgba(255,213,83,.7) 18%,rgba(73,255,203,.68) 21%,rgba(66,178,255,.72) 24%,rgba(131,92,255,.68) 27%,transparent 31%);filter:blur(5px);opacity:.64;mask:radial-gradient(circle,transparent 57%,#000 59%,#000 62%,transparent 65%)}.content{z-index:2!important}.select{background:linear-gradient(180deg,rgba(248,254,255,.95),rgba(197,222,225,.88))!important;box-shadow:inset 0 1px #fff,0 12px 28px rgba(0,24,33,.25),0 0 20px rgba(65,213,230,.12)!important}.switch button[aria-pressed=true]{background:linear-gradient(145deg,rgba(255,255,255,.2),rgba(175,230,237,.12))!important;box-shadow:inset 0 1px rgba(255,255,255,.28)!important}.status i{background:#7cf3d2!important;box-shadow:0 0 11px #54dfca!important}</style>
      <div class="scrim"></div><section class="card" role="dialog" aria-modal="true" aria-labelledby="cc-launch-title"><div class="content">
        <header class="top"><strong class="brand">REPLICA <span class="version">— V0.7.2</span></strong><button class="icon close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
        <div class="hero"><div class="status"><i></i>Ready to capture</div><h1 id="cc-launch-title">Capture UI<br>into Code.</h1><p>Capture pixels, structure, motion and visual rules in one pass.</p></div>
        <div class="switch" role="group" aria-label="Capture fidelity"><button data-kind="quick"><strong>Quick</strong><small>DOM + motion</small></button><button data-kind="exact"><strong>Exact</strong><small>Pixels + full context</small></button></div>
        <button class="select"><svg viewBox="0 0 24 24"><path d="M5 3H3v6m16-6h2v6M5 21H3v-6m16 6h2v-6M8 8h8v8H8z"/></svg><span>Select on page</span><kbd>⌥ S</kbd></button>
        <details class="recipe"><summary>Build recipe <small>Local only</small></summary><div class="recipe-body"><label class="row"><span>Target</span><select data-pref="target"><option>React</option><option>Next.js</option><option>Vue</option><option>HTML</option></select></label><label class="row"><span>Styling</span><select data-pref="styling"><option>Tailwind CSS</option><option>CSS Modules</option><option>Plain CSS</option><option>Styled Components</option></select></label><label class="row"><span>Output</span><select data-pref="mode"><option>UI + behavior</option><option>Visual UI only</option><option>Behavior only</option></select></label></div></details><p class="privacy">● &nbsp; Processed locally on this device</p>
      </div></section>`;
    document.documentElement.append(host);
    const updateKind = (kind) => {
      preferences.captureKind = kind;
      shadow.querySelectorAll("[data-kind]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.kind === kind)));
      chrome.storage.local.set({ preferences });
    };
    updateKind(preferences.captureKind);
    shadow.querySelectorAll("[data-kind]").forEach((button) => button.addEventListener("click", () => updateKind(button.dataset.kind)));
    shadow.querySelectorAll("select[data-pref]").forEach((select) => {
      select.value = preferences[select.dataset.pref];
      select.addEventListener("change", () => { preferences[select.dataset.pref] = select.value; chrome.storage.local.set({ preferences }); });
    });
    shadow.querySelector(".select").addEventListener("click", () => { closePromptCard(); start(preferences.captureKind); });
    shadow.querySelector(".close").addEventListener("click", closePromptCard);
    shadow.querySelector(".scrim").addEventListener("click", closePromptCard);
    host.addEventListener("keydown", (event) => { if (event.key === "Escape") closePromptCard(); });
    shadow.querySelector(".select").focus();
  }

  function showPromptCard(data, preferences) {
    closePromptCard();
    overlay.style.display = "none";
    tooltip.style.display = "none";
    const host = document.createElement("div");
    host.id = "__codex_promptcard_host";
    const shadow = host.attachShadow({ mode: "open" });
    const motionCount = (data.motion?.cssAnimations?.length || 0) + (data.motion?.declaredAnimations?.length || 0) + Object.keys(data.motion?.sampledTracks || {}).length;
    const fullPrompt = buildCapturedPrompt(data, preferences, false);
    const compactPrompt = buildCapturedPrompt(data, preferences, true);
    shadow.innerHTML = `
      <style>
        :host{all:initial;position:fixed;z-index:2147483647;inset:0;display:block;color:#f7f4ee;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif}
        *{box-sizing:border-box}.scrim{position:absolute;inset:0;background:rgba(5,5,4,.22);backdrop-filter:blur(2px);animation:fade .25s ease-out both}.card{position:absolute;left:clamp(16px,4vw,56px);top:50%;width:min(420px,calc(100vw - 32px));max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden;translate:0 -50%;border:1px solid rgba(255,255,255,.2);border-radius:24px;background:linear-gradient(145deg,rgba(22,22,19,.76),rgba(8,8,7,.62));box-shadow:inset 0 1px 0 rgba(255,255,255,.13),inset 0 0 0 1px rgba(0,0,0,.12),0 30px 90px rgba(0,0,0,.44);backdrop-filter:blur(34px) saturate(125%);animation:card-in .48s cubic-bezier(.2,.8,.2,1) both}.card:before{content:"";position:absolute;z-index:0;inset:0;pointer-events:none;opacity:.12;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 140 140' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E")}.content{position:relative;z-index:1;display:flex;min-height:0;flex:1;flex-direction:column;padding:20px}.top{display:flex;align-items:center;gap:9px;padding-bottom:15px;border-bottom:1px solid rgba(255,255,255,.1)}.brand{flex:1;font-size:10px;letter-spacing:.16em}.version{color:rgba(255,255,255,.43)}button{font:inherit}.icon{width:34px;height:34px;display:grid;place-items:center;padding:0;color:rgba(255,255,255,.72);border:1px solid rgba(255,255,255,.13);border-radius:11px;cursor:pointer;background:rgba(255,255,255,.055);transition:background-color .16s,transform .1s}.icon:hover{background:rgba(255,255,255,.1)}button:active{transform:scale(.96)}button:focus-visible,textarea:focus-visible{outline:2px solid #fff;outline-offset:2px}.icon svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round}.heading{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:18px 0 12px}.heading h2{margin:0;font-size:22px;line-height:1;letter-spacing:-.04em}.heading span{color:rgba(255,255,255,.48);font:500 9px ui-monospace,SFMono-Regular,Menlo,monospace}.summary{display:flex;align-items:center;gap:8px;margin-bottom:12px;white-space:nowrap}.summary b{max-width:190px;overflow:hidden;text-overflow:ellipsis;font-size:9px;font-weight:600}.tag{padding:5px 8px;color:rgba(255,255,255,.66);border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(255,255,255,.05);font-size:8px}.tag.live:before{content:"";display:inline-block;width:5px;height:5px;margin-right:5px;border-radius:50%;background:#75e3b5;box-shadow:0 0 8px #75e3b5}.switch{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:9px;padding:3px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(0,0,0,.16)}.switch button{height:30px;color:rgba(255,255,255,.42);border:0;border-radius:8px;cursor:pointer;background:transparent;font-size:9px}.switch button[aria-pressed=true]{color:#fff;background:rgba(255,255,255,.1);box-shadow:inset 0 1px rgba(255,255,255,.08)}label{display:flex;min-height:0;flex:1;flex-direction:column}label>span{margin:0 3px 7px;color:rgba(255,255,255,.48);font-size:9px}textarea{width:100%;min-height:170px;max-height:38vh;flex:1;resize:none;padding:13px;color:rgba(255,255,255,.84);border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(0,0,0,.18);box-shadow:inset 0 2px 9px rgba(0,0,0,.18);font:500 9px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.count{margin:6px 3px 10px;color:rgba(255,255,255,.34);text-align:right;font:500 8px ui-monospace,SFMono-Regular,Menlo,monospace}.copy{width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:9px;color:#171713;border:1px solid rgba(255,255,255,.72);border-radius:15px;cursor:pointer;background:linear-gradient(180deg,#f4f2ed,#c9c7c2);box-shadow:inset 0 1px #fff,0 10px 25px rgba(0,0,0,.24);font-size:11px;font-weight:700;transition:filter .16s,transform .1s}.copy:hover{filter:brightness(1.08)}.copy svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.actions button{min-height:36px;color:rgba(255,255,255,.66);border:1px solid rgba(255,255,255,.1);border-radius:12px;cursor:pointer;background:rgba(255,255,255,.045);font-size:9px}.status{min-height:11px;margin:9px 0 0;color:rgba(255,255,255,.38);text-align:center;font-size:8px}.status.ok{color:#8de8c2}@keyframes fade{from{opacity:0}to{opacity:1}}@keyframes card-in{from{opacity:0;translate:-14px -50%;filter:blur(7px)}to{opacity:1;translate:0 -50%;filter:blur(0)}}@media(max-width:520px){.card{left:8px;width:calc(100vw - 16px);max-height:calc(100vh - 16px)}}@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
      </style><style>.card{left:auto!important;right:30px!important;top:30px!important;bottom:30px!important;width:min(420px,calc(100vw - 60px))!important;max-height:none!important;translate:0!important;animation:right-card-in .48s cubic-bezier(.2,.8,.2,1) both!important}.card.minimized{top:30px!important;bottom:auto!important;max-height:75px!important}.card.minimized .heading,.card.minimized .summary,.card.minimized .switch,.card.minimized label,.card.minimized .count,.card.minimized .copy,.card.minimized .actions,.card.minimized .status{display:none}.card.minimized .top{padding-bottom:0;border-bottom:0}@keyframes right-card-in{from{opacity:0;transform:translateX(14px);filter:blur(7px)}to{opacity:1;transform:none;filter:blur(0)}}@media(max-width:520px){.card{right:12px!important;top:12px!important;bottom:12px!important;width:calc(100vw - 24px)!important}.card.minimized{top:12px!important}}</style>
      <style>.scrim{background:rgba(3,17,22,.18)!important;backdrop-filter:blur(8px) saturate(92%)!important}.card{border-color:rgba(225,250,255,.34)!important;background:linear-gradient(145deg,rgba(75,101,108,.56),rgba(28,51,58,.4))!important;box-shadow:inset 0 1px rgba(255,255,255,.28),inset 0 0 0 1px rgba(118,222,236,.06),0 30px 90px rgba(0,15,24,.38),0 0 45px rgba(59,196,218,.1)!important;backdrop-filter:blur(38px) saturate(145%) brightness(1.04)!important}.card:before{opacity:.07!important}.card:after{content:"";position:absolute;z-index:0;left:-76px;top:-92px;width:270px;height:230px;border-radius:50%;pointer-events:none;background:conic-gradient(from 205deg,transparent 0 12%,rgba(255,72,117,.74) 15%,rgba(255,213,83,.7) 18%,rgba(73,255,203,.68) 21%,rgba(66,178,255,.72) 24%,rgba(131,92,255,.68) 27%,transparent 31%);filter:blur(5px);opacity:.64;mask:radial-gradient(circle,transparent 57%,#000 59%,#000 62%,transparent 65%)}.content{z-index:2!important}.copy{background:linear-gradient(180deg,rgba(248,254,255,.96),rgba(197,222,225,.9))!important;box-shadow:inset 0 1px #fff,0 12px 28px rgba(0,24,33,.25),0 0 20px rgba(65,213,230,.12)!important}.switch button[aria-pressed=true]{background:linear-gradient(145deg,rgba(255,255,255,.2),rgba(175,230,237,.12))!important;box-shadow:inset 0 1px rgba(255,255,255,.28)!important}.tag.live:before{background:#7cf3d2!important;box-shadow:0 0 11px #54dfca!important}</style>
      <div class="scrim"></div><section class="card" role="dialog" aria-modal="true" aria-labelledby="cc-title"><div class="content">
        <header class="top"><strong class="brand">REPLICA <span class="version">— V0.7.2</span></strong><button class="icon collapse" aria-label="Collapse panel"><svg viewBox="0 0 24 24"><path d="m8 14 4-4 4 4"/></svg></button><button class="icon close" aria-label="Close panel"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
        <div class="heading"><h2 id="cc-title">Prompt ready</h2><span>${data.summary.width}×${data.summary.height} PX</span></div>
        <div class="summary"><b>${data.summary.name}</b><span class="tag live">${data.captureKind.toUpperCase()}</span><span class="tag">${motionCount} MOTION</span></div>
        <div class="switch" role="group" aria-label="Prompt detail"><button data-mode="full" aria-pressed="true">Full capture</button><button data-mode="compact" aria-pressed="false">Compact</button></div>
        <label><span>Editable implementation prompt</span><textarea spellcheck="false"></textarea></label><div class="count"></div>
        <button class="copy"><svg viewBox="0 0 24 24"><path d="M8 8h11v11H8zM5 16H4V5h11v1"/></svg><span>Copy prompt</span></button>
        <div class="actions"><button class="again">Capture another</button><button class="download">Download JSON</button></div><p class="status">Processed locally on this device</p>
      </div></section>`;
    document.documentElement.append(host);
    const textarea = shadow.querySelector("textarea");
    const count = shadow.querySelector(".count");
    const status = shadow.querySelector(".status");
    const updateCount = () => { count.textContent = `${textarea.value.length.toLocaleString()} characters`; };
    textarea.value = fullPrompt;
    updateCount();
    textarea.addEventListener("input", updateCount);
    shadow.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
      const compact = button.dataset.mode === "compact";
      shadow.querySelectorAll("[data-mode]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      textarea.value = compact ? compactPrompt : fullPrompt;
      updateCount();
    }));
    shadow.querySelector(".copy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(textarea.value); } catch (_) { textarea.select(); document.execCommand("copy"); }
      shadow.querySelector(".copy span").textContent = "Prompt copied";
      status.textContent = "Ready to paste into Codex";
      status.classList.add("ok");
      setTimeout(() => { shadow.querySelector(".copy span").textContent = "Copy prompt"; }, 1600);
    });
    shadow.querySelector(".download").addEventListener("click", () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `replica-capture-${Date.now()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    shadow.querySelector(".again").addEventListener("click", () => { closePromptCard(); start(captureKind); });
    shadow.querySelector(".close").addEventListener("click", closePromptCard);
    shadow.querySelector(".scrim").addEventListener("click", closePromptCard);
    shadow.querySelector(".collapse").addEventListener("click", () => shadow.querySelector(".card").classList.toggle("minimized"));
    shadow.querySelector(".close").focus();
    host.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePromptCard();
      if (event.key !== "Tab") return;
      const focusable = [...shadow.querySelectorAll("button, textarea")].filter((element) => !element.disabled && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && shadow.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && shadow.activeElement === last) { event.preventDefault(); first.focus(); }
    });
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
    let screenshot = null;
    if (captureKind === "exact") {
      tooltip.innerHTML = "Capturing pixels <small>1 of 2</small>";
      try { screenshot = await captureScreenshot(selected); } catch (_) {}
      positionOverlay(selected);
    }
    tooltip.innerHTML = `Recording motion <small>${MOTION_DURATION_MS / 1000}s · keep the section visible</small>`;
    const motion = await captureMotion(idMap);
    const data = {
      capturedAt: new Date().toISOString(),
      captureKind,
      page: { url: location.href, title: document.title, viewport: { width: innerWidth, height: innerHeight, devicePixelRatio } },
      summary: { name: describe(selected), width: Math.round(rect.width), height: Math.round(rect.height), nodes: idMap.size, interactive: behavior.length },
      html,
      styles: captureStyles(idMap),
      pseudoStyles: captureKind === "exact" ? capturePseudoStyles(idMap) : {},
      cssVariables: captureKind === "exact" ? collectCssVariables(selected) : {},
      tokens: collectTokens(selected),
      assets: collectAssets(selected),
      behavior,
      motion,
      screenshot
    };
    await chrome.storage.local.set({ capture: data });
    tooltip.innerHTML = "Ready <small>Building your prompt</small>";
    const stored = await chrome.storage.local.get("preferences");
    showPromptCard(data, stored.preferences || {});
  }

  function showConfirmation(element) {
    positionOverlay(element);
    overlay.style.borderColor = "rgba(139, 240, 200, .96)";
    overlay.style.background = "rgba(84, 220, 166, .12)";
    tooltip.innerHTML = `Captured <small>Open Replica to generate</small>`;
    setTimeout(() => {
      overlay.style.display = "none";
      tooltip.style.display = "none";
      overlay.style.borderColor = "";
      overlay.style.background = "";
    }, 1500);
  }

  function start(kind = "exact") {
    ensureOverlay();
    captureKind = kind === "quick" ? "quick" : "exact";
    active = true;
    hovered = null;
    document.documentElement.style.cursor = "crosshair";
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "SHOW_CODEX_LAUNCHER") {
      showLauncher();
      sendResponse({ ok: true });
      return;
    }
    if (message.type === "START_CODEX_CAPTURE") {
      start(message.captureKind);
      sendResponse({ ok: true });
    }
  });
})();
