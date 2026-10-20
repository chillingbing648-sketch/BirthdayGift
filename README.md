# BirthdayGift — Personalized Virtual Birthday Gift Experience

An unforgettable, handcrafted digital birthday gift experience that someone designs for a special person and shares via a single magical link.

Built with **pure static HTML5, CSS3, and vanilla JavaScript**. No build step, no external frameworks, no database requirements, and zero runtime dependencies.

---

## 🌟 The Experience Journey

### 1. The Creator Workshop
Instead of a cold form, the creator designs and wraps a virtual present across 5 guided stages:
1. **The Person**: Who are we celebrating? Recipient name, your name, optional age, birthday date, and celebration tone (*Romantic, Best Friend, Family, Playful*).
2. **Our Memories**: Drag-and-drop or upload up to 5 photos with custom captions, reordering, and instant client-side downscaling to keep links lightweight.
3. **Little Surprises**: Write personal notes, quotes, or inside jokes tucked inside floating balloons, with inspiration chips for quick ideas.
4. **Your Letter**: A heartfelt personal letter with customizable greeting and sign-off, sealed under an ornate golden wax seal.
5. **The Finishing Touches**: Choose from signature palettes (*Burgundy Night, Rose Gold, Violet Dusk, Golden Twilight*), optional countdown anticipation, local custom music preview, live link size budget gauge, and the celebratory **Wrap Your Gift 🎁** ceremony.

### 2. The Recipient Unwrapping
When opened by the recipient, the gift comes to life:
1. **The Wrapped Gift Box**: A 3D gift box with silk ribbons, gold bow, floating stardust, and a personalized gold gift tag (*"For Maya, from Sam"*). Tapping the ribbon unties it with a silky sound effect and a burst of golden light.
2. **The Countdown (Optional)**: If the birthday date is in the future, a stellar countdown counts down the days, hours, and minutes — with an *"Open early anyway ✨"* button to jump right in.
3. **The Birthday Cake & Wish Ritual**: An artisan tiered cake with glowing candles that flicker with realistic physics. Tap flames individually to blow them out with a puff of smoke, or blow them all out together. The ambient room dims gently, prompting *"Make a wish"*, followed by a celebratory sparkle cake-cutting moment.
4. **Floating Balloons of Whispered Wishes**: Shimmering balloons swaying gently against the stars. Tapping each balloon pops it with sound and confetti, revealing secret personal notes into an elegant frosted glass card.
5. **Cherished Memories**: A cinematic polaroid-style memory album with captions, touch swipe gestures, and keyboard navigation.
6. **The Wax-Sealed Letter**: A vintage envelope with an embossed golden seal. Tap to break the wax with a tactile crackle sound effect. The envelope opens, paper unfolds, and the letter is revealed progressively with calligraphy/typewriter pacing.
7. **Grand Finale Celebration**: A full-screen shower of colorful confetti and golden stars, milestone celebration banner, ambient music box soundtrack, and actions to share, replay, or create a gift for someone else.

---

## 🎵 Audio Architecture

- **Procedural Web Audio Synthesizer**: Plays a dreamy music-box arpeggio progression without requiring any external audio files, CDNs, or network requests. Works offline and on all modern browsers.
- **Bespoke Procedural Sound Effects**:
  - `ribbon`: Silky frequency glide and gentle bell ping.
  - `openGift`: Ascending major arpeggio chord swell.
  - `blow`: Filtered breath noise puff with smoke dissipation.
  - `pop`: Crisp bubble pop and musical marimba chime.
  - `wax`: Tactile seal crackle and paper unfold.
  - `party`: Joyful celebratory fanfare and confetti chime.
  - `cut`: Clean cake-slice shimmer tone.
- **Autoplay Safe**: Audio context initiates strictly on user interaction (unwrapping the gift or pressing Play).
- **Creator Custom Audio**: Creators can optionally test their own local audio track during preview.

---

## 🔒 Link Architecture & Privacy

- All gift configuration (names, dates, notes, letters, and optimized photo thumbnails) is serialized as JSON, encoded with URL-safe Base64URL, and placed in the URL hash fragment (`#draft=...`).
- **Client-Side Only**: The hash fragment is never transmitted to the web server, ensuring privacy.
- **Untrusted Input Protection**: All recipient-rendered text is inserted using strict `textContent` and DOM nodes to eliminate Cross-Site Scripting (XSS).
- **Size Budget Gauge**: An interactive progress meter warns the creator if the link exceeds safe chat app URL lengths (target < 100 KB).
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
