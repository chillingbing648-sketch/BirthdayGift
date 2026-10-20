# BirthdayGift — Minimal OurMoments-Inspired Virtual Birthday Gift

A warm, minimal, handcrafted digital birthday gift experience that someone designs for a special person and shares via a single link.

Inspired by the clean, restrained design philosophy of [ourmoments.live](https://ourmoments.live/birthday/) and powered by **pure static HTML5, CSS3, and vanilla JavaScript**. No build step, no external frameworks, no database requirements, and zero runtime dependencies.

---

## 🌟 Visual Philosophy: Minimal by Default

- **Clean, Restrained Backdrop**: Dark midnight-plum canvas (`#0d0a14`) with subtle atmospheric warmth—avoiding oversized blurry gradient blobs, neon glow, and heavy artificial glassmorphism.
- **Warm Champagne & Gold Accents**: Tasteful gold accents (`#e8bf72`) paired with rich plum, burgundy, and warm ivory.
- **Refined Typography**: Editorial serif headings (`Playfair Display`, `Iowan Old Style`, Georgia) and crisp, readable sans-serif controls.
- **Uncluttered Surfaces**: Lightweight inputs and cards with clean 1px borders, comfortable spacing, and zero unnecessary decorative noise.

---

## 📝 The Creator Journey: Clean & Guided Form

1. **Details**:
   - Recipient name, sender name, age (optional), and birthday date.
   - Anticipation countdown toggle.
   - Celebration tone chips (*Romantic, Best Friend, Family, Playful*).
2. **Theme & Cake**:
   - Palette selection with compact swatch cards (*Burgundy, Rose Gold, Violet Dusk, Golden*).
   - Optional custom local audio upload.
3. **Five Balloon Notes**:
   - Five dedicated numbered note inputs with quick inspiration prompt chips to easily fill in thoughtful memories and wishes.
4. **Photos**:
   - Minimal dropzone with drag-and-drop or file selection for up to 5 photos.
   - Auto-optimized with client-side canvas compression to travel smoothly inside the link without servers.
   - Captions, reordering (`↑`/`↓`), and deletion.
5. **Letter**:
   - Opening greeting, letter message (up to 900 characters), and personal sign-off.

> 💾 **Automatic Draft Persistence**: Progress is automatically saved to `localStorage` as you type, so you can refresh or return anytime without losing your work.

---

## 🎁 The Recipient Journey: Delightful & Immersive

1. **The Wrapped Gift Box**: A clean wrapped gift box with ribbon and gold tag (*"For Maya, from Sam"*). Tapping the ribbon unties it with an organic ribbon-curling animation and sound effect.
2. **Countdown (Optional)**: If the birthday date is in the future, a stellar countdown counts down the days, hours, and minutes with an *"Open early anyway ✨"* button.
3. **Cinematic Birthday Film & Soundtrack**: A built-in, theater-style video player with procedural celebratory motion graphics, scrubber timeline, play/pause, volume control, and fullscreen support. Plays the built-in procedural music box soundtrack with live audio-wave visualization.
4. **The Birthday Cake & Wish Ritual**: An artisan tiered SVG cake with individually igniting candle flames:
   - **Phase 1: Make a Wish**: Recipient makes their secret birthday wish.
   - **Phase 2: Blow the Candles**: Tap individual flames or the *"Blow out candles"* action to extinguish flames with realistic SVG smoke puffs and wind sound effects.
   - **Phase 3: Cut the Cake**: Slice the celebratory cake to unlock the next stage.
5. **Floating Balloons, Decorative Balloon Trees & Discovered Tray**: Shimmering balloons swaying gently against the stars, flanked by multi-layered SVG balloon bouquets. Tapping each floating balloon pops it with sound, squash physics, and confetti, revealing secret personal notes into an elegant card. Popped notes accumulate in a **Discovered Messages Tray** allowing the recipient to revisit any note at any time.
6. **Cherished Memories & Premium PhotoViewer**: A clean polaroid-style gallery. Clicking any image opens the **My Little Universe-grade PhotoViewer** lightbox: uncropped full-resolution rendering (`object-fit: contain`), zoom in/out/fit controls, drag-to-pan, mobile swipe gestures, and keyboard navigation (`ArrowLeft`, `ArrowRight`, `Escape`).
7. **The Wax-Sealed Letter**: A clean envelope with an embossed wax seal. Tap to break the wax with an authentic stamp sound effect. The flap folds open, and the letter rises with calligraphy/typewriter pacing and a reveal-all option.
8. **Grand Finale Celebration**: A celebratory shower of confetti, milestone celebration banner, ambient music box soundtrack, and actions to share, replay, or create a gift for someone else.
9. **Interactive Atmosphere**: Ambient drifting fireflies across the canvas and an interactive pointer sparkle trail (*"A Little Birthday Magic"*) responsive to mouse movement and mobile touches.

---

## 📸 PhotoViewer (My Little Universe Quality)

Directly modeled on the high-end `PhotoViewer` component from *My Little Universe*:
- **Atmospheric Lightbox Backdrop**: `rgba(7, 5, 12, 0.92)` with backdrop blur.
- **Original Aspect Ratio Preservation**: Uncropped rendering using `object-fit: contain` with fluid height constraints.
- **Zoom & Pan**: Interactive `+`, `−`, and `⤢` (fit) controls with smooth drag-to-pan when zoomed in.
- **Touch Swipe Gestures**: Seamless horizontal swiping on mobile devices (swipe delta threshold > 50px).
- **Keyboard Navigation**: `Escape` to close, `ArrowLeft` for previous, `ArrowRight` for next.
- **Accessibility**: ARIA dialog roles (`role="dialog" aria-modal="true"`), focus management, and on-screen keyboard shortcuts hint.

---

## ⚡ Unified Motion System & Form Ergonomics

- **Timing Hierarchy**: Fast tactile interactions (150 ms), standard step transitions (280 ms), and slow emotive reveals (550 ms).
- **Directional Form Steps**: Forward navigation slides smoothly from the right (`paneSlideForward`), backward navigation slides from the left (`paneSlideBackward`).
- **Tactile Button Press Depth**: Subtly compresses on `:active` (`translateY(1px) scale(0.98)`), giving instant physical feedback.
- **Contextual Field Highlighting**: Selecting an inspiration prompt chip immediately scrolls and highlights the targeted note with a soft golden glow.
- **Accessible Focus System**: High-contrast, 2-pixel gold focus rings with 2-pixel offset for full keyboard accessibility without mouse dependency.
- **Respects Reduced Motion**: Every animation scales to 0.01 ms under `prefers-reduced-motion: reduce`.

---

## 🔒 Link Architecture & Privacy

- All gift configuration (names, dates, notes, letters, and optimized photo thumbnails) is serialized as JSON, encoded with URL-safe Base64URL, and placed in the URL hash fragment (`#draft=...`).
- **Client-Side Only**: The hash fragment is never transmitted to the web server, ensuring privacy.
- **Untrusted Input Protection**: All recipient-rendered text is inserted using strict `textContent` and DOM nodes to eliminate Cross-Site Scripting (XSS).
- **Size Budget Gauge**: An interactive progress meter tracks the link size against safe URL limits (target < 100 KB).
- **Backward Compatible**: Seamlessly opens existing links created with previous versions of the site.

---

## 🚀 How to Run Locally

Open `index.html` directly in any web browser, or launch a lightweight local server:

```bash
# Python 3
python -m http.server 8080

# Or Node.js (npx)
npx serve .
```

Visit `http://localhost:8080`.

---

## 📦 Deploy to GitHub Pages or Netlify

### Netlify (Free)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag and drop this project folder.
3. Your gift builder is immediately live at `https://your-site.netlify.app`.

### GitHub Pages
1. Push this repository to GitHub.
2. Go to **Settings** → **Pages**.
3. Under **Branch**, select `main` and root `/`, then click **Save**.
4. Your site will be published at `https://<username>.github.io/<repo-name>/`.
