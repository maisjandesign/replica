# Codex Capture

Codex Capture is a local-first Chrome extension that turns any selected website section into a structured implementation prompt for Codex.

It captures the DOM, computed styles, visual tokens, assets, interactive clues, and continuous motion. No built-in AI, API key, account, or backend is required.

## Features

- Select a DOM section visually on any regular website.
- See element boundaries and dimensions while hovering.
- Capture a cleaned HTML tree of up to 180 elements.
- Collect relevant computed CSS properties.
- Extract common colors, typography, radii, and shadows.
- Detect links, buttons, form controls, and other interactive elements.
- Resolve image, poster, `srcset`, and background asset URLs.
- Capture native CSS and Web Animations keyframes and timing.
- Sample JavaScript-driven motion such as GSAP or Framer Motion transforms.
- Choose React, Next.js, Vue, or HTML as the target.
- Choose Tailwind CSS, CSS Modules, plain CSS, or Styled Components.
- Add responsive, accessibility, and asset-reuse requirements.
- Generate and copy a detailed implementation prompt for Codex.

## Install in Chrome

### 1. Download the extension

Use **Code → Download ZIP** on this GitHub page, or clone the repository:

```bash
git clone https://github.com/maisjandesign/codex-capture.git
```

Extract the archive if you downloaded the ZIP.

### 2. Open Chrome Extensions

Enter this address in Chrome:

```text
chrome://extensions
```

### 3. Enable Developer Mode

Turn on **Developer mode** in the top-right corner.

### 4. Load Codex Capture

1. Click **Load unpacked**.
2. Select the `codex-capture` folder containing `manifest.json`.
3. Optionally pin **Codex Capture** to the Chrome toolbar.

After pulling or editing the source, click **Reload** on the extension card in `chrome://extensions`.

## How to use it

1. Open a regular website. Chrome internal pages such as `chrome://settings` cannot be inspected by extensions.
2. Open **Codex Capture** from the toolbar.
3. Click **Select on page**.
4. Hover over the page until the desired section is highlighted.
5. Click the section. Keep it visible while the extension records approximately 2.4 seconds of motion.
6. Wait for the green **Captured** confirmation. Press `Escape` before clicking to cancel selection.
7. Open the extension again.
8. Choose the target framework, styling approach, and capture mode.
9. Click **Generate Codex prompt**.
10. Paste the prompt into Codex and tell it which project should receive the implementation.

The `⌥ S` shortcut starts element selection while the extension popup is open.

## Motion Capture

Codex Capture uses two complementary strategies:

### Native browser animations

For CSS Animations, CSS Transitions, and the Web Animations API, it reads `element.getAnimations()` and stores:

- target element ID;
- keyframes and computed offsets;
- duration, delay, and end delay;
- easing and direction;
- iteration count and fill mode;
- playback rate, play state, and current time.

### JavaScript-driven motion

Libraries such as GSAP and Framer Motion may update inline styles without exposing useful keyframes. Codex Capture therefore samples visible elements every 200 ms for approximately 2.4 seconds and records changing:

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
- Sampled motion tracks for script-driven animation.
- Target stack, responsive, accessibility, and asset requirements.

All capture data remains in `chrome.storage.local`. The extension does not call an AI service or send page contents to a server.

## Current limitations

- Server-side behavior and private APIs cannot be recovered from the DOM.
- Cross-origin iframe contents cannot be captured from the parent page.
- Canvas pixels, video frames, closed Shadow DOM, and pseudo-elements are not fully reconstructed.
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

Codex Capture works locally. Before pasting a generated prompt into any AI service, verify that the selected section contains no personal, private, or commercially sensitive information.

## License

MIT
