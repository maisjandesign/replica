# Replica — Capture UI into Code

Replica is a local-first Chrome extension that turns any selected website section into a structured implementation prompt for Codex. Version 0.7 moves both capture and prompt editing into one in-page cinematic glass interface.

It captures the DOM, computed styles, visual tokens, assets, interactive clues, continuous motion, and — in Exact mode — a pixel reference of the selected section. No built-in AI, API key, account, or backend is required.

## Features

- Select a DOM section visually on any regular website.
- Switch between **Quick** capture (smaller DOM + motion payload) and **Exact** capture (pixels + full context).
- Preview the captured section directly in the extension.
- Copy the pixel reference or download a portable Codex reference pack.
- Open an editable smoked-glass prompt card directly over the source website when capture finishes.
- Switch between a full evidence-rich prompt and a compact implementation brief.
- See element boundaries and dimensions while hovering.
- Capture a cleaned HTML tree of up to 180 elements.
- Collect relevant computed CSS properties.
- Collect visible `::before` and `::after` pseudo-elements and CSS custom properties in Exact mode.
- Extract common colors, typography, radii, and shadows.
- Detect links, buttons, form controls, and other interactive elements.
- Resolve image, poster, `srcset`, and background asset URLs.
- Capture native CSS and Web Animations keyframes and timing.
- Preserve declared CSS animation and transition timing even after an entrance animation has finished.
- Sample JavaScript-driven motion such as GSAP or Framer Motion transforms.
- Choose React, Next.js, Vue, or HTML as the target.
- Choose Tailwind CSS, CSS Modules, plain CSS, or Styled Components.
- Add responsive, accessibility, and asset-reuse requirements.
- Generate and copy a detailed implementation prompt for Codex.

## Install in Chrome

### 1. Download the extension

Use **Code → Download ZIP** on this GitHub page, or clone the repository:

```bash
git clone https://github.com/maisjandesign/replica.git
```

Extract the archive if you downloaded the ZIP.

### 2. Open Chrome Extensions

Enter this address in Chrome:

```text
chrome://extensions
```

### 3. Enable Developer Mode

Turn on **Developer mode** in the top-right corner.

### 4. Load Replica

1. Click **Load unpacked**.
2. Select the `replica` folder containing `manifest.json`.
3. Optionally pin **Replica** to the Chrome toolbar.

After pulling or editing the source, click **Reload** on the extension card in `chrome://extensions`.

## How to use it

1. Open a regular website. Chrome internal pages such as `chrome://settings` cannot be inspected by extensions.
2. Open **Replica** from the toolbar.
3. Choose **Quick** or **Exact**, then click **Select on page**. Exact is recommended when visual fidelity matters.
4. Hover over the page until the desired section is highlighted.
5. Click the section. Keep it visible while the extension records approximately 2.4 seconds of motion.
6. Wait for the green **Captured** confirmation. Press `Escape` before clicking to cancel selection.
7. A cinematic glass prompt card opens directly over the website when recording finishes.
8. Edit the prompt if needed, choose **Full capture** or **Compact**, then click **Copy prompt**.

Use **Capture another** to restart without reopening the toolbar popup. Press `Escape` or select the dimmed page area to close the prompt card.

For higher-fidelity work, use **Download JSON** and provide the structured capture file alongside the copied prompt. The JSON includes the extracted element tree, styles, tokens, behavior, motion evidence, assets, and Exact-mode pixel reference.

## Capture modes

### Quick

Captures the cleaned element tree, computed styles, assets, behavior, tokens, and motion. Use it for simple UI, smaller prompts, and fast iteration.

### Exact

Adds a screenshot of the visible part of the selected section, pseudo-element styles, and inherited CSS custom properties. The screenshot is treated as the visual source of truth while DOM and computed styles provide measurements and implementation clues.

Chrome can only screenshot the visible tab. If a selected section extends beyond the viewport, the preview is marked **visible crop**. Scroll or zoom so the complete section is visible before capturing when possible.

The `⌥ S` hint mirrors the selection action in the in-page panel. Select **Capture another** to start a new capture without reopening the toolbar action.

## Motion Capture

Replica uses two complementary strategies:

### Native browser animations

For CSS Animations, CSS Transitions, and the Web Animations API, it reads `element.getAnimations()` and stores:

- target element ID;
- keyframes and computed offsets;
- duration, delay, and end delay;
- easing and direction;
- iteration count and fill mode;
- playback rate, play state, and current time.

### Completed entrance animations

Selection normally happens after the page has loaded, so a one-time entrance animation may already be finished. Replica also reads the declared computed animation and transition properties for each captured element:

- animation name, duration, delay, and easing;
- iteration count, direction, fill mode, and play state;
- transition properties, duration, delay, and easing.

The generated prompt explicitly keeps entrance/reveal motion separate from continuous illustration loops. When no entrance metadata is available, it requests a restrained one-time section reveal instead of silently dropping entrance motion.

### JavaScript-driven motion

Libraries such as GSAP and Framer Motion may update inline styles without exposing useful keyframes. Replica therefore samples visible elements every 200 ms for approximately 2.4 seconds and records changing:

- transforms;
- opacity;
- filters;
- background position;
- viewport-relative position and size.

Only elements whose sampled values changed are included in the final motion tracks. Codex is instructed to simplify noisy sub-pixel samples into intentional, reusable keyframes.

## Prompt contents

- Source URL, page title, and viewport dimensions.
- Selected element name and bounds.
- Cleaned HTML tree with temporary capture IDs.
- Computed style map keyed by the same IDs.
- Common visual tokens.
- Detected controls and destinations.
- Absolute public asset URLs.
- Native animation metadata and keyframes.
- Declared animation and transition timing for completed entrance effects.
- Sampled motion tracks for script-driven animation.
- Pixel reference and screenshot coverage metadata in Exact mode.
- Visible pseudo-element styles and CSS custom properties in Exact mode.
- Target stack, responsive, accessibility, and asset requirements.

All capture data remains in `chrome.storage.local`. The extension does not call an AI service or send page contents to a server.

## Current limitations

- Server-side behavior and private APIs cannot be recovered from the DOM.
- Cross-origin iframe contents cannot be captured from the parent page.
- Canvas internals, video frames, and closed Shadow DOM cannot be reconstructed from page markup. Exact mode still captures their visible pixels.
- Exact screenshots include only the visible portion of the selected section.
- Large sections are intentionally limited by element count and HTML size.
- Motion that starts only after an unrecorded click, scroll, or hover may not appear in the capture.
- A 2.4-second recording may capture only part of a very long animation cycle.
- Motion sampling is limited to 80 visible elements to keep prompts manageable.

## Project structure

```text
manifest.json   Manifest V3 configuration and permissions
background.js   Extension service worker
content.js      Element selection, context extraction, and motion recording
popup.html      Popup markup
popup.css       Liquid Glass interface styling
popup.js        Preferences and prompt generation
```

## Development

The extension uses plain HTML, CSS, and JavaScript and requires no build step.

Run syntax checks with:

```bash
node --check popup.js
node --check content.js
node --check background.js
```

Reload the unpacked extension from `chrome://extensions` after making changes.

## Privacy

Replica works locally. Before pasting a generated prompt into any AI service, verify that the selected section contains no personal, private, or commercially sensitive information.

## License

MIT
