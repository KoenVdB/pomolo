/**
 * Pomodoro Timer Logic
 */

// Configuration Defaults
const DEFAULTS = {
    work: 25,
    short: 5,
    long: 15,
    auto: false,
    sound: 'bell'
};

// State
let config = { ...DEFAULTS };
let state = {
    mode: 'WORK', // WORK, SHORT, LONG
    timeRemaining: 0,
    isRunning: false,
    cycleCount: 1, // 1-4
    timerInterval: null
};

// Audio Context (initialized on user interaction)
let audioCtx = null;

// DOM Elements
const elements = {
    timeDisplay: document.getElementById('time-display'),
    modeDisplay: document.getElementById('mode-display'),
    cycleDisplay: document.getElementById('cycle-display'),
    startBtn: document.getElementById('start-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    resetBtn: document.getElementById('reset-btn'),
    body: document.body
};

// --- Initialization ---

function init() {
    parseUrlParams();
    setupEventListeners();
    resetCycle();
    render();
}

function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);

    config.work = getPositiveIntParam(params, 'work', DEFAULTS.work);
    config.short = getPositiveIntParam(params, 'short', DEFAULTS.short);
    config.long = getPositiveIntParam(params, 'long', DEFAULTS.long);

    // Auto can be "true", "1", or present (if no value for boolean flag logic, though URLSearchParams usually needs value)
    const autoParam = params.get('auto');
    if (autoParam !== null) {
        config.auto = (autoParam === 'true' || autoParam === '1');
    }

    const soundParam = params.get('sound');
    if (soundParam) {
        config.sound = soundParam;
    }
}

function getPositiveIntParam(params, key, defaultVal) {
    const val = parseInt(params.get(key));
    if (!isNaN(val) && val > 0) {
        return val;
    }
    return defaultVal;
}

function setupEventListeners() {
    elements.startBtn.addEventListener('click', () => {
        initAudio(); // Ensure audio context is ready
        startTimer();
    });

    elements.pauseBtn.addEventListener('click', pauseTimer);

    elements.resetBtn.addEventListener('click', () => {
        // If running, skip to next. If paused/stopped, reset current.
        // The prompt asks for "Skip/Reset". 
        // Common behavior: If timer running, acts as skip. If stopped, maybe reset.
        // Let's implement as "Skip current session" behavior for simplicity and fluid flow.
        skipSession();
    });
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// --- Timer Logic ---

function resetCycle() {
    state.mode = 'WORK';
    state.cycleCount = 1;
    setModeTime();
    state.isRunning = false;
    render();
}

function setModeTime() {
    if (state.mode === 'WORK') {
        state.timeRemaining = config.work * 60;
    } else if (state.mode === 'SHORT') {
        state.timeRemaining = config.short * 60;
    } else if (state.mode === 'LONG') {
        state.timeRemaining = config.long * 60;
    }
}

function startTimer() {
    if (state.isRunning) return;
    state.isRunning = true;

    // Use performance.now() for better accuracy than pure setInterval drift
    let lastTime = performance.now();

    state.timerInterval = requestAnimationFrame(function loop(currentTime) {
        if (!state.isRunning) return;

        const deltaTime = currentTime - lastTime;

        if (deltaTime >= 1000) {
            state.timeRemaining--;
            lastTime = currentTime;

            if (state.timeRemaining <= 0) {
                completeSession();
                return; // Stop this loop
            }

            render();
        }

        state.timerInterval = requestAnimationFrame(loop);
    });

    render();
}

function pauseTimer() {
    state.isRunning = false;
    if (state.timerInterval) {
        cancelAnimationFrame(state.timerInterval);
    }
    render();
}

function skipSession() {
    pauseTimer();
    completeSession(true); // true = skipped (maybe don't play sound? or distinct behavior)
}

function completeSession(skipped = false) {
    pauseTimer();
    state.timeRemaining = 0;
    render(); // Show 00:00 briefly

    if (!skipped && config.sound !== 'none') {
        playSound(config.sound);
    }

    // Determine next mode
    if (state.mode === 'WORK') {
        if (state.cycleCount % 4 === 0) { // After 4th work session -> Long Break
            // Correction: Prompt says Work -> Short -> Work -> Short -> Work -> Long (that's 3 work sessions usually? or 4?)
            // Standard Pomodoro: 4 pomodoros then long break.
            // Prompt: Work -> Short -> Work -> Short -> Work -> Long
            // That implies 3rd work leads to long break. Let's stick to prompt text literal cycle if possible, or standard.
            // "Work -> Short Break -> Work -> Short Break -> Work -> Long Break"
            // That is 3 work sessions.
            if (state.cycleCount >= 3) {
                state.mode = 'LONG';
            } else {
                state.mode = 'SHORT';
            }
        } else {
            // Should not happen if we reset cycle count? 
            // Actually, let's increment cycle count only on Work completion.
            // If we are at 3, we go to Long.
            // Wait, let's trace:
            // 1. Work (1) -> Short
            // 2. Work (2) -> Short
            // 3. Work (3) -> Long
            // 4. Reset to Work (1)?
            state.mode = 'SHORT';
        }
    } else if (state.mode === 'SHORT') {
        state.mode = 'WORK';
        state.cycleCount++;
    } else if (state.mode === 'LONG') {
        state.mode = 'WORK';
        state.cycleCount = 1; // Reset cycle
    }

    setModeTime();

    if (config.auto) {
        startTimer();
    } else {
        render(); // Update UI to show new start time
    }
}

// --- Rendering ---

function render() {
    // Format Time
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = state.timeRemaining % 60;
    const timeString = `${pad(minutes)}:${pad(seconds)}`;

    // Update Document Title
    const modeLabel = getModeLabel(state.mode);
    document.title = `(${timeString}) ${modeLabel}`;

    // Update DOM
    elements.timeDisplay.textContent = timeString;
    elements.modeDisplay.textContent = modeLabel;
    elements.cycleDisplay.textContent = `Cycle ${state.cycleCount}/3`; // Assuming 3 works based on prompt

    // Classes
    elements.body.className = '';
    elements.body.classList.add(`mode-${state.mode.toLowerCase().split('_')[0]}`); // mode-work, mode-short...

    // Controls Visibility
    if (state.isRunning) {
        elements.startBtn.classList.add('hidden');
        elements.pauseBtn.classList.remove('hidden');
    } else {
        elements.startBtn.classList.remove('hidden');
        elements.pauseBtn.classList.add('hidden');
    }
}

function getModeLabel(mode) {
    if (mode === 'WORK') return 'Work Time';
    if (mode === 'SHORT') return 'Short Break';
    if (mode === 'LONG') return 'Long Break';
    return '';
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

// --- Audio ---

function playSound(type) {
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'bell') {
        // Bell-like: sine wave with decay
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 1.5);
    } else {
        // Chime: higher pitch
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 1);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 1);
    }
}

// Bootstrap
init();
