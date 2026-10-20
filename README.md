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

1. **The Wrapped Gift Box**: A clean wrapped gift box with ribbon and gold tag (*"For Maya, from Sam"*). Tapping the ribbon unties it with a sound effect.
2. **Countdown (Optional)**: If the birthday date is in the future, a stellar countdown counts down the days, hours, and minutes with an *"Open early anyway ✨"* button.
3. **Cinematic Birthday Film & Soundtrack**: A built-in, theater-style video player with procedural celebratory motion graphics, scrubber timeline, play/pause, volume control, and fullscreen support. Plays the built-in procedural music box soundtrack.
4. **The Birthday Cake & Wish Ritual**: An artisan tiered SVG cake with glowing candle flames. Tap individual flames to blow them out with a puff of smoke SFX, or blow them all out together, followed by *"Make a wish"* and celebratory cake cutting.
5. **Floating Balloons & Decorative Balloon Trees**: Shimmering balloons swaying gently against the stars, flanked by multi-layered SVG balloon bouquets. Tapping each floating balloon pops it with sound and confetti, revealing secret personal notes into an elegant card.
6. **Cherished Memories & Premium PhotoViewer**: A clean polaroid-style gallery. Clicking any image opens the **My Little Universe-grade PhotoViewer** lightbox: uncropped full-resolution rendering (`object-fit: contain`), zoom in/out/fit controls, drag-to-pan, mobile swipe gestures, and keyboard navigation (`ArrowLeft`, `ArrowRight`, `Escape`).
7. **The Wax-Sealed Letter**: A clean envelope with an embossed wax seal. Tap to break the wax with a sound effect. The letter unfolds with calligraphy/typewriter pacing and a reveal-all option.
8. **Grand Finale Celebration**: A celebratory shower of confetti, milestone celebration banner, ambient music box soundtrack, and actions to share, replay, or create a gift for someone else.

---

## 📸 PhotoViewer (My Little Universe Quality)

Directly modeled on the high-end `PhotoViewer` component from *My Little Universe*:
- **Atmospheric Lightbox Backdrop**: `rgba(7, 5, 12, 0.92)` with backdrop blur.
- **Original Aspect Ratio Preservation**: Uncropped rendering using `object-fit: contain` with fluid height constraints.
- **Zoom & Pan**: Interactive `+`, `−`, and `⤢` (fit) controls with smooth drag-to-pan when zoomed in.
- **Touch Swipe Gestures**: Seamless horizontal swiping on mobile devices (swipe delta threshold > 50px).
- **Keyboard Navigation**: `Escape` to close, `ArrowLeft` for previous, `ArrowRight` for next.
- **Accessibility**: ARIA dialog roles (`role="dialog" aria-modal="true"`) and focus management.

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
