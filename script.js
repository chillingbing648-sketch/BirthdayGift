'use strict';

/* ==============================================================
   DOM HELPERS & GLOBAL CONFIGURATION
   ============================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOW = (navigator.hardwareConcurrency || 4) <= 4;
const MAX_LINK_LEN = 100000;
const DRAFT_KEY = 'birthday_gift_draft_v3';

// Application State
const st = {
  data: null,
  mode: 'build',        // 'build' | 'preview' | 'view'
  currentStep: 1,
  totalSteps: 5,
  stages: [],
  i: 0,
  photos: [],           // [{s: base64, c: caption}]
  link: '',
  tm: 0,
  ck: 0,
  popped: 0,
  tone: 'warm',
  discoveredNotes: []   // Array of { text, index }
};

const bad = msg => Object.assign(new Error(msg), { ok: 1 });
const fmtDate = d => {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return d;
  }
};

/* ==============================================================
   LOCALSTORAGE DRAFT PERSISTENCE
   ============================================================== */
function getFormNotes() {
  const notes = [];
  for (let i = 1; i <= 5; i++) {
    const el = $(`#f-note-${i}`);
    if (el && el.value.trim()) {
      notes.push(el.value.trim().slice(0, 90));
    }
  }
  return notes;
}

function saveDraft() {
  if (st.mode !== 'build') return;
  try {
    const draft = {
      to: $('#f-to').value,
      from: $('#f-from').value,
      age: $('#f-age').value,
      date: $('#f-date').value,
      tone: st.tone,
      notes: [1, 2, 3, 4, 5].map(i => $(`#f-note-${i}`)?.value || ''),
      letter: $('#f-letter').value,
      greeting: $('#f-greeting').value,
      signoff: $('#f-signoff').value,
      theme: $('#f-theme').value,
      cd: $('#f-cd').checked
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    const statusEl = $('#draftStatus');
    if (statusEl) statusEl.style.display = 'flex';
  } catch {}
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== 'object') return false;

    if (draft.to) $('#f-to').value = draft.to;
    if (draft.from) $('#f-from').value = draft.from;
    if (draft.age) $('#f-age').value = draft.age;
    if (draft.date) $('#f-date').value = draft.date;

    if (Array.isArray(draft.notes)) {
      draft.notes.forEach((txt, idx) => {
        const el = $(`#f-note-${idx + 1}`);
        if (el) el.value = txt || '';
      });
    }

    if (draft.letter) $('#f-letter').value = draft.letter;
    if (draft.greeting) $('#f-greeting').value = draft.greeting;
    if (draft.signoff) $('#f-signoff').value = draft.signoff;
    if (draft.cd !== undefined) $('#f-cd').checked = !!draft.cd;

    if (draft.theme) {
      $('#f-theme').value = draft.theme;
      document.body.dataset.theme = draft.theme;
      $$('#themePicker .theme-card').forEach(c => {
        c.classList.toggle('active', c.dataset.theme === draft.theme);
      });
    }

    if (draft.tone) {
      st.tone = draft.tone;
      $$('#toneChips .chip').forEach(c => {
        c.classList.toggle('active', c.dataset.tone === draft.tone);
      });
    }

    const statusEl = $('#draftStatus');
    if (statusEl && (draft.to || draft.from)) {
      statusEl.style.display = 'flex';
    }
    return true;
  } catch {
    return false;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
    $('#f-to').value = '';
    $('#f-from').value = '';
    $('#f-age').value = '';
    $('#f-date').value = '';
    for (let i = 1; i <= 5; i++) {
      const el = $(`#f-note-${i}`);
      if (el) el.value = '';
    }
    $('#f-letter').value = '';
    $('#f-greeting').value = 'Dear Maya,';
    $('#f-signoff').value = 'With all my love,';
    $('#f-cd').checked = false;
    st.photos = [];
    renderPhotoList();
    updateLivePreview();
    const statusEl = $('#draftStatus');
    if (statusEl) statusEl.style.display = 'none';
    toast('Draft cleared! Starting fresh ✨');
  } catch {}
}

const btnReset = $('#btnResetDraft');
if (btnReset) btnReset.onclick = clearDraft;

/* ==============================================================
   ENCODING, COMPRESSION & DATA SANITIZATION
   ============================================================== */
function enc(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function dec(str) {
  const binary = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

function clean(d) {
  if (!d || typeof d !== 'object' || (d.v !== 1 && d.v !== 2)) {
    throw bad('This gift was made with a different version or is incompatible.');
  }

  const str = (x, max) => typeof x === 'string' ? x.trim().slice(0, max) : '';

  const parsedAge = +d.age;
  const validAge = (!isNaN(parsedAge) && parsedAge >= 1 && parsedAge <= 120) ? Math.round(parsedAge) : null;

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(d.date) && !isNaN(new Date(d.date).getTime()) ? d.date : '';
  const validTheme = ['violet', 'rose', 'ocean', 'amber'].includes(d.theme) ? d.theme : 'violet';

  const notes = (Array.isArray(d.notes) ? d.notes : [])
    .slice(0, 5)
    .map(n => str(n, 90))
    .filter(Boolean);

  const photos = (Array.isArray(d.photos) ? d.photos : [])
    .slice(0, 5)
    .filter(p => p && typeof p.s === 'string' && p.s.length < 35000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.s))
    .map(p => ({ s: p.s, c: str(p.c, 80) }));

  const o = {
    v: 1,
    to: str(d.to, 40),
    from: str(d.from, 40),
    age: validAge,
    date: validDate,
    theme: validTheme,
    cd: d.cd ? 1 : 0,
    greeting: str(d.greeting, 60),
    signoff: str(d.signoff, 60),
    letter: str(d.letter, 900),
    notes,
    photos
  };

  if (!o.to) throw bad('Please add the name of the person you are celebrating.');
  if (!o.from) throw bad('Please add your name so they know who made this gift.');

  return o;
}

function readForm() {
  const notes = getFormNotes();
  return clean({
    v: 1,
    to: $('#f-to').value,
    from: $('#f-from').value,
    age: $('#f-age').value,
    date: $('#f-date').value,
    theme: $('#f-theme').value || 'violet',
    cd: $('#f-cd').checked ? 1 : 0,
    greeting: $('#f-greeting').value,
    signoff: $('#f-signoff').value,
    notes,
    letter: $('#f-letter').value,
    photos: st.photos.map(p => ({ s: p.s, c: p.c }))
  });
}

function makeLink() {
  const giftData = readForm();
  const encoded = enc(giftData);
  const base = location.href.split('#')[0];
  const url = `${base}#draft=${encoded}`;
  if (url.length > MAX_LINK_LEN) {
    throw bad('The gift is slightly too large for one link. Remove a photo or shorten notes and try again.');
  }
  return url;
}

/* ==============================================================
   UI TOAST, UTILS & NAVIGATION
   ============================================================== */
let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
}

function setFormMsg(text) {
  const el = $('#formMsg');
  el.textContent = text ? text : '';
}

function flashBloom() {
  const b = document.body;
  b.classList.remove('bloom');
  void b.offsetWidth;
  b.classList.add('bloom');
  setTimeout(() => b.classList.remove('bloom'), 800);
}

function showStage(id) {
  document.body.dataset.stage = id;
  $$('.stage').forEach(s => s.classList.toggle('on', s.id === `s-${id}`));
  window.scrollTo(0, 0);
  const h = $(`#s-${id} h1`);
  if (h) h.focus({ preventScroll: true });
}

function words(el, text) {
  el.textContent = '';
  text.split(' ').forEach((w, i) => {
    const span = document.createElement('span');
    span.className = 'w';
    span.style.setProperty('--i', i);
    span.textContent = w;
    el.append(span, ' ');
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Link copied to clipboard! 📋');
    return;
  } catch {}
  const temp = document.createElement('textarea');
  temp.value = text;
  temp.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
  document.body.append(temp);
  temp.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {}
  temp.remove();
  toast(ok ? 'Link copied to clipboard! 📋' : 'Please select and copy the link manually.');
}

async function shareUrl(url) {
  if (!url) return;
  const toName = (st.data && st.data.to) ? st.data.to : 'Someone Special';
  const fromName = (st.data && st.data.from) ? st.data.from : '';
  const shareTitle = `A Birthday Gift for ${toName}`;
  const shareText = fromName ? `${fromName} created a personalized birthday surprise for you!` : 'A special birthday surprise made just for you.';

  if (navigator.share) {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  copyText(url);
}

/* ==============================================================
   AUDIO ENGINE (Procedural Web Audio Synthesizer & SFX)
   ============================================================== */
const AudioEngine = {
  ctx: null,
  master: null,
  muted: false,
  playing: false,
  chordIndex: 0,
  timer: null,
  customAudio: null,
  customUrl: '',

  getCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  },

  playTone(freq, time, duration, type = 'sine', vol = 0.12, freqEnd = null) {
    const c = this.getCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, time + duration);
    }

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(vol, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  },

  sfx: {
    ribbon() {
      const c = AudioEngine.getCtx();
      if (!c) return;
      const t = c.currentTime;
      AudioEngine.playTone(320, t, 0.22, 'triangle', 0.1, 640);
      AudioEngine.playTone(784, t + 0.08, 0.35, 'sine', 0.12);
    },

    openGift() {
      const c = AudioEngine.getCtx();
      if (!c) return;
      const t = c.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        AudioEngine.playTone(f, t + i * 0.08, 1.0, 'sine', 0.14);
      });
    },

    pop() {
      const c = AudioEngine.getCtx();
      if (!c) return;
      const t = c.currentTime;
      AudioEngine.playTone(560, t, 0.1, 'sine', 0.3, 80);
      AudioEngine.playTone(880, t + 0.03, 0.25, 'triangle', 0.08);
    },

    blow() {
      const c = AudioEngine.getCtx();
      if (!c) return;
      const t = c.currentTime;
      const bufLen = Math.floor(c.sampleRate * 0.35);
      const buf = c.createBuffer(1, bufLen, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.8);
      }
      const src = c.createBufferSource();
      const filter = c.createBiquadFilter();
      const gain = c.createGain();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, t);
      filter.frequency.exponentialRampToValueAtTime(160, t + 0.35);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      src.buffer = buf;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(AudioEngine.master);
      src.start(t);
    },

    wax() {
      const c = AudioEngine.getCtx();
      if (!c) return;
      const t = c.currentTime;
      AudioEngine.playTone(400, t, 0.08, 'square', 0.06, 120);
      AudioEngine.playTone(680, t + 0.05, 0.3, 'sine', 0.12);
    },

    party() {
      const c = AudioEngine.getCtx();
      if (!c) return;
      const t = c.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        AudioEngine.playTone(f, t + i * 0.08, 0.7, 'triangle', 0.14);
      });
    },

    cut() {
      const c = AudioEngine.getCtx();
      if (!c) return;
      const t = c.currentTime;
      AudioEngine.playTone(800, t, 0.15, 'triangle', 0.14, 300);
      AudioEngine.playTone(523, t + 0.12, 0.45, 'sine', 0.12);
    }
  },

  chords: [
    [261.63, 329.63, 392.00, 523.25], // C major
    [220.00, 261.63, 329.63, 440.00], // A minor
    [174.61, 220.00, 261.63, 349.23], // F major
    [196.00, 246.94, 293.66, 392.00]  // G major
  ],

  playArpeggioBar() {
    const c = AudioEngine.getCtx();
    if (!c) return;
    const t = c.currentTime + 0.05;
    const chord = AudioEngine.chords[AudioEngine.chordIndex++ % AudioEngine.chords.length];

    [0, 1, 2, 3, 2, 1, 2, 1].forEach((k, i) => {
      AudioEngine.playTone(chord[k], t + i * 0.32, 1.2, 'triangle', 0.04);
    });
    AudioEngine.playTone(chord[0] / 2, t, 2.2, 'sine', 0.06);
  },

  updateUI() {
    const btnM = $('#btnMusic');
    const btnMute = $('#btnMute');
    const wave = $('#audioWave');
    if (btnM) {
      btnM.innerHTML = AudioEngine.playing
        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg><span>Pause</span><span class="audio-wave" id="audioWave"><span></span><span></span><span></span></span>`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Music</span>`;
      btnM.setAttribute('aria-pressed', AudioEngine.playing);
    }
    if (btnMute) {
      btnMute.innerHTML = AudioEngine.muted
        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg><span>Unmute</span>`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg><span>Mute</span>`;
      btnMute.setAttribute('aria-pressed', AudioEngine.muted);
    }
  },

  start() {
    if (this.playing) return;
    if (this.customAudio) {
      this.customAudio.play().then(() => {
        this.playing = true;
        this.updateUI();
      }).catch(() => {
        toast('Tap Music to allow audio playback.');
      });
      return;
    }
    if (!this.getCtx()) {
      toast('This device browser does not support audio playback.');
      return;
    }
    this.playing = true;
    this.chordIndex = 0;
    this.playArpeggioBar();
    this.timer = setInterval(() => this.playArpeggioBar(), 2560);
    this.updateUI();
  },

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    if (this.customAudio) this.customAudio.pause();
    this.updateUI();
  },

  toggle() {
    this.playing ? this.stop() : this.start();
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
    if (this.customAudio) this.customAudio.muted = this.muted;
    this.updateUI();
  }
};

$('#btnMusic').onclick = () => AudioEngine.toggle();
$('#btnMute').onclick = () => AudioEngine.toggleMute();

$('#f-music').onchange = e => {
  const file = e.target.files[0];
  AudioEngine.stop();
  if (AudioEngine.customUrl) URL.revokeObjectURL(AudioEngine.customUrl);
  AudioEngine.customAudio = null;
  AudioEngine.customUrl = '';

  if (!file) return;
  if (!file.type.startsWith('audio/')) {
    setFormMsg('Please choose a valid audio file (MP3, WAV, etc.).');
    e.target.value = '';
    return;
  }
  AudioEngine.customUrl = URL.createObjectURL(file);
  AudioEngine.customAudio = new Audio(AudioEngine.customUrl);
  AudioEngine.customAudio.loop = true;
  AudioEngine.customAudio.muted = AudioEngine.muted;
  setFormMsg('');
  toast('Custom music loaded for local preview! 🎵');
};

/* ==============================================================
   CINEMATIC VIDEO PLAYER & CANVAS MOTION GRAPHICS
   ============================================================== */
const VideoPlayer = {
  canvas: null,
  ctx: null,
  animId: 0,
  currentTime: 0,
  duration: 90, // 90 seconds (1:30)
  isPlaying: false,
  lastTimestamp: 0,
  particles: [],

  init() {
    this.canvas = $('#videoCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.particles = [];
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        r: Math.random() * 2.5 + 1,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -Math.random() * 0.6 - 0.15,
        alpha: Math.random() * 0.6 + 0.3,
        hue: Math.random() > 0.5 ? 42 : 335
      });
    }

    this.bindControls();
    this.renderFrame(0);
  },

  bindControls() {
    const bigPlay = $('#btnBigPlay');
    const playPause = $('#btnVidPlayPause');
    const poster = $('#videoPoster');
    const timeline = $('#vidTimeline');
    const vol = $('#vidVolume');
    const mute = $('#btnVidMute');
    const fs = $('#btnVidFullscreen');

    const togglePlay = () => {
      this.isPlaying ? this.pause() : this.play();
    };

    if (bigPlay) bigPlay.onclick = togglePlay;
    if (playPause) playPause.onclick = togglePlay;
    if (poster) {
      poster.onclick = e => {
        if (e.target === poster) togglePlay();
      };
    }

    if (timeline) {
      timeline.oninput = e => {
        this.currentTime = parseFloat(e.target.value);
        this.updateTimeDisplay();
        this.renderFrame(this.currentTime);
      };
    }

    if (vol) {
      vol.oninput = e => {
        const v = parseFloat(e.target.value);
        if (AudioEngine.master) AudioEngine.master.gain.value = v;
        if (AudioEngine.customAudio) AudioEngine.customAudio.volume = v;
      };
    }

    if (mute) {
      mute.onclick = () => AudioEngine.toggleMute();
    }

    if (fs) {
      fs.onclick = () => {
        const container = $('#videoContainer');
        if (!document.fullscreenElement) {
          container.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      };
    }

    $('#vidBtnContinue').onclick = nextScene;
  },

  play() {
    this.isPlaying = true;
    $('#videoPoster').classList.add('hidden');
    $('#vidPlayIcon').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    AudioEngine.start();
    this.lastTimestamp = performance.now();
    this.loop();
  },

  pause() {
    this.isPlaying = false;
    cancelAnimationFrame(this.animId);
    $('#vidPlayIcon').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
  },

  loop() {
    if (!this.isPlaying) return;
    const now = performance.now();
    const dt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;

    this.currentTime += dt;
    if (this.currentTime >= this.duration) {
      this.currentTime = 0;
    }

    this.updateTimeDisplay();
    this.renderFrame(this.currentTime);
    this.animId = requestAnimationFrame(() => this.loop());
  },

  updateTimeDisplay() {
    const cur = Math.floor(this.currentTime);
    const dur = Math.floor(this.duration);
    const pad = n => String(n).padStart(2, '0');
    $('#vidTimeline').value = this.currentTime;
    $('#vidTimeText').textContent = `${Math.floor(cur / 60)}:${pad(cur % 60)} / ${Math.floor(dur / 60)}:${pad(dur % 60)}`;
  },

  renderFrame(time) {
    if (!this.ctx || !this.canvas) return;
    const c = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const toName = (st.data && st.data.to) ? st.data.to : 'Someone Special';

    c.fillStyle = '#0f0a17';
    c.fillRect(0, 0, w, h);

    // Drifting particles
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      c.save();
      c.beginPath();
      c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      c.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.alpha})`;
      c.fill();
      c.restore();
    }

    // Concentric clean orbit lines
    const angle = time * 0.6;
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(angle * 0.15);

    for (let r = 130; r <= 170; r += 20) {
      c.beginPath();
      c.ellipse(0, 0, r * 1.5, r * 0.5, angle, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(232, 191, 114, 0.18)';
      c.lineWidth = 1;
      c.stroke();
    }
    c.restore();

    // Central Cinematic Title Cards
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    let titleText = `A Special Moment for ${toName}`;
    let subText = 'Celebrating Another Beautiful Chapter of Life';

    if (time >= 22 && time < 45) {
      titleText = 'Your Kindness & Laughter';
      subText = 'Make the World Brighter for Everyone Around You';
    } else if (time >= 45 && time < 68) {
      titleText = 'May All Your Dreams Take Flight';
      subText = 'Here’s to Boundless Love, Health, and Adventure';
    } else if (time >= 68) {
      titleText = `Happy Birthday, ${toName}! 🎂`;
      subText = `With Every Wish From the Heart • ${(st.data && st.data.from) ? st.data.from : ''}`;
    }

    c.font = '500 38px "DM Serif Display", "Lora", Georgia, serif';
    c.fillStyle = '#FFF9F4';
    c.fillText(titleText, w / 2, h / 2 - 14);

    c.font = 'italic 18px "DM Serif Display", "Lora", Georgia, serif';
    c.fillStyle = '#F5D3C8';
    c.fillText(subText, w / 2, h / 2 + 28);

    c.restore();
  }
};

/* ==============================================================
   PHOTOVIEWER (Match My Little Universe Quality)
   ============================================================== */
const PhotoViewer = {
  active: false,
  index: 0,
  touchStartX: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  dragStartX: 0,
  dragStartY: 0,

  open(idx) {
    if (!st.data.photos || !st.data.photos.length) return;
    this.index = Math.max(0, Math.min(idx, st.data.photos.length - 1));
    this.active = true;
    this.resetZoom();

    const pv = $('#photoViewer');
    pv.hidden = false;
    document.body.style.overflow = 'hidden';

    this.render();
  },

  close() {
    this.active = false;
    const pv = $('#photoViewer');
    pv.hidden = true;
    document.body.style.overflow = '';
  },

  next() {
    const total = st.data.photos.length;
    this.index = (this.index + 1) % total;
    this.resetZoom();
    this.render();
  },

  prev() {
    const total = st.data.photos.length;
    this.index = (this.index - 1 + total) % total;
    this.resetZoom();
    this.render();
  },

  resetZoom() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  },

  zoomIn() {
    this.zoom = Math.min(3, this.zoom + 0.4);
    this.applyTransform();
  },

  zoomOut() {
    this.zoom = Math.max(1, this.zoom - 0.4);
    if (this.zoom === 1) {
      this.panX = 0;
      this.panY = 0;
    }
    this.applyTransform();
  },

  applyTransform() {
    const img = $('#pvImg');
    if (img) {
      img.style.transform = `scale(${this.zoom}) translate(${this.panX}px, ${this.panY}px)`;
      img.style.cursor = this.zoom > 1 ? 'grab' : 'default';
    }
  },

  render() {
    const current = st.data.photos[this.index];
    if (!current) return;

    const img = $('#pvImg');
    const cap = $('#pvCaption');
    const fig = $('#pvFigure');

    fig.classList.remove('scale-in');
    void fig.offsetWidth;
    fig.classList.add('scale-in');

    img.src = current.s;
    img.alt = current.c || `Memory ${this.index + 1}`;
    cap.textContent = current.c || '';

    const showNav = st.data.photos.length > 1;
    $('#pvPrev').style.display = showNav ? 'grid' : 'none';
    $('#pvNext').style.display = showNav ? 'grid' : 'none';
  },

  init() {
    const pv = $('#photoViewer');
    if (!pv) return;

    $('#pvClose').onclick = () => this.close();
    $('#pvNext').onclick = () => this.next();
    $('#pvPrev').onclick = () => this.prev();

    $('#pvZoomIn').onclick = () => this.zoomIn();
    $('#pvZoomOut').onclick = () => this.zoomOut();
    $('#pvZoomReset').onclick = () => this.resetZoom();

    pv.onclick = e => {
      if (e.target === pv || e.target === $('#pvFigure') || e.target === $('#pvImgWrap')) {
        this.close();
      }
    };

    window.addEventListener('keydown', e => {
      if (!this.active) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'ArrowRight') this.next();
      if (e.key === 'ArrowLeft') this.prev();
    });

    pv.addEventListener('touchstart', e => {
      this.touchStartX = e.touches[0].clientX;
    }, { passive: true });

    pv.addEventListener('touchend', e => {
      if (this.touchStartX == null || this.zoom > 1) return;
      const deltaX = e.changedTouches[0].clientX - this.touchStartX;
      if (Math.abs(deltaX) > 50) {
        deltaX < 0 ? this.next() : this.prev();
      }
      this.touchStartX = null;
    });

    const imgWrap = $('#pvImgWrap');
    imgWrap.addEventListener('mousedown', e => {
      if (this.zoom <= 1) return;
      this.isPanning = true;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
      $('#pvImg').style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
      if (!this.isPanning) return;
      this.panX = e.clientX - this.dragStartX;
      this.panY = e.clientY - this.dragStartY;
      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        $('#pvImg').style.cursor = this.zoom > 1 ? 'grab' : 'default';
      }
    });
  }
};

/* ==============================================================
   PHOTO PROCESSING & LIVE ESTIMATION
   ============================================================== */
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const maxDim = 320;
      const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * ratio));
      canvas.height = Math.max(1, Math.round(img.height * ratio));

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);

      let quality = 0.65;
      let dataUrl;
      do {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        quality -= 0.1;
      } while (dataUrl.length > 22000 && quality > 0.2);

      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image.'));
    };

    img.src = objectUrl;
  });
}

function renderPhotoList() {
  const container = $('#plist');
  container.textContent = '';

  st.photos.forEach((photo, idx) => {
    const card = document.createElement('div');
    card.className = 'photo-card-item';

    const thumb = document.createElement('img');
    thumb.src = photo.s;
    thumb.alt = photo.c || `Memory ${idx + 1}`;
    thumb.className = 'photo-thumb';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'photo-caption-input';
    input.placeholder = `Caption for photo ${idx + 1}...`;
    input.value = photo.c || '';
    input.maxLength = 80;
    input.oninput = () => {
      photo.c = input.value;
      updateLivePreview();
      saveDraft();
    };

    const actions = document.createElement('div');
    actions.className = 'photo-actions';

    if (idx > 0) {
      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'btn ghost sm icon-only';
      upBtn.title = 'Move up';
      upBtn.innerHTML = '↑';
      upBtn.onclick = () => {
        const temp = st.photos[idx - 1];
        st.photos[idx - 1] = st.photos[idx];
        st.photos[idx] = temp;
        renderPhotoList();
        updateLivePreview();
        saveDraft();
      };
      actions.append(upBtn);
    }

    if (idx < st.photos.length - 1) {
      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'btn ghost sm icon-only';
      downBtn.title = 'Move down';
      downBtn.innerHTML = '↓';
      downBtn.onclick = () => {
        const temp = st.photos[idx + 1];
        st.photos[idx + 1] = st.photos[idx];
        st.photos[idx] = temp;
        renderPhotoList();
        updateLivePreview();
        saveDraft();
      };
      actions.append(downBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn ghost sm icon-only';
    delBtn.title = 'Remove photo';
    delBtn.innerHTML = '✕';
    delBtn.onclick = () => {
      st.photos.splice(idx, 1);
      renderPhotoList();
      updateLivePreview();
      saveDraft();
    };
    actions.append(delBtn);

    card.append(thumb, input, actions);
    container.append(card);
  });

  updateLivePreview();
}

async function handlePhotoUpload(files) {
  setFormMsg('');
  for (const f of files) {
    if (st.photos.length >= 5) {
      setFormMsg('Up to 5 photos can fit in the gift.');
      break;
    }
    if (!f.type.startsWith('image/')) {
      setFormMsg(`${f.name} is not an image file.`);
      continue;
    }
    try {
      const compressed = await shrinkPhoto(f);
      st.photos.push({ s: compressed, c: '' });
    } catch {
      setFormMsg(`Could not process ${f.name}.`);
    }
  }
  renderPhotoList();
  saveDraft();
}

$('#f-photos').onchange = e => {
  handlePhotoUpload(e.target.files);
  e.target.value = '';
};

const dropzone = $('#dropzone');
if (dropzone) {
  dropzone.onclick = () => $('#f-photos').click();
  dropzone.onkeydown = e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      $('#f-photos').click();
    }
  };
  ['dragenter', 'dragover'].forEach(ev => {
    dropzone.addEventListener(ev, e => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--gold)';
    });
  });
  ['dragleave', 'drop'].forEach(ev => {
    dropzone.addEventListener(ev, e => {
      e.preventDefault();
      dropzone.style.borderColor = '';
    });
  });
  dropzone.addEventListener('drop', e => {
    if (e.dataTransfer && e.dataTransfer.files) {
      handlePhotoUpload(e.dataTransfer.files);
    }
  });
}

/* ==============================================================
   WORKSHOP STEPPER & LIVE MINI PREVIEW
   ============================================================== */
const themeGradients = {
  violet: 'linear-gradient(135deg, #D98FA3, #EAE2F2)',
  rose: 'linear-gradient(135deg, #E0859D, #F5D3C8)',
  ocean: 'linear-gradient(135deg, #9E8EC2, #DCD6EC)',
  amber: 'linear-gradient(135deg, #DCA357, #FCE6CA)'
};

function updateLivePreview() {
  const toVal = $('#f-to').value.trim() || 'Someone Special';
  const fromVal = $('#f-from').value.trim() || 'You';
  $('#prevFor').textContent = `For ${toVal}, from ${fromVal}`;

  const currentTheme = $('#f-theme')?.value || 'violet';
  const themeDot = $('#prevThemeDot');
  if (themeDot) {
    themeDot.style.background = themeGradients[currentTheme] || themeGradients.violet;
  }

  const notes = getFormNotes();
  const photoCount = st.photos.length;
  const hasLetter = $('#f-letter').value.trim().length > 0;

  const statParts = [];
  if (photoCount) statParts.push(`${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`);
  if (notes.length) statParts.push(`${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`);
  if (hasLetter) statParts.push('Letter');

  $('#prevStats').textContent = statParts.length ? statParts.join(' • ') : 'Ready to personalize';

  try {
    const raw = readForm();
    const encoded = enc(raw);
    const estBytes = encoded.length;
    const estKb = Math.ceil(estBytes / 1024);
    const pct = Math.min(100, Math.max(5, (estBytes / MAX_LINK_LEN) * 100));

    $('#meterFill').style.width = `${pct}%`;
    $('#meterText').textContent = `${estKb} KB / 100 KB`;
  } catch {
    $('#meterFill').style.width = '10%';
    $('#meterText').textContent = '2 KB / 100 KB';
  }
}

function updateStepperUI(isForward) {
  const cur = st.currentStep;

  $$('.step-tab').forEach(tab => {
    const stepNum = +tab.dataset.step;
    const isActive = stepNum === cur;
    tab.classList.toggle('active', isActive);
    tab.classList.toggle('done', stepNum < cur);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  $$('.workshop-pane').forEach(pane => {
    const stepNum = +pane.dataset.step;
    const isActive = stepNum === cur;
    pane.classList.remove('pane-forward', 'pane-backward');
    if (isActive) {
      if (isForward === true) pane.classList.add('pane-forward');
      else if (isForward === false) pane.classList.add('pane-backward');
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });

  const btnBack = $('#btnBackStep');
  const btnNext = $('#btnNextStep');
  const btnSkip = $('#btnSkipStep');
  const btnWrap = $('#btnWrapGift');

  btnBack.style.visibility = cur > 1 ? 'visible' : 'hidden';

  const isOptionalStep = (cur === 2 || cur === 3 || cur === 4);
  btnSkip.style.display = isOptionalStep ? 'inline-flex' : 'none';

  if (cur === st.totalSteps) {
    btnNext.style.display = 'none';
    btnWrap.style.display = 'inline-flex';
  } else {
    btnNext.style.display = 'inline-flex';
    btnWrap.style.display = 'none';
  }

  setFormMsg('');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateCurrentStep() {
  setFormMsg('');
  if (st.currentStep === 1) {
    const toInput = $('#f-to');
    const fromInput = $('#f-from');
    const to = toInput.value.trim();
    const from = fromInput.value.trim();

    toInput.classList.remove('invalid');
    fromInput.classList.remove('invalid');
    toInput.removeAttribute('aria-invalid');
    fromInput.removeAttribute('aria-invalid');

    if (!to) {
      toInput.classList.add('invalid');
      toInput.setAttribute('aria-invalid', 'true');
      setFormMsg('Please enter their name.');
      toInput.focus();
      return false;
    }
    if (!from) {
      fromInput.classList.add('invalid');
      fromInput.setAttribute('aria-invalid', 'true');
      setFormMsg('Please enter your name.');
      fromInput.focus();
      return false;
    }
  }
  return true;
}

function goToStep(targetStep) {
  if (targetStep === st.currentStep) return;
  const isForward = targetStep > st.currentStep;
  if (isForward && !validateCurrentStep()) return;
  st.currentStep = targetStep;
  updateStepperUI(isForward);
}

$('#btnNextStep').onclick = () => {
  if (!validateCurrentStep()) return;
  if (st.currentStep < st.totalSteps) {
    const rect = $('#btnNextStep').getBoundingClientRect();
    launchStepFlourish(rect.left + rect.width / 2, rect.top + rect.height / 2);
    goToStep(st.currentStep + 1);
  }
};

$('#btnBackStep').onclick = () => {
  if (st.currentStep > 1) {
    goToStep(st.currentStep - 1);
  }
};

$('#btnSkipStep').onclick = () => {
  if (st.currentStep < st.totalSteps) {
    goToStep(st.currentStep + 1);
  }
};

$$('.step-tab').forEach(tab => {
  tab.onclick = () => {
    goToStep(+tab.dataset.step);
  };
});

$('#f-letter').oninput = e => {
  $('#letterCount').textContent = `${e.target.value.length} / 900`;
  updateLivePreview();
  saveDraft();
};

['#f-to', '#f-from'].forEach(sel => {
  const el = $(sel);
  if (el) {
    el.addEventListener('input', () => {
      el.classList.remove('invalid');
      el.removeAttribute('aria-invalid');
      setFormMsg('');
      updateLivePreview();
      saveDraft();
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('#btnNextStep').click();
      }
    });
  }
});

['#f-age', '#f-date', '#f-greeting', '#f-signoff'].forEach(sel => {
  const el = $(sel);
  if (el) {
    el.addEventListener('input', () => {
      updateLivePreview();
      saveDraft();
    });
  }
});

for (let i = 1; i <= 5; i++) {
  const el = $(`#f-note-${i}`);
  if (el) {
    el.addEventListener('input', () => {
      updateLivePreview();
      saveDraft();
    });
  }
}

$('#f-cd').onchange = saveDraft;

function fillNextEmptyNote(p) {
  let filledIdx = 0;
  for (let i = 1; i <= 5; i++) {
    const el = $(`#f-note-${i}`);
    if (el && !el.value.trim()) {
      el.value = p;
      toast(`Note ${i} added! 🎈`);
      updateLivePreview();
      saveDraft();
      filledIdx = i;
      el.classList.remove('field-highlight');
      void el.offsetWidth;
      el.classList.add('field-highlight');
      setTimeout(() => el.classList.remove('field-highlight'), 1000);
      break;
    }
  }
  if (!filledIdx) toast('All 5 balloon notes are filled.');
}

const tonePrompts = {
  warm: [
    'You make every room warmer just by being in it.',
    'Still my favourite person to laugh with.',
    'Remember that unforgettable night under the stars?',
    'Here’s to another year of unstoppable adventures together!'
  ],
  friend: [
    'Partner in crime, chaotic genius, best friend for life.',
    'Nobody gets my terrible jokes like you do.',
    'Remember our spontaneous road trip that went completely sideways?',
    'I’m always in your corner, through everything.'
  ],
  family: [
    'So grateful for every memory and wisdom you give.',
    'You have the kindest, most generous heart in our family.',
    'Thank you for always being my steady rock.',
    'Wishing you radiant health, peace, and endless joy.'
  ],
  playful: [
    'Another year older, none the wiser, exactly how I like you!',
    'Statistically proven to be the most hilarious person alive.',
    'Don’t worry about getting older, you’re basically vintage gold.',
    'Let’s eat cake until we can’t move.'
  ]
};

$$('#toneChips .chip').forEach(chip => {
  chip.onclick = () => {
    $$('#toneChips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    st.tone = chip.dataset.tone;
    saveDraft();

    const rect = chip.getBoundingClientRect();
    if (rect.width > 0) {
      spawnMagicSparkles(rect.left + rect.width / 2, rect.top + rect.height / 2, 7);
    }

    const prompts = tonePrompts[st.tone] || tonePrompts.warm;
    const container = $('#promptChips');
    container.textContent = '';
    prompts.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip prompt-chip';
      btn.dataset.prompt = p;
      btn.textContent = `"${p.slice(0, 32)}..."`;
      btn.onclick = () => fillNextEmptyNote(p);
      container.append(btn);
    });
  };
});

$$('.prompt-chip').forEach(btn => {
  btn.onclick = () => fillNextEmptyNote(btn.dataset.prompt);
});

$$('#themePicker .theme-card').forEach(card => {
  card.onclick = () => {
    $$('#themePicker .theme-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const theme = card.dataset.theme;
    $('#f-theme').value = theme;
    document.body.dataset.theme = theme;
    updateLivePreview();
    saveDraft();
  };
});

/* ==============================================================
   WRAP YOUR GIFT (Share Modal & Generation)
   ============================================================== */
function wrapGiftAction() {
  try {
    const data = readForm();
    st.data = data;
    const link = makeLink();
    st.link = link;

    AudioEngine.sfx.ribbon();
    flashBloom();
    launchConfetti();

    $('#modalLinkOut').value = link;
    $('#shareModal').hidden = false;
  } catch (err) {
    setFormMsg(err.ok ? err.message : 'Please check your inputs and try again.');
  }
}

$('#btnWrapGift').onclick = wrapGiftAction;
$('#form').onsubmit = e => {
  e.preventDefault();
  wrapGiftAction();
};

$('#modalClose').onclick = () => {
  $('#shareModal').hidden = true;
};

$('#shareModal').onclick = e => {
  if (e.target === $('#shareModal')) $('#shareModal').hidden = true;
};

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const sm = $('#shareModal');
    if (sm && !sm.hidden) sm.hidden = true;
  }
});

$('#modalBtnCopy').onclick = () => {
  copyText($('#modalLinkOut').value);
};

$('#modalBtnShare').onclick = () => {
  shareUrl($('#modalLinkOut').value);
};

$('#modalBtnPreview').onclick = () => {
  $('#shareModal').hidden = true;
  try {
    st.data = readForm();
    st.mode = 'preview';
    beginExperience();
  } catch (err) {
    toast(err.message || 'Error launching preview');
  }
};

/* ==============================================================
   LIVING BIRTHDAY ATMOSPHERE & BACKGROUND SYSTEM
   ============================================================== */
function createBgBalloonSvg(colorConfig) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const uid = 'bgbal_' + Math.random().toString(36).slice(2, 9);
  svg.setAttribute('viewBox', '0 0 60 120');
  svg.setAttribute('width', '44');
  svg.setAttribute('height', '88');
  svg.setAttribute('aria-hidden', 'true');
  svg.className.baseVal = 'bg-item bg-balloon';

  svg.innerHTML = `
    <defs>
      <radialGradient id="${uid}" cx="35%" cy="30%" r="65%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/>
        <stop offset="40%" stop-color="${colorConfig.mid}" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="${colorConfig.dark}" stop-opacity="0.95"/>
      </radialGradient>
    </defs>
    <g class="balloon-body-wrap">
      <path class="balloon-string" d="M30 60 Q26 80 32 95 T30 118" fill="none" stroke="rgba(145, 129, 141, 0.45)" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M30 6 C44 6 54 18 54 34 C54 50 38 60 30 60 C22 60 6 50 6 34 C6 18 16 6 30 6 Z" fill="url(#${uid})" filter="drop-shadow(0 3px 8px rgba(64,52,59,0.06))"/>
      <polygon points="27,60 33,60 31,64 29,64" fill="${colorConfig.dark}" opacity="0.9"/>
      <ellipse cx="22" cy="22" rx="4" ry="7" transform="rotate(-25 22 22)" fill="#FFFFFF" opacity="0.6"/>
    </g>
  `;
  return svg;
}

function createBgRibbonSvg(color) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 34 84');
  svg.setAttribute('width', '26');
  svg.setAttribute('height', '68');
  svg.setAttribute('aria-hidden', 'true');
  svg.className.baseVal = 'bg-item bg-ribbon';

  svg.innerHTML = `
    <path d="M17 3 C29 19 5 35 21 51 C33 65 9 76 17 81" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>
  `;
  return svg;
}

function createBgStarSvg(color, size = 18) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', `${size}`);
  svg.setAttribute('height', `${size}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.className.baseVal = 'bg-item bg-star';

  svg.innerHTML = `
    <path d="M12 2 Q12 12 2 12 Q12 12 12 22 Q12 12 22 12 Q12 12 12 2 Z" fill="${color}"/>
    <circle cx="12" cy="12" r="2.2" fill="#FFFFFF"/>
  `;
  return svg;
}

function createBgPetalSvg(color) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.className.baseVal = 'bg-item bg-petal';

  svg.innerHTML = `
    <path d="M12 2 C20 6 22 16 12 22 C2 16 4 6 12 2 Z" fill="${color}" opacity="0.7"/>
  `;
  return svg;
}

function createBgHeartSvg(color) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.className.baseVal = 'bg-item bg-heart';

  svg.innerHTML = `
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="${color}" opacity="0.6"/>
  `;
  return svg;
}

function createBgBowSvg(color) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 28 24');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '19');
  svg.setAttribute('aria-hidden', 'true');
  svg.className.baseVal = 'bg-item bg-bow';

  svg.innerHTML = `
    <path d="M14 12 C9 5 2 7 6 13 C9 15 13 13 14 12 Z" fill="${color}"/>
    <path d="M14 12 C19 5 26 7 22 13 C19 15 15 13 14 12 Z" fill="${color}"/>
    <circle cx="14" cy="12" r="2.2" fill="#B35E74"/>
    <path d="M13 13 Q10 20 8 23 M15 13 Q18 20 20 23" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/>
  `;
  return svg;
}

function initLivingBackground() {
  if (RM) return;

  const bgBack = $('#bgLayerBack');
  const bgFront = $('#bgLayerFront');
  if (!bgBack || !bgFront) return;

  bgBack.textContent = '';
  bgFront.textContent = '';

  const balloonPalettes = [
    { mid: '#F5BAC9', dark: '#D98FA3' },
    { mid: '#DFD3EE', dark: '#B7A5D2' },
    { mid: '#FCE1D4', dark: '#F0A794' },
    { mid: '#FEF3DD', dark: '#E8C88B' },
    { mid: '#FAD1DC', dark: '#E0859D' }
  ];

  const ribbonColors = ['#D98FA3', '#CBB5E0', '#F5D3C8', '#E8C88B'];
  const starColors = ['#E8BF72', '#D98FA3', '#B7A5D2', '#DCA357'];
  const petalColors = ['#FAD1DC', '#FCE1D4', '#EAE2F2'];
  const bowColors = ['#D98FA3', '#E8BF72', '#B7A5D2'];

  const isMobile = window.innerWidth <= 640;

  function getSideLeft(index, total) {
    const isLeft = index % 2 === 0;
    if (isMobile) {
      return isLeft
        ? (2 + Math.random() * 10)
        : (86 + Math.random() * 10);
    }
    return isLeft
      ? (1.5 + (Math.random() * 18))
      : (79 + (Math.random() * 18));
  }

  // 1. Distant Back Layer (larger, slow, lower opacity, subtle blur)
  const backBalloonCount = isMobile ? 0 : (LOW ? 2 : 4);
  for (let i = 0; i < backBalloonCount; i++) {
    const el = createBgBalloonSvg(balloonPalettes[i % balloonPalettes.length]);
    const dur = 32 + Math.random() * 14;
    const swayDur = 5 + Math.random() * 3;
    const delay = -(Math.random() * dur);
    const left = getSideLeft(i, backBalloonCount);
    const driftX = (Math.random() - 0.5) * 30;

    el.style.left = `${left}%`;
    el.style.setProperty('--dur', `${dur}s`);
    el.style.setProperty('--delay', `${delay}s`);
    el.style.setProperty('--sway-dur', `${swayDur}s`);
    el.style.setProperty('--drift-x', `${driftX}px`);
    el.style.setProperty('--target-op', '0.28');
    el.style.transform = `scale(${1.25 + Math.random() * 0.25})`;

    bgBack.appendChild(el);
  }

  if (!isMobile) {
    for (let i = 0; i < 2; i++) {
      const el = createBgRibbonSvg(ribbonColors[i % ribbonColors.length]);
      const dur = 36 + Math.random() * 12;
      const delay = -(Math.random() * dur);
      const left = i === 0 ? (3 + Math.random() * 12) : (84 + Math.random() * 12);
      el.style.left = `${left}%`;
      el.style.setProperty('--dur', `${dur}s`);
      el.style.setProperty('--delay', `${delay}s`);
      el.style.setProperty('--target-op', '0.22');
      el.style.transform = `scale(1.3)`;
      bgBack.appendChild(el);
    }
  }

  // 2. Foreground / Midground Layer (crisp, detailed, varied elements)
  const frontBalloonCount = isMobile ? 4 : (LOW ? 5 : 7);
  for (let i = 0; i < frontBalloonCount; i++) {
    const el = createBgBalloonSvg(balloonPalettes[i % balloonPalettes.length]);
    const dur = 20 + Math.random() * 10;
    const swayDur = 3.5 + Math.random() * 2;
    const delay = -(Math.random() * dur);
    const left = getSideLeft(i, frontBalloonCount);
    const driftX = (Math.random() - 0.5) * 24;

    el.style.left = `${left}%`;
    el.style.setProperty('--dur', `${dur}s`);
    el.style.setProperty('--delay', `${delay}s`);
    el.style.setProperty('--sway-dur', `${swayDur}s`);
    el.style.setProperty('--drift-x', `${driftX}px`);
    el.style.setProperty('--target-op', isMobile ? '0.5' : '0.78');
    el.style.transform = `scale(${0.85 + Math.random() * 0.25})`;

    bgFront.appendChild(el);
  }

  // Curled Ribbons
  const ribbonCount = isMobile ? 2 : (LOW ? 2 : 4);
  for (let i = 0; i < ribbonCount; i++) {
    const el = createBgRibbonSvg(ribbonColors[i % ribbonColors.length]);
    const dur = 24 + Math.random() * 10;
    const delay = -(Math.random() * dur);
    const left = getSideLeft(i, ribbonCount);
    el.style.left = `${left}%`;
    el.style.setProperty('--dur', `${dur}s`);
    el.style.setProperty('--delay', `${delay}s`);
    el.style.setProperty('--drift-x', `${(Math.random() - 0.5) * 20}px`);
    el.style.setProperty('--target-op', isMobile ? '0.45' : '0.68');
    bgFront.appendChild(el);
  }

  // Twinkling Sparkle Stars
  const starCount = isMobile ? 4 : (LOW ? 6 : 10);
  for (let i = 0; i < starCount; i++) {
    const el = createBgStarSvg(starColors[i % starColors.length], 16 + Math.floor(Math.random() * 8));
    const dur = 3 + Math.random() * 3;
    const delay = -(Math.random() * dur);
    const left = getSideLeft(i, starCount);
    const top = 8 + Math.random() * 84;

    el.style.left = `${left}%`;
    el.style.top = `${top}%`;
    el.style.setProperty('--dur', `${dur}s`);
    el.style.setProperty('--delay', `${delay}s`);
    bgFront.appendChild(el);
  }

  // Petals
  const petalCount = isMobile ? 2 : (LOW ? 3 : 5);
  for (let i = 0; i < petalCount; i++) {
    const el = createBgPetalSvg(petalColors[i % petalColors.length]);
    const dur = 22 + Math.random() * 8;
    const delay = -(Math.random() * dur);
    const left = getSideLeft(i, petalCount);
    el.style.left = `${left}%`;
    el.style.setProperty('--dur', `${dur}s`);
    el.style.setProperty('--delay', `${delay}s`);
    el.style.setProperty('--target-op', isMobile ? '0.45' : '0.7');
    bgFront.appendChild(el);
  }

  // Tiny Hearts & Gift Bows
  if (!isMobile) {
    for (let i = 0; i < 3; i++) {
      const el = createBgHeartSvg(ribbonColors[i % ribbonColors.length]);
      const dur = 24 + Math.random() * 8;
      const delay = -(Math.random() * dur);
      const left = getSideLeft(i, 3);
      el.style.left = `${left}%`;
      el.style.setProperty('--dur', `${dur}s`);
      el.style.setProperty('--delay', `${delay}s`);
      el.style.setProperty('--drift-x', `${(Math.random() - 0.5) * 16}px`);
      el.style.setProperty('--target-op', '0.6');
      bgFront.appendChild(el);
    }

    for (let i = 0; i < 2; i++) {
      const el = createBgBowSvg(bowColors[i % bowColors.length]);
      const dur = 28 + Math.random() * 8;
      const delay = -(Math.random() * dur);
      const left = i === 0 ? (4 + Math.random() * 12) : (82 + Math.random() * 12);
      el.style.left = `${left}%`;
      el.style.setProperty('--dur', `${dur}s`);
      el.style.setProperty('--delay', `${delay}s`);
      el.style.setProperty('--drift-x', `${(Math.random() - 0.5) * 16}px`);
      el.style.setProperty('--target-op', '0.65');
      bgFront.appendChild(el);
    }
  }
}

function triggerPageEntranceSparkles() {
  if (RM) return;
  setTimeout(() => {
    const card = $('.workshop-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    if (rect.width > 0) {
      spawnMagicSparkles(rect.left + rect.width * 0.3, rect.top + 20, 5);
      setTimeout(() => spawnMagicSparkles(rect.left + rect.width * 0.7, rect.top + 20, 5), 180);
    }
  }, 250);
}

/* ==============================================================
   PARTICLE CANVAS (Confetti, Sparkles & Grand Finale Flourish)
   ============================================================== */
const canvas = $('#fx');
const ctx = canvas.getContext('2d');
let particles = [];
let animFrameId = 0;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function launchConfetti() {
  const count = RM ? 20 : LOW ? 50 : 90;
  const colors = ['#D98FA3', '#EAE2F2', '#E0859D', '#FCE6CA', '#DCA357', '#FFFFFF'];
  for (let i = 0; i < count; i++) {
    particles.push({
      type: 'confetti',
      x: window.innerWidth / 2 + (Math.random() - 0.5) * window.innerWidth * 0.35,
      y: window.innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      r: Math.random() * 4 + 2.5,
      a: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 0.3,
      c: colors[i % colors.length],
      life: 1
    });
  }
  if (!animFrameId) animFrameId = requestAnimationFrame(renderParticles);
}

// Subtle confetti flourish on step transition
function launchStepFlourish(x, y) {
  if (RM) return;
  const count = LOW ? 10 : 18;
  const colors = ['#D98FA3', '#EAE2F2', '#E0859D', '#FCE6CA', '#F5D3C8', '#FFFFFF'];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
    const speed = Math.random() * 8 + 4;
    particles.push({
      type: 'confetti',
      x: x + (Math.random() - 0.5) * 20,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: Math.random() * 3 + 2,
      a: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 0.25,
      c: colors[i % colors.length],
      life: 1
    });
  }
  spawnMagicSparkles(x, y - 8, 6);
  if (!animFrameId) animFrameId = requestAnimationFrame(renderParticles);
}

// Floating celebratory balloons on canvas for grand finale
function launchCelebrationBalloons() {
  if (RM) return;
  const count = LOW ? 3 : 6;
  const colors = [
    { fill: '#F2BAC9', knot: '#C27387' },
    { fill: '#DFD3EE', knot: '#9E89BD' },
    { fill: '#FCE1D4', knot: '#DE8974' },
    { fill: '#FEF3DD', knot: '#DCA357' },
    { fill: '#E8A2B5', knot: '#B35E74' }
  ];
  for (let i = 0; i < count; i++) {
    const col = colors[i % colors.length];
    particles.push({
      type: 'balloon',
      x: window.innerWidth * (0.15 + (i / count) * 0.7) + (Math.random() - 0.5) * 50,
      y: window.innerHeight + 50 + Math.random() * 90,
      vy: -(Math.random() * 1.8 + 2.4),
      r: Math.random() * 6 + 18,
      a: Math.random() * Math.PI,
      sway: Math.random() * Math.PI * 2,
      c: col.fill,
      knotColor: col.knot,
      life: 1
    });
  }
  if (!animFrameId) animFrameId = requestAnimationFrame(renderParticles);
}

// Side confetti cannons
function launchSideCannons() {
  if (RM) return;
  const count = LOW ? 18 : 32;
  const colors = ['#D98FA3', '#EAE2F2', '#E0859D', '#FCE6CA', '#DCA357', '#FFFFFF', '#F5D3C8'];
  for (let i = 0; i < count; i++) {
    const angleL = -Math.PI / 4 + (Math.random() - 0.5) * 0.5;
    const speedL = Math.random() * 11 + 8;
    particles.push({
      type: 'confetti',
      x: -10,
      y: window.innerHeight * 0.75,
      vx: Math.cos(angleL) * speedL,
      vy: Math.sin(angleL) * speedL,
      r: Math.random() * 4 + 2.5,
      a: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 0.3,
      c: colors[i % colors.length],
      life: 1
    });

    const angleR = -3 * Math.PI / 4 + (Math.random() - 0.5) * 0.5;
    const speedR = Math.random() * 11 + 8;
    particles.push({
      type: 'confetti',
      x: window.innerWidth + 10,
      y: window.innerHeight * 0.75,
      vx: Math.cos(angleR) * speedR,
      vy: Math.sin(angleR) * speedR,
      r: Math.random() * 4 + 2.5,
      a: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 0.3,
      c: colors[(i + 2) % colors.length],
      life: 1
    });
  }
  if (!animFrameId) animFrameId = requestAnimationFrame(renderParticles);
}

// Grand Finale sequence (timed celebratory layers)
function launchGrandFinale() {
  launchConfetti();
  launchCelebrationBalloons();
  setTimeout(launchSideCannons, 450);
  setTimeout(() => {
    launchConfetti();
    spawnMagicSparkles(window.innerWidth / 2, window.innerHeight * 0.35, 12);
  }, 1400);
}

// "A Little Birthday Magic" Pointer Sparkle Trail
function spawnMagicSparkles(x, y, count = 4) {
  if (RM) return;
  const colors = ['#D98FA3', '#FCE6CA', '#EAE2F2', '#FFFFFF'];
  for (let i = 0; i < count; i++) {
    particles.push({
      type: 'sparkle',
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 16,
      vx: (Math.random() - 0.5) * 2.5,
      vy: -Math.random() * 2 - 0.5,
      r: Math.random() * 2.5 + 1.5,
      a: Math.random() * Math.PI,
      va: (Math.random() - 0.5) * 0.2,
      c: colors[i % colors.length],
      life: 1
    });
  }
  if (!animFrameId) animFrameId = requestAnimationFrame(renderParticles);
}

let lastPointerTime = 0;
window.addEventListener('pointermove', e => {
  const now = performance.now();
  if (now - lastPointerTime > 120) {
    lastPointerTime = now;
    spawnMagicSparkles(e.clientX, e.clientY, 1);
  }
}, { passive: true });

window.addEventListener('pointerdown', e => {
  spawnMagicSparkles(e.clientX, e.clientY, 5);
}, { passive: true });

function renderParticles() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  particles = particles.filter(p => {
    if (p.type === 'confetti') {
      return p.y < window.innerHeight + 20;
    } else if (p.type === 'balloon') {
      return p.y > -80 && p.life > 0.05;
    } else {
      return p.life > 0.05;
    }
  });

  for (const p of particles) {
    if (p.type === 'confetti') {
      p.vy += 0.36;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.a += p.va;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      ctx.restore();
    } else if (p.type === 'balloon') {
      p.y += p.vy;
      p.x += Math.sin(p.a) * 0.7;
      p.a += 0.03;
      p.sway += 0.04;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(p.sway) * 0.07);

      // String
      ctx.beginPath();
      ctx.moveTo(0, p.r * 1.3);
      ctx.quadraticCurveTo(Math.sin(p.sway) * 8, p.r * 2.2, 0, p.r * 3.2);
      ctx.strokeStyle = 'rgba(145, 129, 141, 0.45)';
      ctx.lineWidth = 1.3;
      ctx.stroke();

      // Balloon body
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 1.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.c;
      ctx.fill();

      // Specular highlight
      ctx.beginPath();
      ctx.ellipse(-p.r * 0.35, -p.r * 0.45, p.r * 0.22, p.r * 0.42, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fill();

      // Knot
      ctx.beginPath();
      ctx.moveTo(-3, p.r * 1.3);
      ctx.lineTo(3, p.r * 1.3);
      ctx.lineTo(0, p.r * 1.45);
      ctx.closePath();
      ctx.fillStyle = p.knotColor || p.c;
      ctx.fill();

      ctx.restore();
    } else if (p.type === 'sparkle') {
      p.life *= 0.93;
      p.x += p.vx;
      p.y += p.vy;
      p.r *= 0.98;

      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  animFrameId = particles.length ? requestAnimationFrame(renderParticles) : 0;
}

/* ==============================================================
   RECIPIENT JOURNEY: STAGES & SCENES
   ============================================================== */
const SceneHandlers = {};

function gotoScene(index) {
  clearInterval(st.tm);
  st.i = index;
  const stageName = st.stages[index];

  const pct = (index / Math.max(st.stages.length - 1, 1)) * 100;
  $('#progFill').style.width = `${pct}%`;

  const badgeMap = {
    intro: 'The Gift Box',
    count: 'Countdown',
    video: 'Birthday Film',
    cake: 'Make a Wish',
    balloons: 'Whispered Wishes',
    gallery: 'Memories',
    letter: 'A Sealed Letter',
    final: 'Celebration'
  };
  $('#stageBadge').textContent = badgeMap[stageName] || 'Birthday Gift';

  if (SceneHandlers[stageName]) {
    SceneHandlers[stageName]();
  }
  showStage(stageName);
}

const nextScene = () => gotoScene(st.i + 1);

function beginExperience() {
  const d = st.data;
  document.body.dataset.theme = d.theme;

  st.stages = [];

  const isFutureDate = d.cd && d.date && new Date(d.date + 'T00:00:00').getTime() > Date.now();
  if (isFutureDate) {
    st.stages.push('count');
  }

  st.stages.push('video');
  st.stages.push('cake');
  st.stages.push('balloons');
  if (d.photos && d.photos.length) st.stages.push('gallery');
  if (d.letter) st.stages.push('letter');
  st.stages.push('final');

  $('#bar').hidden = false;
  $('#btnEdit').hidden = st.mode !== 'preview';

  AudioEngine.start();
  gotoScene(0);
}

function returnToWorkshop() {
  AudioEngine.stop();
  VideoPlayer.pause();
  clearInterval(st.tm);
  $('#bar').hidden = true;
  st.mode = 'build';
  document.body.dataset.theme = $('#f-theme').value || 'violet';
  showStage('build');
}

/* Scene 1: Intro (The Wrapped Gift & Ribbon Magic) */
function initIntroScene() {
  const d = st.data;
  words($('#introH'), `${d.from} made a birthday surprise for ${d.to}`);
  $('#tagTo').textContent = `For ${d.to}`;
  $('#tagFrom').textContent = `From ${d.from}`;

  const giftBox = $('#giftBox');
  giftBox.classList.remove('unwrapping');

  const triggerUnwrap = () => {
    giftBox.classList.add('unwrapping');
    AudioEngine.sfx.ribbon();
    setTimeout(() => {
      AudioEngine.sfx.openGift();
      flashBloom();
      launchConfetti();
      setTimeout(beginExperience, 500);
    }, 600);
  };

  giftBox.onclick = triggerUnwrap;
  giftBox.onkeydown = e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerUnwrap();
    }
  };
  $('#introBtn').onclick = triggerUnwrap;
}

/* Scene 2: Countdown */
SceneHandlers.count = () => {
  const d = st.data;
  const targetDate = new Date(d.date + 'T00:00:00').getTime();
  words($('#cdH'), `${d.to}’s birthday is on its way`);

  const updateClock = () => {
    const diff = Math.max(0, targetDate - Date.now());
    const totalSecs = Math.floor(diff / 1000);

    const pad = n => String(n).padStart(2, '0');
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    $('#cdDays').textContent = pad(days);
    $('#cdHours').textContent = pad(hours);
    $('#cdMins').textContent = pad(mins);
    $('#cdSecs').textContent = pad(secs);

    $('#cdBtn').textContent = diff > 0 ? 'Open early anyway ✨' : 'It’s time! Open your gift';
  };

  updateClock();
  st.tm = setInterval(updateClock, 1000);
};
$('#cdBtn').onclick = nextScene;

/* Scene 3: Cinematic Video Player Scene */
SceneHandlers.video = () => {
  const d = st.data;
  words($('#videoH'), `A Special Moment for ${d.to}`);
  $('#videoPosterTitle').textContent = `Play Birthday Film for ${d.to}`;
  VideoPlayer.renderFrame(0);
};

/* Scene 4: Cake & The Birthday Wish Ritual */
SceneHandlers.cake = () => {
  const d = st.data;
  const candleCount = Math.max(1, Math.min(d.age || 5, 7));
  const container = $('#candles');
  const NS = 'http://www.w3.org/2000/svg';
  container.textContent = '';

  for (let i = 0; i < candleCount; i++) {
    const x = candleCount === 1 ? 150 : 85 + i * (130 / (candleCount - 1));
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'candle');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `Blow out candle ${i + 1}`);

    g.innerHTML = `
      <circle class="gl" cx="${x}" cy="60" r="22"/>
      <rect x="${x - 4}" y="74" width="8" height="34" rx="2" fill="#edd8b1"/>
      <path class="fl" d="M${x} 48 c7 8 7 15 0 22 c-7 -7 -7 -14 0 -22 z"/>
    `;
    container.append(g);
  }

  st.ck = 0;
  words($('#cakeH'), `${d.to}, it’s your moment`);
  $('#cakeP').textContent = 'Make a wish in your heart, then blow out the candles.';
  $('#cakeBtn').textContent = 'Make a Wish & Blow Candles ✨';
};

function extinguishCandle(candleEl) {
  if (st.ck !== 0 || candleEl.classList.contains('out')) return;

  candleEl.classList.add('out');
  AudioEngine.sfx.blow();

  // Spawn delicate smoke puff SVG
  const candleBox = candleEl.getBBox();
  const NS = 'http://www.w3.org/2000/svg';
  const smoke = document.createElementNS(NS, 'circle');
  smoke.setAttribute('class', 'smoke-puff');
  smoke.setAttribute('cx', candleBox.x + candleBox.width / 2);
  smoke.setAttribute('cy', candleBox.y + 10);
  smoke.setAttribute('r', 6);
  smoke.setAttribute('fill', 'rgba(255,255,255,0.4)');
  $('#cake').append(smoke);
  setTimeout(() => smoke.remove(), 800);

  const remaining = $$('#candles .candle:not(.out)').length;
  if (remaining === 0) {
    st.ck = 1;
    $('#cakeP').textContent = 'Wish made! Now cut the cake.';
    $('#cakeBtn').textContent = 'Cut the Birthday Cake 🍰';
    AudioEngine.sfx.wax();
  }
}

$('#candles').onclick = e => {
  const c = e.target.closest('.candle');
  if (c) extinguishCandle(c);
};

$('#candles').onkeydown = e => {
  if (e.key === 'Enter' || e.key === ' ') {
    const c = e.target.closest('.candle');
    if (c) {
      e.preventDefault();
      extinguishCandle(c);
    }
  }
};

$('#cakeBtn').onclick = () => {
  if (st.ck === 0) {
    // Extinguish candles in sequence
    $$('#candles .candle').forEach((c, idx) => {
      setTimeout(() => extinguishCandle(c), idx * 160);
    });
  } else if (st.ck === 1) {
    st.ck = 2;
    launchConfetti();
    AudioEngine.sfx.party();
    flashBloom();
    $('#cakeP').textContent = 'Your wish is in the stars!';
    $('#cakeBtn').textContent = 'Continue Journey →';
  } else if (st.ck === 2) {
    AudioEngine.sfx.cut();
    nextScene();
  }
};

/* Scene 5: Floating Balloons, Balloon Trees & Discovered Tray */
SceneHandlers.balloons = () => {
  const notes = (st.data.notes && st.data.notes.length)
    ? st.data.notes
    : [
      `You make every room warmer just by being in it.`,
      `Still my absolute favourite person to laugh with.`,
      `Here’s to another year of unforgettable adventures!`
    ];

  const sky = $('#sky');
  const tray = $('#discoveredTray');
  sky.textContent = '';
  tray.textContent = '';
  tray.hidden = true;
  st.popped = 0;
  st.discoveredNotes = [];

  words($('#balH'), `Notes in the sky for ${st.data.to}`);
  $('#balSub').textContent = 'Tap each floating balloon to release the secret message inside.';
  $('#balBtn').hidden = true;
  $('#noteCard').textContent = 'Tap a balloon floating above to discover a secret message.';

  notes.forEach((noteText, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bl';

    const xPos = notes.length === 1 ? 50 : 12 + idx * (76 / (notes.length - 1));
    const yOffset = ['0px', '50px', '20px', '40px'][idx % 4];
    const hues = [345, 330, 38, 265, 355, 290];

    btn.style.setProperty('--x', `${xPos}%`);
    btn.style.setProperty('--y', yOffset);
    btn.style.setProperty('--h', hues[idx % hues.length]);
    btn.style.setProperty('--d', `${idx * 0.6}s`);
    btn.setAttribute('aria-label', `Balloon ${idx + 1} of ${notes.length}`);

    btn.onclick = () => {
      btn.disabled = true;
      AudioEngine.sfx.pop();
      launchConfetti();

      // Update active note card
      const noteCard = $('#noteCard');
      noteCard.textContent = noteText;
      noteCard.classList.remove('rev');
      void noteCard.offsetWidth;
      noteCard.classList.add('rev');

      // Add to discovered tray
      st.discoveredNotes.push({ text: noteText, index: idx + 1 });
      tray.hidden = false;
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'discovered-pill cur';
      pill.textContent = `💌 Note ${idx + 1}`;
      pill.onclick = () => {
        $$('.discovered-pill').forEach(p => p.classList.remove('cur'));
        pill.classList.add('cur');
        noteCard.textContent = noteText;
        noteCard.classList.remove('rev');
        void noteCard.offsetWidth;
        noteCard.classList.add('rev');
      };
      $$('.discovered-pill').forEach(p => p.classList.remove('cur'));
      tray.append(pill);

      st.popped++;
      if (st.popped === notes.length) {
        $('#balBtn').hidden = false;
        toast('All notes discovered! ✨');
      }
    };

    sky.append(btn);
  });
};
$('#balBtn').onclick = nextScene;

/* Scene 6: Memory Photo Gallery (Flipbook & Lightbox) */
SceneHandlers.gallery = () => {
  const slides = $('#slides');
  slides.textContent = '';
  slides.scrollLeft = 0;

  st.data.photos.forEach((photo, idx) => {
    const fig = document.createElement('figure');
    fig.className = 'slide';
    fig.setAttribute('tabindex', '0');
    fig.setAttribute('role', 'button');
    fig.setAttribute('aria-label', `Open full photo ${idx + 1}`);

    const hint = document.createElement('span');
    hint.className = 'slide-view-hint';
    hint.textContent = 'View full';

    const img = new Image();
    img.src = photo.s;
    img.alt = photo.c || `Memory ${idx + 1}`;

    const caption = document.createElement('figcaption');
    caption.textContent = photo.c || '';

    fig.append(img, hint, caption);

    fig.onclick = () => PhotoViewer.open(idx);
    fig.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        PhotoViewer.open(idx);
      }
    };

    slides.append(fig);
  });

  updateSlideIndicator();
};

const slidesContainer = $('#slides');
function getSlideStep() {
  const first = slidesContainer.firstElementChild;
  return first ? first.offsetWidth : 1;
}

function updateSlideIndicator() {
  const total = st.data.photos ? st.data.photos.length : 0;
  if (!total) return;
  const current = Math.min(total, Math.max(1, Math.round(slidesContainer.scrollLeft / getSlideStep()) + 1));
  $('#galCount').textContent = `${current} of ${total}`;
}

function scrollSlide(dir) {
  slidesContainer.scrollBy({
    left: dir * getSlideStep(),
    behavior: RM ? 'auto' : 'smooth'
  });
}

slidesContainer.addEventListener('scroll', updateSlideIndicator);
slidesContainer.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') scrollSlide(1);
  if (e.key === 'ArrowLeft') scrollSlide(-1);
});

$('#galPrev').onclick = () => scrollSlide(-1);
$('#galNext').onclick = () => scrollSlide(1);
$('#galBtn').onclick = nextScene;

/* Scene 7: The Unfolding Letter */
SceneHandlers.letter = () => {
  $('#env').hidden = false;
  $('#env').classList.remove('open');
  $('#openLet').hidden = false;
  $('#sheet').hidden = true;
  $('#sheet').classList.remove('typing');
  $('#letBtn').hidden = true;
  $('#sig').hidden = true;
  $('#letterText').textContent = '';
  $('#letterGreeting').textContent = st.data.greeting || `Dear ${st.data.to},`;
};

function revealLetter() {
  const fullText = st.data.letter;
  const textContainer = $('#letterText');
  const sheet = $('#sheet');

  $('#openLet').hidden = true;
  $('#env').classList.add('open');
  AudioEngine.sfx.wax();

  $('#letterFull').textContent = fullText;
  $('#sig').textContent = `${st.data.signoff || 'With all my love,'}\n${st.data.from}`;

  setTimeout(() => {
    $('#env').hidden = true;
    sheet.hidden = false;

    let charIdx = 0;
    const finishTyping = () => {
      clearInterval(st.tm);
      textContainer.textContent = fullText;
      sheet.classList.remove('typing');
      $('#sig').hidden = false;
      $('#letBtn').hidden = false;
      $('#btnSkipTyping').hidden = true;
    };

    $('#btnSkipTyping').onclick = finishTyping;

    if (RM) {
      finishTyping();
      return;
    }

    sheet.classList.add('typing');
    st.tm = setInterval(() => {
      textContainer.textContent = fullText.slice(0, ++charIdx);
      if (charIdx >= fullText.length) {
        finishTyping();
      }
    }, 25);
  }, RM ? 0 : 650);
}

$('#openLet').onclick = revealLetter;
$('#env').onclick = revealLetter;
$('#env').onkeydown = e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    revealLetter();
  }
};
$('#letBtn').onclick = nextScene;

/* Scene 8: The Grand Finale */
SceneHandlers.final = () => {
  const d = st.data;
  const ageStr = d.age ? `${d.age}` : '';
  const headline = ageStr ? `Happy ${ageStr}th Birthday, ${d.to}!` : `Happy Birthday, ${d.to}!`;

  words($('#finH'), headline);
  $('#finBadge').textContent = ageStr ? `Celebrating ${ageStr} Years` : 'A Day to Celebrate';

  const toneSignoffs = {
    warm: `Here’s to another year of love, boundless laughter, and shared dreams. With all my love, ${d.from}.`,
    friend: `Here’s to another epic year of laughter, wild stories, and being unmatched. Cheers, ${d.from}!`,
    family: `May this year bring you radiant health, peace, and every happiness you deserve. Love, ${d.from}.`,
    playful: `May your cake be sweet, your gifts be bountiful, and your hangovers nonexistent! Cheers, ${d.from}!`
  };

  $('#finP').textContent = toneSignoffs[st.tone] || `Here’s to you and the incredible year ahead. With love, ${d.from}.`;
  $('#finD').textContent = d.date ? fmtDate(d.date) : '';

  $('#fEdit').hidden = st.mode !== 'preview';
  $('#fMake').hidden = st.mode !== 'view';

  flashBloom();
  AudioEngine.sfx.party();
  launchGrandFinale();
};

function getCurrentGiftLink() {
  if (st.mode === 'view') return location.href;
  try {
    st.link = makeLink();
    return st.link;
  } catch (e) {
    toast(e.ok ? e.message : 'Could not build share link.');
    return '';
  }
}

$('#fShare').onclick = () => shareUrl(getCurrentGiftLink());
$('#fCopy').onclick = () => {
  const l = getCurrentGiftLink();
  if (l) copyText(l);
};
$('#fMore').onclick = () => {
  launchGrandFinale();
  AudioEngine.sfx.party();
};
$('#fReplay').onclick = () => gotoScene(0);
$('#fEdit').onclick = returnToWorkshop;
$('#btnEdit').onclick = returnToWorkshop;

function createNewGift() {
  history.replaceState(null, '', location.href.split('#')[0]);
  returnToWorkshop();
}
$('#fMake').onclick = createNewGift;
$('#errMake').onclick = createNewGift;

/* ==============================================================
   INITIALIZATION & HASH ROUTING
   ============================================================== */
function initApp() {
  VideoPlayer.init();
  PhotoViewer.init();
  initLivingBackground();

  // Gentle background fireflies
  if (!RM) {
    const ffContainer = $('#fireflies');
    if (ffContainer) {
      const count = LOW ? 5 : 10;
      for (let i = 0; i < count; i++) {
        const span = document.createElement('span');
        span.className = 'firefly';
        const size = Math.random() * 2.5 + 1.5;
        span.style.cssText = `
          left: ${Math.random() * 100}%;
          bottom: ${-Math.random() * 20}px;
          width: ${size}px;
          height: ${size}px;
          animation-duration: ${12 + Math.random() * 14}s;
          animation-delay: ${-Math.random() * 16}s;
        `;
        ffContainer.append(span);
      }
    }
  }

  const match = /^#draft=([\w-]+)$/.exec(location.hash);

  if (!match) {
    st.mode = 'build';
    showStage('build');
    loadDraft();
    updateStepperUI();
    updateLivePreview();
    triggerPageEntranceSparkles();
    return;
  }

  try {
    if (match[1].length > MAX_LINK_LEN) {
      throw bad('This link is longer than the application accepts.');
    }
    const decoded = dec(match[1]);
    st.data = clean(decoded);
    st.mode = 'view';
    document.body.dataset.theme = st.data.theme;

    initIntroScene();
    showStage('intro');
  } catch (err) {
    $('#errMsg').textContent = err.ok
      ? err.message
      : 'The gift link seems incomplete or was cut off by the messaging app. Please ask the sender to copy and send the full link again.';
    showStage('error');
  }
}

// Pause heavy loops when page is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (VideoPlayer.isPlaying) VideoPlayer.pause();
  }
});

window.addEventListener('hashchange', () => location.reload());

initApp();
