// ══════════════════════════════════════════════
//  DATA: Sentences organized by letter group
// ══════════════════════════════════════════════
// (Conteúdos movidos para content.js)


// ══════════════════════════════════════════════
//  BYTE DIALOGUES
// ══════════════════════════════════════════════
const BYTE_TIPS = [
  'Já ouves a frase? Agora digita! 🎵',
  'Devagar se vai ao longe! 🐢',
  'Carinha em cima, estás a arrasar! 🌟',
  'Letra a letra, palavra a palavra! 📝',
  'Fantástico! Continua! 💪',
  'Uau, és incrível! 🚀',
  'Estou orgulhoso de ti! 😊',
  'Clica em 🔊 para ouvir de novo!',
  'Não desistas, tu consegues! 💛',
];

const BYTE_ERRORS = [
  'Ops! Tenta outra vez! 🙈',
  'Quase! Ouve de novo! 🔊',
  'Não foi desta! Força! 💪',
  'Um erro não é o fim! 😄',
  'Clica em 🔊 para ajuda! 🎵',
];

const BYTE_SUCCESS = [
  'FANTÁSTICO! Arrasaste! 🌟',
  'Muito bem! És demais! 🏆',
  'Incrível! Mais uma estrela! ⭐',
  'Parabéns! Continua assim! 🎉',
  'UÊÊ! Conseguiste! 🎊',
];

// ══════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════
let currentLevel = 0;
let currentSentenceIdx = 0;
let currentSentence = '';
let currentPos = 0;
let totalStars = 0;
let totalCorrect = 0;
let totalErrors = 0;
let completedLevels = [];
let speechSynth = window.speechSynthesis;
let voices = [];
let inputLocked = false;
let errorCount = 0; // errors on current sentence

let sentenceErrors = 0; // errors on the current sentence (for stars)


// ──────────────────────────────────────────────
//  SETTINGS + SAVE (offline-friendly)
// ──────────────────────────────────────────────
const STORAGE_KEY = 'byte_typing_progress_v1';
const SETTINGS_KEY = 'byte_typing_settings_v1';

let settings = {
  sound: true,
  autoSpeak: true,
  confetti: true,
  teacherMode: false,
  teacherPinHash: '',
  allowSkip: true,
  showNextKey: true,
  bigFont: false,
  schoolName: '',
  teacherName: ''
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    settings = { ...settings, ...parsed };
  } catch {}
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

function saveState() {
  try {
    const payload = {
      v: 1,
      savedAt: new Date().toISOString(),
      currentLevel,
      currentSentenceIdx,
      totalStars,
      totalCorrect,
      totalErrors,
      completedLevels
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearSaved() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}


function hashPin(pin) {
  // SHA-256 via SubtleCrypto (async). Para simplicidade, devolvemos string hex.
  // Nota: isto não é segurança “a sério”, mas evita guardar o PIN em texto simples.
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin)).then(buf => {
    const arr = Array.from(new Uint8Array(buf));
    return arr.map(b => b.toString(16).padStart(2,'0')).join('');
  });
}

async function ensureTeacherPin() {
  // Se ainda não existir PIN, pede para definir
  if (!settings.teacherPinHash) {
    const p1 = prompt('Definir PIN do modo professor (4 dígitos):');
    if (!p1) return false;
    if (!/^[0-9]{4}$/.test(p1)) { alert('PIN inválido. Usa 4 dígitos.'); return false; }
    const p2 = prompt('Confirma o PIN:');
    if (p2 !== p1) { alert('Os PINs não coincidem.'); return false; }
    settings.teacherPinHash = await hashPin(p1);
    saveSettings();
    return true;
  }
  return true;
}

async function verifyTeacherPin() {
  if (!settings.teacherPinHash) return await ensureTeacherPin();
  const pin = prompt('PIN do modo professor:');
  if (!pin) return false;
  const h = await hashPin(pin);
  const ok = h === settings.teacherPinHash;
  if (!ok) alert('PIN incorreto.');
  return ok;
}



// ══════════════════════════════════════════════
//  SPEECH
// ══════════════════════════════════════════════
function loadVoices() {
  voices = speechSynth.getVoices();
}
if (speechSynth.onvoiceschanged !== undefined) {
  speechSynth.onvoiceschanged = loadVoices;
}
loadVoices();

function getPortugueseVoice() {
  // Prefer pt-PT, then pt-BR, then any Portuguese
  const ptPT = voices.find(v => v.lang === 'pt-PT');
  const ptBR = voices.find(v => v.lang === 'pt-BR');
  const pt = voices.find(v => v.lang.startsWith('pt'));
  return ptPT || ptBR || pt || null;
}

function speak(text, onEnd) {
  if (!settings.sound) { if (onEnd) onEnd(); return; }
  if (!speechSynth) return;
  speechSynth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = getPortugueseVoice();
  if (voice) utter.voice = voice;
  utter.lang = 'pt-PT';
  utter.rate = 0.82;
  utter.pitch = 1.1;
  utter.volume = 1;
  if (onEnd) utter.onend = onEnd;
  speechSynth.speak(utter);
}

function readSentence() {
  const btn = document.getElementById('audio-btn');
  btn.classList.add('playing');
  setByteBubble('A ler a frase... 🔊');
  speak(currentSentence, () => {
    btn.classList.remove('playing');
    setByteBubble(BYTE_TIPS[Math.floor(Math.random() * BYTE_TIPS.length)]);
  });
}

function speakByte(text) {
  speak(text);
}

// ══════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════
function setByteBubble(text) {
  const el = document.getElementById('byte-bubble');
  el.textContent = text;
  el.style.animation = 'none';
  requestAnimationFrame(() => { el.style.animation = ''; });
}

function setByteState(state) {
  const col = document.getElementById('byte-col');
  col.classList.remove('byte-happy', 'byte-error');
  if (state) col.classList.add(state);
  const mouth = document.getElementById('byte-mouth');
  if (state === 'byte-happy') {
    mouth.setAttribute('d', 'M 38 52 Q 55 66 72 52');
  } else if (state === 'byte-error') {
    mouth.setAttribute('d', 'M 43 58 Q 55 50 67 58');
  } else {
    mouth.setAttribute('d', 'M 43 52 Q 55 62 67 52');
  }
}

function buildSentenceDisplay() {
  const container = document.getElementById('sentence-chars');
  container.innerHTML = '';
  for (let i = 0; i < currentSentence.length; i++) {
    const ch = currentSentence[i];
    const span = document.createElement('span');
    if (ch === ' ') {
      span.className = 'char-box space';
      span.innerHTML = '&nbsp;';
    } else {
      span.className = 'char-box';
      span.textContent = ch;
    }
    span.id = `char-${i}`;
    container.appendChild(span);
  }
  updateCharDisplay();
}

function updateCharDisplay() {
  for (let i = 0; i < currentSentence.length; i++) {
    const span = document.getElementById(`char-${i}`);
    if (!span) continue;
    span.classList.remove('typed', 'current');
    if (i < currentPos) span.classList.add('typed');
    else if (i === currentPos) span.classList.add('current');
  }
  updateNextKeyHint();
}

function updateNextKeyHint() {
  const hint = document.getElementById('next-key-hint');
  const badge = document.getElementById('next-key-badge');
  if (currentPos >= currentSentence.length) {
    hint.style.opacity = '0';
    return;
  }
  hint.style.opacity = '1';
  const nextChar = currentSentence[currentPos];
  if (nextChar === ' ') {
    badge.textContent = 'espaço';
    badge.className = 'key-badge space-key';
  } else {
    badge.textContent = nextChar.toUpperCase();
    badge.className = 'key-badge';
  }
}

function updateProgress() {
  const totalSentences = LEVELS.reduce((s, l) => s + l.sentences.length, 0);
  const done = LEVELS.slice(0, currentLevel).reduce((s, l) => s + l.sentences.length, 0) + currentSentenceIdx;
  const pct = Math.round((done / totalSentences) * 100);
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('stars-count').textContent = '⭐ ' + totalStars;
  document.getElementById('correct-count').textContent = totalCorrect;
  document.getElementById('error-count').textContent = totalErrors;
  document.getElementById('cur-level').textContent = currentLevel + 1;
  document.getElementById('total-levels').textContent = LEVELS.length;  saveState();
}


function buildLevelSelector() {
  const container = document.getElementById('level-selector');
  container.innerHTML = '';
  LEVELS.forEach((lvl, i) => {
    const btn = document.createElement('button');
    btn.className = 'level-btn' + (i === currentLevel ? ' active' : '') + (completedLevels.includes(i) ? ' done' : '');
    btn.innerHTML = `${lvl.icon} ${lvl.letter}`;
    btn.onclick = () => jumpToLevel(i);
    container.appendChild(btn);
  });
}

// ══════════════════════════════════════════════
//  GAME LOGIC
// ══════════════════════════════════════════════
function startGame() {
  clearSaved();
  totalStars = 0;
  totalCorrect = 0;
  totalErrors = 0;
  completedLevels = [];
  document.getElementById('intro-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  loadLevel(0, 0);
  updateProgress();
  saveState();
}

function loadLevel(levelIdx, sentenceIdx) {
  currentLevel = levelIdx;
  currentSentenceIdx = sentenceIdx;
  const level = LEVELS[currentLevel];
  currentSentence = level.sentences[currentSentenceIdx];
  currentPos = 0;
  errorCount = 0;
  sentenceErrors = 0;
  inputLocked = false;

  document.getElementById('level-badge').textContent = `${level.icon} ${level.name}`;
  document.getElementById('typing-input').value = '';
  document.getElementById('typing-input').className = '';
  document.getElementById('input-icon').textContent = '⌨️';
  document.getElementById('next-key-hint').style.opacity = '1';

  buildSentenceDisplay();
  buildLevelSelector();
  updateProgress();

  setByteBubble('Ouve a frase! 🔊');
  setByteState(null);

  setTimeout(() => {
    if (settings.autoSpeak && settings.sound && !settings.teacherMode) {
      speak('Nível ' + level.name + '. ' + currentSentence, () => {
        setByteBubble(BYTE_TIPS[Math.floor(Math.random() * BYTE_TIPS.length)]);
      });
    } else {
      setByteBubble(BYTE_TIPS[Math.floor(Math.random() * BYTE_TIPS.length)]);
    }
  }, 250);
document.getElementById('typing-input').focus();  saveState();
}


function jumpToLevel(idx) {
  loadLevel(idx, 0);
}

function clearInput() {
  document.getElementById('typing-input').value = '';
  currentPos = 0;
  updateCharDisplay();
  document.getElementById('typing-input').className = '';
  document.getElementById('input-icon').textContent = '⌨️';
  setByteBubble('Recomeçamos! 💛');
  document.getElementById('typing-input').focus();
}


function restartSentence() {
  hideCelebration();
  setByteBubble('Vamos repetir esta frase! 🔁');
  setByteState(null);
  loadLevel(currentLevel, currentSentenceIdx);
}

function applySettingsToUI() {
  document.body.classList.toggle('teacher-mode', !!settings.teacherMode);
  document.body.classList.toggle('big-font', !!settings.bigFont);

  const btnSound = document.getElementById('toggle-sound');
  const btnTeacher = document.getElementById('toggle-teacher');
  if (btnSound) {
    btnSound.setAttribute('aria-pressed', settings.sound ? 'true' : 'false');
    btnSound.textContent = settings.sound ? '🔊 Som: Ligado' : '🔇 Som: Desligado';
  }
  const nk = document.getElementById('next-key-hint');
  if (nk) nk.style.display = settings.showNextKey ? 'flex' : 'none';

  const skipBtn = document.getElementById('btn-skip');
  if (skipBtn) {
    skipBtn.disabled = !settings.allowSkip;
    skipBtn.style.opacity = settings.allowSkip ? '1' : '0.55';
  }

  if (btnTeacher) {
    btnTeacher.setAttribute('aria-pressed', settings.teacherMode ? 'true' : 'false');
    btnTeacher.textContent = settings.teacherMode ? '👩‍🏫 Modo sala: Ligado' : '👩‍🏫 Modo sala: Desligado';
  }
}

async function wireHeaderButtons() {
  const btnSound = document.getElementById('toggle-sound');
  const btnTeacher = document.getElementById('toggle-teacher');
  const btnReset = document.getElementById('reset-progress');
  const btnPanel = document.getElementById('open-teacher-panel');

  if (btnSound) {
    btnSound.addEventListener('click', () => {
      settings.sound = !settings.sound;
      saveSettings();
      applySettingsToUI();
    });
  }
  const nk = document.getElementById('next-key-hint');
  if (nk) nk.style.display = settings.showNextKey ? 'flex' : 'none';

  const skipBtn = document.getElementById('btn-skip');
  if (skipBtn) {
    skipBtn.disabled = !settings.allowSkip;
    skipBtn.style.opacity = settings.allowSkip ? '1' : '0.55';
  }

  if (btnTeacher) {
    btnTeacher.addEventListener('click', async () => {
      const ok = await verifyTeacherPin();
      if (!ok) return;

      settings.teacherMode = !settings.teacherMode;
      if (settings.teacherMode) {
        settings.confetti = false;
        settings.autoSpeak = false;
      } else {
        settings.confetti = true;
        settings.autoSpeak = true;
      }
      saveSettings();
      applySettingsToUI();
    });
  }
  if (btnPanel) {
    btnPanel.addEventListener('click', async () => {
      const ok = await verifyTeacherPin();
      if (!ok) return;
      openTeacherPanel();
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      const okPin = await verifyTeacherPin();
      if (!okPin) return;

      const ok = confirm('Queres mesmo recomeçar do zero? (Isto apaga o progresso guardado.)');
      if (!ok) return;
      clearSaved();
      totalStars = 0;
      totalCorrect = 0;
      totalErrors = 0;
      completedLevels = [];
      document.getElementById('finish-screen').style.display = 'none';
      document.getElementById('intro-screen').style.display = 'block';
      document.getElementById('app').style.display = 'none';
      const cont = document.getElementById('btn-continue');
      if (cont) cont.style.display = 'none';
    });
  }
}

function continueGame() {
  document.getElementById('intro-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const saved = loadState();
  if (saved) {
    totalStars = saved.totalStars || 0;
    totalCorrect = saved.totalCorrect || 0;
    totalErrors = saved.totalErrors || 0;
    completedLevels = Array.isArray(saved.completedLevels) ? saved.completedLevels : [];
    const lvl = Math.max(0, Math.min(LEVELS.length - 1, saved.currentLevel || 0));
    const si = Math.max(0, saved.currentSentenceIdx || 0);
    loadLevel(lvl, si);
    updateProgress();
  } else {
    loadLevel(0, 0);
  }
}

function maybeShowContinueButton() {
  const saved = loadState();
  const cont = document.getElementById('btn-continue');
  const start = document.getElementById('btn-start');
  if (saved && cont) {
    cont.style.display = 'inline-flex';
    if (start) start.innerHTML = '<span>🚀</span> Começar do início';
  }
}

loadSettings();

function openTeacherPanel() {
  const modal = document.getElementById('teacher-panel');
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  // Fill fields
  document.getElementById('opt-allow-skip').checked = !!settings.allowSkip;
  document.getElementById('opt-show-nextkey').checked = !!settings.showNextKey;
  document.getElementById('opt-big-font').checked = !!settings.bigFont;
  document.getElementById('opt-confetti').checked = !!settings.confetti;
  document.getElementById('opt-autospeak').checked = !!settings.autoSpeak;
  document.getElementById('opt-sound').checked = !!settings.sound;
  document.getElementById('opt-school').value = settings.schoolName || '';
  document.getElementById('opt-teacher-name').value = settings.teacherName || '';
}

function closeTeacherPanel() {
  const modal = document.getElementById('teacher-panel');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

async function saveTeacherPanel() {
  settings.allowSkip = !!document.getElementById('opt-allow-skip').checked;
  settings.showNextKey = !!document.getElementById('opt-show-nextkey').checked;
  settings.bigFont = !!document.getElementById('opt-big-font').checked;
  settings.confetti = !!document.getElementById('opt-confetti').checked;
  settings.autoSpeak = !!document.getElementById('opt-autospeak').checked;
  settings.sound = !!document.getElementById('opt-sound').checked;
  settings.schoolName = (document.getElementById('opt-school').value || '').trim();
  settings.teacherName = (document.getElementById('opt-teacher-name').value || '').trim();

  saveSettings();
  applySettingsToUI();
  closeTeacherPanel();
  setByteBubble('Definições guardadas. ✅');
}

async function resetTeacherPin() {
  const ok = await verifyTeacherPin();
  if (!ok) return;
  settings.teacherPinHash = '';
  saveSettings();
  await ensureTeacherPin();
  alert('PIN atualizado com sucesso.');
}


document.addEventListener('DOMContentLoaded', () => {
  applySettingsToUI();
  wireHeaderButtons();
  maybeShowContinueButton();

  // Atalho secreto: Ctrl + Alt + P
  document.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.altKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      const ok = await verifyTeacherPin();
      if (!ok) return;
      openTeacherPanel();
    }
  });

  // Atalho secreto: pressão longa no título (≈ 0,9 s)
  const secretEl = document.getElementById('secret-open');
  if (secretEl) {
    let t = null;

    const startPress = () => {
      if (t) clearTimeout(t);
      t = setTimeout(async () => {
        const ok = await verifyTeacherPin();
        if (!ok) return;
        openTeacherPanel();
      }, 900);
    };

    const cancelPress = () => {
      if (t) clearTimeout(t);
      t = null;
    };

    secretEl.addEventListener('pointerdown', startPress);
    secretEl.addEventListener('pointerup', cancelPress);
    secretEl.addEventListener('pointerleave', cancelPress);
    secretEl.addEventListener('pointercancel', cancelPress);
  }

});


function skipSentence() {
  if (!settings.allowSkip) {
    setByteBubble('Esta turma não pode saltar. 😉');
    speakByte('Vamos tentar mais um bocadinho!');
    return;
  }
  setByteBubble('Tudo bem! 😊 Próxima!');
  speak('Vamos para a próxima!', () => {});
  nextSentence();
}

function nextSentence() {
  hideCelebration();
  const level = LEVELS[currentLevel];
  const nextIdx = currentSentenceIdx + 1;

  if (nextIdx < level.sentences.length) {
    loadLevel(currentLevel, nextIdx);
  } else {
    // Level complete
    if (!completedLevels.includes(currentLevel)) {
      completedLevels.push(currentLevel);
    }
    const nextLevel = currentLevel + 1;
    if (nextLevel < LEVELS.length) {
      speak('Nível completo! Muito bem!', () => {
        loadLevel(nextLevel, 0);
      });
    } else {
      showFinish();
    }
  }
}

// ══════════════════════════════════════════════
//  INPUT HANDLING
// ══════════════════════════════════════════════
document.getElementById('typing-input').addEventListener('input', handleInput);
document.getElementById('typing-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && currentPos >= currentSentence.length) {
    // Already complete, trigger next
  }
});

function handleInput(e) {
  if (inputLocked) {
    document.getElementById('typing-input').value = currentSentence.slice(0, currentPos);
    return;
  }

  const inputEl = document.getElementById('typing-input');
  const typed = inputEl.value;
  const expected = currentSentence.slice(0, typed.length);

  if (typed.length === 0) {
    currentPos = 0;
    updateCharDisplay();
    inputEl.className = '';
    document.getElementById('input-icon').textContent = '⌨️';
    return;
  }

  // Check last typed char
  const lastTyped = typed[typed.length - 1];
  const lastExpected = currentSentence[typed.length - 1];

  if (typed.length > currentSentence.length) {
    inputEl.value = currentSentence.slice(0, currentSentence.length);
    return;
  }

  // Case-insensitive comparison but keep original in display
  if (lastTyped.toLowerCase() === lastExpected.toLowerCase()) {
    // Correct!
    currentPos = typed.length;
    updateCharDisplay();
    inputEl.className = 'correct';
    document.getElementById('input-icon').textContent = '✅';

    playBeep(true);

    if (Math.random() < 0.25) {
      setByteBubble(BYTE_TIPS[Math.floor(Math.random() * BYTE_TIPS.length)]);
    }

    if (currentPos >= currentSentence.length) {
      onSentenceComplete();
    }
  } else {
    // Wrong!
    inputEl.value = typed.slice(0, -1); // Remove wrong char
    inputEl.className = 'incorrect';
    document.getElementById('input-icon').textContent = '❌';
    totalErrors++;
    sentenceErrors++;
    errorCount++;
    updateProgress();
    playBeep(false);

    const errMsg = BYTE_ERRORS[Math.floor(Math.random() * BYTE_ERRORS.length)];
    setByteBubble(errMsg);
    setByteState('byte-error');

    // Flash current char
    const span = document.getElementById(`char-${currentPos}`);
    if (span) {
      span.classList.add('wrong-flash');
      setTimeout(() => {
        span.classList.remove('wrong-flash');
        setByteState(null);
        inputEl.className = '';
        document.getElementById('input-icon').textContent = '⌨️';
      }, 400);
    }

    if (errorCount >= 3) {
      setByteBubble('Clica em 🔊 para ouvir!');
      speakByte('Não te preocupes! Clica no botão para ouvir a frase.');
      errorCount = 0;
    }
  }
}

function onSentenceComplete() {
  inputLocked = true;
  totalCorrect++;
    const starsThis = (sentenceErrors === 0) ? 3 : (sentenceErrors <= 2 ? 2 : 1);
  totalStars += starsThis;
  updateProgress();

  const msg = BYTE_SUCCESS[Math.floor(Math.random() * BYTE_SUCCESS.length)];
  setByteBubble(msg);
  setByteState('byte-happy');

  // Force correct value in input
  document.getElementById('typing-input').value = currentSentence;
  document.getElementById('input-icon').textContent = '🏆';

  speak(msg.replace(/[🌟🏆🎉🎊⭐]/g, ''), () => {});

  launchConfetti();
  showCelebration(starsThis);
  saveState();
}

// ══════════════════════════════════════════════
//  CELEBRATION
// ══════════════════════════════════════════════
function showCelebration(starsThis) {
  const overlay = document.getElementById('celebration');
  const emojis = ['🎉', '🌟', '🏆', '🎊', '🥳', '⭐'];
  const titles = ['Muito bem!', 'Fantástico!', 'Incrível!', 'Arrasaste!', 'Campeão!'];
  const msgs = [
    'Conseguiste escrever a frase!',
    'Tens uns dedos mágicos!',
    'Que talento incrível!',
    'Mais uma frase conquistada!',
    'O Byte está muito feliz!',
  ];

  document.getElementById('celeb-emoji').textContent = emojis[Math.floor(Math.random() * emojis.length)];
  document.getElementById('celeb-title').textContent = titles[Math.floor(Math.random() * titles.length)];
  document.getElementById('celeb-msg').textContent = msgs[Math.floor(Math.random() * msgs.length)];

  const s = Math.max(1, Math.min(3, starsThis || 1));
  document.getElementById('c-stars').textContent = '⭐'.repeat(s);

  const stars = Math.max(1, 3 - Math.floor(totalErrors / 3));
  document.getElementById('celeb-stars').textContent = '⭐'.repeat(stars);

  overlay.classList.add('show');
}

function hideCelebration() {
  document.getElementById('celebration').classList.remove('show');
}

// ══════════════════════════════════════════════
//  CONFETTI
// ══════════════════════════════════════════════
function launchConfetti() {
  if (!settings.confetti || settings.teacherMode) return;
  const colors = ['#ff6b6b','#ffd93d','#4ecdc4','#c589e8','#6bcb77','#4a90d9','#ff8e53'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.cssText = `
      left: ${Math.random() * 100}vw;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      width: ${6 + Math.random() * 10}px;
      height: ${6 + Math.random() * 10}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-duration: ${1.5 + Math.random() * 2}s;
      animation-delay: ${Math.random() * 0.5}s;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}

// ══════════════════════════════════════════════
//  AUDIO FEEDBACK
// ══════════════════════════════════════════════
function playBeep(correct) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (correct) {
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.frequency.value = 220;
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch(e) {}
}

// ══════════════════════════════════════════════
//  FINISH
// ══════════════════════════════════════════════
function showFinish() {
  document.querySelector('.main-panel').style.display = 'none';
  document.getElementById('level-selector').style.display = 'none';
  document.getElementById('finish-screen').classList.add('show');
  document.getElementById('final-stars').textContent = totalStars;
  document.getElementById('final-correct').textContent = totalCorrect;
  document.getElementById('final-errors').textContent = totalErrors;
  document.getElementById('final-stars-display').textContent = '⭐'.repeat(Math.min(totalStars, 15));
  launchConfetti();
  speak('Parabéns! Completaste todos os níveis! És incrível!', () => {});  saveState();
}


function printCertificate() {
  const name = (document.getElementById('student-name')?.value || '').trim();
  const student = name || '__________';

  const stars = totalStars;
  const correct = totalCorrect;
  const errors = totalErrors;
  const school = (settings.schoolName || '').trim();
  const teacher = (settings.teacherName || '').trim();

  const today = new Date();
  const dateStr = today.toLocaleDateString('pt-PT', { year:'numeric', month:'long', day:'numeric' });

  const html = `
<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Certificado — Digita com o Byte</title>
<style>
  :root{
    --blue:#2c5f8a;
    --light:#e0f4ff;
  }
  body{
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    background: white;
    margin:0;
    padding:24px;
  }
  .page{
    max-width: 900px;
    margin: 0 auto;
    border: 10px solid rgba(44,95,138,.18);
    border-radius: 22px;
    padding: 28px;
  }
  .top{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:16px;
    flex-wrap:wrap;
  }
  .badge{
    background: var(--light);
    color: var(--blue);
    font-weight: 900;
    padding: 10px 14px;
    border-radius: 999px;
    display:inline-block;
  }
  h1{
    margin: 14px 0 6px;
    color: var(--blue);
    font-size: 42px;
    letter-spacing: .2px;
  }
  .sub{
    color:#444;
    font-weight:700;
    font-size:16px;
    margin:0 0 18px;
  }
  .name{
    font-size: 44px;
    font-weight: 1000;
    color:#111;
    margin: 12px 0 12px;
  }
  .box{
    background: rgba(224,244,255,.6);
    border-radius: 18px;
    padding: 16px;
    margin: 18px 0;
    font-weight: 800;
    color:#333;
  }
  .row{
    display:flex;
    gap:16px;
    flex-wrap:wrap;
    margin-top: 8px;
  }
  .chip{
    background:white;
    border-radius:999px;
    padding:10px 14px;
    border: 2px solid rgba(44,95,138,.18);
    font-weight: 900;
  }
  .foot{
    display:flex;
    justify-content:space-between;
    gap:16px;
    flex-wrap:wrap;
    margin-top: 26px;
    color:#555;
    font-weight: 700;
  }
  .line{
    margin-top: 18px;
    height:1px;
    background: rgba(0,0,0,.12);
  }
  @media print{
    body{ padding:0; }
    .page{ border-width: 8px; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div class="badge">🏆 Certificado</div>
      <div class="badge">⌨️ Digita com o Byte</div>
      <div class="badge">🤖 Byte</div>
    </div>

    <h1>Parabéns!</h1>
    <p class="sub">Este certificado reconhece o excelente trabalho em digitação.</p>

    <div class="name">${student}</div>

    <div class="box">
      Completou o jogo “Digita com o Byte” e mostrou persistência, atenção e vontade de aprender.
      <div class="row">
        <div class="chip">⭐ Estrelas: ${stars}</div>
        <div class="chip">✅ Frases certas: ${correct}</div>
        <div class="chip">❌ Erros: ${errors}</div>
      </div>
    </div>

    <div class="foot">
      <div>Data: ${dateStr}</div>
      <div>${school ? 'Escola: ' + school : 'Escola: ____________________'}</div>
      <div>${teacher ? 'Professor/a: ' + teacher : 'Professor/a: ____________________'}</div>
    </div>
    <div class="foot" style="margin-top:10px">
      <div>Assinatura: ____________________</div>
    </div>
    <div class="line"></div>
    <p style="margin:14px 0 0;color:#666;font-weight:700">🤖 O Byte está orgulhoso de ti!</p>
  </div>

<script>window.onload=()=>{window.print();}</script>
</body>
</html>
  `;
  const w = window.open('', '_blank');
  if (!w) { alert('O navegador bloqueou a janela de impressão. Permite pop-ups para imprimir o certificado.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}



function restartGame() {
  totalStars = 0; totalCorrect = 0; totalErrors = 0;
  completedLevels = [];
  document.getElementById('finish-screen').classList.remove('show');
  document.querySelector('.main-panel').style.display = '';
  document.getElementById('level-selector').style.display = '';
  loadLevel(0, 0);
}

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
window.onload = () => {
  loadVoices();
  document.getElementById('total-levels').textContent = LEVELS.length;
};

// ──────────────────────────────────────────────
// Editor interno de frases
// ──────────────────────────────────────────────

function loadLevelIntoEditor() {
  const level = LEVELS[currentLevel];
  const ta = document.getElementById('editor-textarea');
  if (!level || !ta) return;
  ta.value = level.sentences.join("\n");
}

function applyEditorChanges() {
  const ta = document.getElementById('editor-textarea');
  if (!ta) return;

  const lines = ta.value
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    alert("Precisas de pelo menos uma frase.");
    return;
  }

  LEVELS[currentLevel].sentences = lines;

  try {
    localStorage.setItem("byte_custom_levels", JSON.stringify(LEVELS));
  } catch {}

  alert("Frases atualizadas com sucesso! 🎉");
  loadLevel(currentLevel, 0);
}

function loadCustomLevelsIfAny() {
  try {
    const raw = localStorage.getItem("byte_custom_levels");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (let i = 0; i < parsed.length; i++) {
        if (LEVELS[i]) LEVELS[i].sentences = parsed[i].sentences || LEVELS[i].sentences;
      }
    }
  } catch {}
}

document.addEventListener("DOMContentLoaded", () => {
  loadCustomLevelsIfAny();
});
