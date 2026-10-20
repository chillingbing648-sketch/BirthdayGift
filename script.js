'use strict';

/* ==============================================================
   DOM HELPERS & GLOBAL CONFIGURATION
   ============================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOW = (navigator.hardwareConcurrency || 4) <= 4;
const MAX_LINK_LEN = 100000;

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
  tone: 'warm'
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
    .slice(0, 6)
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
  const notesText = $('#f-notes').value.split('\n').map(n => n.trim()).filter(Boolean);
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
    notes: notesText,
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
  toastTimer = setTimeout(() => el.classList.remove('on'), 2800);
}

function setFormMsg(text) {
  const el = $('#formMsg');
  el.textContent = text ? `⚠️ ${text}` : '';
}

function flashBloom() {
  const b = document.body;
  b.classList.remove('bloom');
  void b.offsetWidth;
  b.classList.add('bloom');
  setTimeout(() => b.classList.remove('bloom'), 1600);
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
      this.master.gain.value = this.muted ? 0 : 0.75;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  },

  playTone(freq, time, duration, type = 'sine', vol = 0.14, freqEnd = null) {
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
      AudioEngine.playTone(320, t, 0.25, 'triangle', 0.12, 640);
      AudioEngine.playTone(784, t + 0.1, 0.4, 'sine', 0.15);
      AudioEngine.playTone(1046, t + 0.18, 0.6, 'sine', 0.18);
    },

    openGift() {
      const c = AudioEngine.getCtx();
      if (!c) return;
      const t = c.currentTime;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        AudioEngine.playTone(f, t + i * 0.07, 1.2, 'sine', 0.16);
      });
    },

    pop() {
      const c = AudioEngine.getCtx();
      if (!c) return;
      const t = c.currentTime;
      AudioEngine.playTone(580, t, 0.12, 'sine', 0.35, 90);
      AudioEngine.playTone(880, t + 0.04, 0.3, 'triangle', 0.1);
    },

    blow() {
      const c = AudioEngine.getCtx();
      if (!c) return;
      const t = c.currentTime;
      const bufLen = Math.floor(c.sampleRate * 0.45);
      const buf = c.createBuffer(1, bufLen, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.8);
      }
      const src = c.createBufferSource();
      const filter = c.createBiquadFilter();
      const gain = c.createGain();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, t);
      filter.frequency.exponentialRampToValueAtTime(180, t + 0.4);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

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
      AudioEngine.playTone(420, t, 0.08, 'square', 0.08, 120);
      AudioEngine.playTone(650, t + 0.06, 0.35, 'triangle', 0.14);
      AudioEngine.playTone(980, t + 0.14, 0.5, 'sine', 0.12);
    },

    party() {
      const c = AudioEngine.getCtx();
      if (!c) return;
      const t = c.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((f, i) => {
        AudioEngine.playTone(f, t + i * 0.08, 0.8, 'triangle', 0.16);
      });
      AudioEngine.playTone(261.63, t, 1.5, 'sine', 0.2);
    },

    cut() {
      const c = AudioEngine.getCtx();
      if (!c) return;
      const t = c.currentTime;
      AudioEngine.playTone(850, t, 0.18, 'triangle', 0.16, 320);
      AudioEngine.playTone(523, t + 0.15, 0.5, 'sine', 0.14);
    }
  },

  // Soothing, gentle birthday music box arpeggios
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
      AudioEngine.playTone(chord[k], t + i * 0.32, 1.3, 'triangle', 0.045);
    });
    // Deep warm bass note
    AudioEngine.playTone(chord[0] / 2, t, 2.4, 'sine', 0.07);
  },

  updateUI() {
    const btnM = $('#btnMusic');
    const btnMute = $('#btnMute');
    if (btnM) {
      btnM.innerHTML = AudioEngine.playing
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg><span>Pause</span>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Music</span>`;
      btnM.setAttribute('aria-pressed', AudioEngine.playing);
    }
    if (btnMute) {
      btnMute.innerHTML = AudioEngine.muted
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg><span>Unmute</span>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg><span>Mute</span>`;
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
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.75;
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
    setFormMsg('Please choose a valid audio file (MP3, WAV, M4A, etc.).');
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
}

$('#f-photos').onchange = e => {
  handlePhotoUpload(e.target.files);
  e.target.value = '';
};

// Dropzone support
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
function updateLivePreview() {
  const toVal = $('#f-to').value.trim() || 'Someone Special';
  const fromVal = $('#f-from').value.trim() || 'You';
  $('#prevFor').textContent = `For ${toVal}, from ${fromVal}`;

  const notesCount = $('#f-notes').value.split('\n').filter(n => n.trim()).length;
  const photoCount = st.photos.length;
  const hasLetter = $('#f-letter').value.trim().length > 0;

  const statParts = [];
  if (photoCount) statParts.push(`📸 ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`);
  if (notesCount) statParts.push(`🎈 ${notesCount} ${notesCount === 1 ? 'note' : 'notes'}`);
  if (hasLetter) statParts.push('💌 Sealed letter');

  $('#prevStats').textContent = statParts.length ? statParts.join(' • ') : '✨ Ready to personalize';

  // Calculate payload size
  try {
    const raw = readForm();
    const encoded = enc(raw);
    const estBytes = encoded.length;
    const estKb = Math.ceil(estBytes / 1024);
    const pct = Math.min(100, Math.max(5, (estBytes / MAX_LINK_LEN) * 100));

    $('#meterFill').style.width = `${pct}%`;
    $('#meterFill').style.backgroundColor = pct > 85 ? '#ff5252' : pct > 60 ? '#f4c978' : 'var(--a1)';
    $('#meterText').textContent = `${estKb} KB / 100 KB`;
  } catch {
    $('#meterFill').style.width = '10%';
    $('#meterText').textContent = '2 KB / 100 KB';
  }
}

function updateStepperUI() {
  const cur = st.currentStep;

  // Step Tabs
  $$('.step-tab').forEach(tab => {
    const stepNum = +tab.dataset.step;
    tab.classList.toggle('active', stepNum === cur);
    tab.classList.toggle('done', stepNum < cur);
  });

  // Panes
  $$('.workshop-pane').forEach(pane => {
    const stepNum = +pane.dataset.step;
    pane.classList.toggle('active', stepNum === cur);
  });

  // Footer Buttons
  const btnBack = $('#btnBackStep');
  const btnNext = $('#btnNextStep');
  const btnSkip = $('#btnSkipStep');
  const btnWrap = $('#btnWrapGift');

  btnBack.style.visibility = cur > 1 ? 'visible' : 'hidden';

  // Optional steps skip button
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
    const to = $('#f-to').value.trim();
    const from = $('#f-from').value.trim();
    if (!to) {
      setFormMsg('Please enter their name so they feel celebrated.');
      $('#f-to').focus();
      return false;
    }
    if (!from) {
      setFormMsg('Please enter your name so they know who made this.');
      $('#f-from').focus();
      return false;
    }
  }
  return true;
}

$('#btnNextStep').onclick = () => {
  if (!validateCurrentStep()) return;
  if (st.currentStep < st.totalSteps) {
    st.currentStep++;
    updateStepperUI();
  }
};

$('#btnBackStep').onclick = () => {
  if (st.currentStep > 1) {
    st.currentStep--;
    updateStepperUI();
  }
};

$('#btnSkipStep').onclick = () => {
  if (st.currentStep < st.totalSteps) {
    st.currentStep++;
    updateStepperUI();
  }
};

$$('.step-tab').forEach(tab => {
  tab.onclick = () => {
    const target = +tab.dataset.step;
    if (target > st.currentStep && !validateCurrentStep()) return;
    st.currentStep = target;
    updateStepperUI();
  };
});

// Character counter for letter
$('#f-letter').oninput = e => {
  $('#letterCount').textContent = `${e.target.value.length} / 900`;
  updateLivePreview();
};

// Inputs live update
['#f-to', '#f-from', '#f-age', '#f-date', '#f-notes'].forEach(sel => {
  const el = $(sel);
  if (el) el.addEventListener('input', updateLivePreview);
});

// Tone Inspiration Chips
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

    // Update inspiration prompt chips
    const prompts = tonePrompts[st.tone] || tonePrompts.warm;
    const container = $('#promptChips');
    container.textContent = '';
    prompts.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip prompt-chip';
      btn.dataset.prompt = p;
      btn.textContent = `✨ "${p.slice(0, 32)}..."`;
      btn.onclick = () => {
        const area = $('#f-notes');
        const lines = area.value.split('\n').filter(Boolean);
        if (lines.length < 6) {
          lines.push(p);
          area.value = lines.join('\n');
          toast('Note added to balloons! 🎈');
          updateLivePreview();
        } else {
          toast('You can have up to 6 balloon notes.');
        }
      };
      container.append(btn);
    });
  };
});

// Initial prompt chips binding
$$('.prompt-chip').forEach(btn => {
  btn.onclick = () => {
    const p = btn.dataset.prompt;
    const area = $('#f-notes');
    const lines = area.value.split('\n').filter(Boolean);
    if (lines.length < 6) {
      lines.push(p);
      area.value = lines.join('\n');
      toast('Note added to balloons! 🎈');
      updateLivePreview();
    } else {
      toast('You can have up to 6 balloon notes.');
    }
  };
});

// Theme selection cards
$$('#themePicker .theme-card').forEach(card => {
  card.onclick = () => {
    $$('#themePicker .theme-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const theme = card.dataset.theme;
    $('#f-theme').value = theme;
    document.body.dataset.theme = theme;
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
   PARTICLE CANVAS (Confetti & Stardust)
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
  const count = RM ? 20 : LOW ? 65 : 120;
  const colors = ['#f4c978', '#ff7eb6', '#8b6cff', '#fff1c7', '#5aa7ff', '#7ef0d4'];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * window.innerWidth * 0.4,
      y: window.innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 16 - 5,
      r: Math.random() * 5 + 3,
      a: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 0.35,
      c: colors[i % colors.length]
    });
  }
  if (!animFrameId) animFrameId = requestAnimationFrame(renderParticles);
}

function renderParticles() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter(p => p.y < window.innerHeight + 25);

  for (const p of particles) {
    p.vy += 0.38;
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

  // Update progress bar
  const pct = (index / Math.max(st.stages.length - 1, 1)) * 100;
  $('#progFill').style.width = `${pct}%`;

  // Update badge
  const badgeMap = {
    intro: 'The Gift Box',
    count: 'Anticipation',
    cake: 'Make a Wish',
    balloons: 'Whispered Wishes',
    gallery: 'Memory Album',
    letter: 'A Sealed Letter',
    final: 'Grand Finale'
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

  // Build stage sequence dynamically
  st.stages = [];

  // Countdown stage (if enabled and date is ahead)
  const isFutureDate = d.cd && d.date && new Date(d.date + 'T00:00:00').getTime() > Date.now();
  if (isFutureDate) {
    st.stages.push('count');
  }

  // Core celebratory stages
  st.stages.push('cake');
  if (d.notes && d.notes.length) st.stages.push('balloons');
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
  clearInterval(st.tm);
  $('#bar').hidden = true;
  st.mode = 'build';
  document.body.dataset.theme = $('#f-theme').value || 'violet';
  showStage('build');
}

/* Scene 1: Intro (The 3D Wrapped Gift) */
function initIntroScene() {
  const d = st.data;
  words($('#introH'), `${d.from} made a birthday surprise for ${d.to}`);
  $('#tagTo').textContent = `For ${d.to}`;
  $('#tagFrom').textContent = `With love, ${d.from}`;

  const giftBox = $('#giftBox');
  giftBox.classList.remove('unwrapping');

  const triggerUnwrap = () => {
    giftBox.classList.add('unwrapping');
    AudioEngine.sfx.ribbon();
    setTimeout(() => {
      AudioEngine.sfx.openGift();
      flashBloom();
      launchConfetti();
      setTimeout(beginExperience, 600);
    }, 700);
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

/* Scene 3: Cake & Wish Ritual */
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
      <circle class="gl" cx="${x}" cy="60" r="24"/>
      <rect x="${x - 4}" y="74" width="8" height="34" rx="2" fill="#fcf2dc"/>
      <path class="fl" d="M${x} 48 c7 8 7 15 0 22 c-7 -7 -7 -14 0 -22 z"/>
    `;
    container.append(g);
  }

  st.ck = 0; // 0 = unblown, 1 = blown out (make wish), 2 = wish made (cut cake)
  words($('#cakeH'), `${d.to}, it’s your moment`);
  $('#cakeP').textContent = 'Tap each glowing flame, or blow them all out together.';
  $('#cakeBtn').textContent = 'Blow out the candles';
};

function extinguishCandle(candleEl) {
  if (st.ck !== 0 || candleEl.classList.contains('out')) return;

  candleEl.classList.add('out');
  AudioEngine.sfx.blow();

  const remaining = $$('#candles .candle:not(.out)').length;
  const total = $$('#candles .candle').length;

  if (remaining === 0) {
    st.ck = 1;
    $('#cakeP').textContent = 'Close your eyes and make a wish...';
    $('#cakeBtn').textContent = 'I made a wish ✨';
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
    // Extinguish all candles in cascade
    $$('#candles .candle').forEach((c, idx) => {
      setTimeout(() => extinguishCandle(c), idx * 160);
    });
  } else if (st.ck === 1) {
    st.ck = 2;
    launchConfetti();
    AudioEngine.sfx.party();
    flashBloom();
    $('#cakeP').textContent = 'Your wish is in the stars. Now cut the cake!';
    $('#cakeBtn').textContent = 'Cut the cake 🍰';
  } else if (st.ck === 2) {
    AudioEngine.sfx.cut();
    nextScene();
  }
};

/* Scene 4: Floating Balloons */
SceneHandlers.balloons = () => {
  const notes = st.data.notes || [];
  const sky = $('#sky');
  sky.textContent = '';
  st.popped = 0;

  words($('#balH'), `Notes in the sky for ${st.data.to}`);
  $('#balSub').textContent = 'Tap each balloon to release the secret message inside.';
  $('#balBtn').hidden = true;
  $('#noteCard').textContent = 'Tap a balloon floating above to discover a secret message.';

  notes.forEach((noteText, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bl';

    const xPos = notes.length === 1 ? 50 : 12 + idx * (76 / (notes.length - 1));
    const yOffset = ['0px', '55px', '22px', '45px'][idx % 4];
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

      const noteCard = $('#noteCard');
      noteCard.textContent = noteText;
      noteCard.classList.remove('rev');
      void noteCard.offsetWidth;
      noteCard.classList.add('rev');

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

/* Scene 5: Memory Photo Gallery */
SceneHandlers.gallery = () => {
  const slides = $('#slides');
  slides.textContent = '';
  slides.scrollLeft = 0;

  st.data.photos.forEach((photo, idx) => {
    const fig = document.createElement('figure');
    fig.className = 'slide';

    const img = new Image();
    img.src = photo.s;
    img.alt = photo.c || `Memory ${idx + 1}`;

    const caption = document.createElement('figcaption');
    caption.textContent = photo.c || '';

    fig.append(img, caption);
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
  const total = st.data.photos.length;
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

/* Scene 6: The Wax-Sealed Letter */
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
    }, 28);
  }, RM ? 0 : 800);
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

/* Scene 7: Grand Finale Celebration */
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
  launchConfetti();
  setTimeout(launchConfetti, 1200);
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
  launchConfetti();
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
  // Check hash format (#draft=... or legacy)
  const match = /^#draft=([\w-]+)$/.exec(location.hash);

  if (!match) {
    // Creator Workshop mode
    st.mode = 'build';
    showStage('build');
    updateStepperUI();
    updateLivePreview();
    return;
  }

  // Recipient mode
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

window.addEventListener('hashchange', () => location.reload());

// Ambient stardust generator
if (!RM) {
  const dustContainer = $('#dust');
  if (dustContainer) {
    const starCount = LOW ? 5 : 12;
    for (let i = 0; i < starCount; i++) {
      const star = document.createElement('span');
      const size = 2 + Math.random() * 3.5;
      star.style.cssText = `
        left: ${Math.random() * 100}%;
        width: ${size}px;
        height: ${size}px;
        animation-duration: ${14 + Math.random() * 16}s;
        animation-delay: ${-Math.random() * 20}s;
      `;
      dustContainer.append(star);
    }
  }
}

// Start application
initApp();
