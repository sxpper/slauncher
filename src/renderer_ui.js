console.log("Renderer UI Loading...");
const audioCtx = window.safeAudioContext;

const SoundManager = {
    enabled: true,
    bgOsc: null,
    bgGain: null,

    init() {
        if (!audioCtx) return;
        ['click', 'keydown', 'touchstart'].forEach(evt => {
            document.body.addEventListener(evt, () => {
                if (audioCtx.state === 'suspended') audioCtx.resume();
            }, { once: true });
        });
    },

    toggle(isChecked) {
        this.enabled = isChecked;
        if (this.enabled) {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            this.startAmbience();
        } else {
            this.stopAmbience();
        }
    },

    playHover() {
        if (!this.enabled) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    },

    playClick() {
        if (!this.enabled) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    },

    startAmbience() {
        if (this.bgOsc) return;
        this.bgOsc = audioCtx.createOscillator();
        this.bgGain = audioCtx.createGain();
        this.bgOsc.type = 'sine';
        this.bgOsc.frequency.setValueAtTime(50, audioCtx.currentTime);
        this.bgGain.gain.setValueAtTime(0, audioCtx.currentTime);
        this.bgGain.gain.linearRampToValueAtTime(0.02, audioCtx.currentTime + 2);
        this.bgOsc.connect(this.bgGain);
        this.bgGain.connect(audioCtx.destination);
        this.bgOsc.start();
    },

    stopAmbience() {
        if (!this.bgOsc) return;
        this.bgGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);
        setTimeout(() => {
            if (this.bgOsc) {
                this.bgOsc.stop();
                this.bgOsc = null;
            }
        }, 1000);
    },

    playAlarm() {
        if (!this.enabled || !audioCtx) return;

        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(880, now + 0.1);
        osc.frequency.setValueAtTime(0, now + 0.11);
        osc.frequency.setValueAtTime(880, now + 0.2);
        osc.frequency.setValueAtTime(880, now + 0.3);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.4);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.4);
    }
};
SoundManager.init();
window.SoundManager = SoundManager;

if (window.ipcRenderer) {
    window.ipcRenderer.on('checking_update', () => {
        showToast("Checking for updates...", "info");
    });

    window.ipcRenderer.on('update_available', () => {
        window.ipcRenderer.removeAllListeners('checking_update');
        showToast("Update Available - Downloading...", "success");
    });

    window.ipcRenderer.on('update_error', (event, err) => {
        console.error("Update Error:", err);
        showToast("Update Error: Check Logs", "warning");
    });

    window.ipcRenderer.on('update_downloaded', () => {
        window.ipcRenderer.removeAllListeners('update_downloaded');
        showToast("Update Ready - Restarting...", "success");
        setTimeout(() => window.ipcRenderer.send('restart_app'), 3000);
    });
}
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast-notification';
    el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${msg}</span>`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('active'));
    setTimeout(() => {
        el.classList.remove('active');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

const graphContainer = document.getElementById('graphContainer');
const tooltip = document.getElementById('graphTooltip');

const graphRegistry = {};

function createGraphModule(id, label, color) {
    const div = document.createElement('div');
    div.className = 'graph-module';
    div.id = `mod_${id}`;
    div.innerHTML = `
        <div class="graph-header"><span>${label}</span><span id="val_${id}">0%</span></div>
        <canvas id="${id}" width="100" height="40" class="graph-canvas"></canvas>
    `;

    div.addEventListener('mouseenter', () => {
        if (graphRegistry[id] && graphRegistry[id].name) {
            tooltip.innerText = graphRegistry[id].name;
            tooltip.style.display = 'block';
        }
    });
    div.addEventListener('mousemove', (e) => {
        tooltip.style.left = e.pageX + 10 + 'px';
        tooltip.style.top = e.pageY + 10 + 'px';
    });
    div.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });

    return div;
}

function initGraph(id, label, color) {
    if (!document.getElementById(`mod_${id}`)) {
        const mod = createGraphModule(id, label, color);
        graphContainer.appendChild(mod);
    }

    if (!graphRegistry[id]) {
        const cvs = document.getElementById(id);
        graphRegistry[id] = {
            ctx: cvs.getContext('2d'),
            data: new Array(20).fill(0),
            color: color,
            name: label
        };
    }
}

function updateGraph(id, value, hardwareName) {
    const reg = graphRegistry[id];
    if (!reg) return;

    if (hardwareName) reg.name = hardwareName;

    reg.data.push(value);
    reg.data.shift();

    const txt = document.getElementById(`val_${id}`);
    if (txt) txt.innerText = Math.round(value) + '%';

    drawGraph(reg.ctx, reg.data, reg.color);
}


function drawGraph(ctx, data, color) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(0, h);
    const step = w / (data.length - 1);
    data.forEach((val, i) => {
        const x = i * step;
        const y = h - (val / 100 * h);
        ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.fillStyle = color + '33';
    ctx.fill();
    ctx.beginPath();
    data.forEach((val, i) => {
        const x = i * step;
        const y = h - (val / 100 * h);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
}

window.targetFPS = 60;
window.setFPS = function (val) {
    window.targetFPS = parseInt(val);
    if (isNaN(window.targetFPS)) window.targetFPS = 60;

    console.log("Target FPS set to:", window.targetFPS);

    if (typeof saveCurrentSettings === 'function') saveCurrentSettings();
};

function ensureTimeDisplay() {
    let timeContainer = document.getElementById('timeContainer');
    if (!timeContainer) {
        const sep = document.createElement('div');
        sep.style = 'width:1px; background:rgba(255,255,255,0.1); margin:0 15px; height:40px;';
        sep.id = 'timeSeparator';
        graphContainer.appendChild(sep);

        timeContainer = document.createElement('div');
        timeContainer.id = 'timeContainer';
        timeContainer.style = 'display:flex; align-items:center; font-size:1.5rem; font-weight:800; color:white;';
        timeContainer.innerHTML = '<span id="timeDisplayGraph">--:--</span>';
        graphContainer.appendChild(timeContainer);
    } else {
        graphContainer.appendChild(timeContainer.previousElementSibling);
        graphContainer.appendChild(timeContainer);
    }
}

window.toggleSystemStats = function () {
    const toggle = document.getElementById('systemStatsToggle');
    const container = document.getElementById('graphContainer');

    if (!toggle) {
        console.error("Toggle Element Not Found!");
        return;
    }

    toggle.classList.toggle('active');

    window.systemStatsEnabled = toggle.classList.contains('active');
    console.log("Stats Enabled State:", window.systemStatsEnabled);

    if (window.systemStatsEnabled) {
        showToast("Stats Enabled", "success");
        startSystemStats();
    } else {
        showToast("Stats Disabled", "info");
    }

    if (container) {
        container.style.display = window.systemStatsEnabled ? 'flex' : 'none';
        container.offsetHeight;
    }
};

window.startSystemStats = function () {
    window.systemStatsEnabled = true;
    const container = document.getElementById('graphContainer');

    if (container) {
        container.style.display = 'flex';
        if (container.children.length === 0 || !container.querySelector('.graph-module')) {
            container.innerHTML = '<div id="statsLoader" style="color:white; font-size:0.8rem; padding:10px;">Loading stats...</div>';
        }
    }

    fetchSystemStats();
};

window.switchTab = function (tabId, btn) {
    if (typeof window.switchSettingsTab === 'function') {
        window.switchSettingsTab(tabId, btn);
        return;
    }
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
};

window.setTheme = function (name) {
    const root = document.documentElement;
    if (name === 'cyberpunk') {
        root.style.setProperty('--bg-color-1', '#0f0c29');
        root.style.setProperty('--accent-primary', '#00f2ff');
    } else if (name === 'zen') {
        root.style.setProperty('--bg-color-1', '#1a2a1a');
        root.style.setProperty('--accent-primary', '#7bed9f');
    }
};

window.toggleLowSpec = function () {
    document.body.classList.toggle('low-spec-mode', document.getElementById('lowSpecSwitch').classList.toggle('active'));
};

window.toggleAudio = function () {
    SoundManager.toggle(document.getElementById('audioSwitch').classList.toggle('active'));
};

window.toggleUtilityWidget = function (force) {
    const w = document.getElementById('utilityWidget');
    const t = document.getElementById('utilityWidgetToggle');
    const state = (force !== undefined) ? force : (w.style.display === 'none');
    w.style.display = state ? 'block' : 'none';
    if (t) t.classList.toggle('active', state);
};

window.toggleUtilityMode = function () {
    const isSticky = document.getElementById('uwSticky').style.display !== 'none';
    document.getElementById('uwSticky').style.display = isSticky ? 'none' : 'block';
    document.getElementById('uwTimer').style.display = isSticky ? 'block' : 'none';
    document.getElementById('uwTitle').innerHTML = isSticky ? '<i class="fa-solid fa-hourglass-half"></i> Pomodoro' : '<i class="fa-solid fa-note-sticky"></i> Sticky Note';
};

let timerInt = null;
let timerSec = 1500;

window.timerAction = function (act) {
    if (act === 'start') {
        if (timerInt) return;
        timerInt = setInterval(() => {
            if (timerSec > 0) {
                timerSec--;
                updateTimer();
            } else {
                timerAction('pause');
                document.getElementById('timerDisplay').style.color = 'var(--accent-primary)';

                if (typeof SoundManager !== 'undefined') SoundManager.playAlarm();
                if (Notification.permission === 'granted') new Notification("Pomodoro Finished", { body: "Time to take a break!" });
                if (typeof showToast !== 'undefined') showToast("Pomodoro Finished!", "success");
            }
        }, 1000);
    } else if (act === 'pause') {
        clearInterval(timerInt); timerInt = null;
    } else if (act === 'reset') {
        timerAction('pause');
        const val = parseInt(document.getElementById('timerInput')?.value) || 25;
        timerSec = val * 60;
        updateTimer();
        document.getElementById('timerDisplay').style.color = 'white';
    }
}

window.setCustomTimer = function () {
    timerAction('pause');
    const input = document.getElementById('timerInput');
    const mins = parseInt(input.value);
    if (!isNaN(mins) && mins > 0) {
        timerSec = mins * 60;
        updateTimer();
        document.getElementById('timerDisplay').style.color = 'white';
    }
};
function updateTimer() {
    const m = Math.floor(timerSec / 60);
    const s = timerSec % 60;
    document.getElementById('timerDisplay').innerText = `${m}:${s < 10 ? '0' + s : s}`;
}

const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const filtered = ALL_APPS.filter(app => app.name.toLowerCase().includes(val));
        if (typeof rebuildCarousel !== 'undefined') rebuildCarousel(filtered);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const list = window.currentList || [];
            if (list.length === 1) {
                const app = list[0];
                if (typeof triggerLaunch === 'function') triggerLaunch(app.id);
                searchInput.blur();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'Escape') {
            searchInput.value = ''; searchInput.blur();
            rebuildCarousel();
        } else if (e.key.length === 1 && !e.ctrlKey) {
            searchInput.focus();
        }
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-container')) {
        document.querySelectorAll('.custom-options').forEach(el => el.classList.remove('open'));
    }
});

setInterval(() => {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const el = document.getElementById('timeDisplayGraph');
    if (el) el.innerText = t;
}, 1000);

function renderAppList(container, apps, prefix) {
    container.innerHTML = '';
    apps.forEach((app, i) => {
        const row = document.createElement('div');
        row.className = 'app-list-item';
        const uid = prefix + i + '_' + Date.now();
        row.innerHTML = `
            <input type="checkbox" name="${prefix}select" value="${i}" id="${uid}">
            <label for="${uid}" class="app-info">
                <div class="app-icon"><i class="${app.icon}"></i></div>
                <div class="app-details">
                    <div class="app-name-s">${app.name}</div>
                    <div class="app-path-s">${app.path}</div>
                </div>
            </label>`;
        container.appendChild(row);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const toggleBtn = document.getElementById('systemStatsToggle');
    if (toggleBtn) {
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            window.toggleSystemStats();
            saveCurrentSettings();
        };
        console.log("Stats Toggle Bound (Single Handler)");
    }

    window.toggleAutoUpdate = function () {
        const sw = document.getElementById('autoUpdateToggle');
        if (sw) {
            sw.classList.toggle('active');
            saveCurrentSettings();
        }
    };

    window.checkForUpdatesNow = async function () {
        const statusEl = document.getElementById('updateStatus');
        if (statusEl) statusEl.innerText = "Checking...";

        if (window.ipcRenderer) {
            const res = await window.ipcRenderer.invoke('check-for-updates');
            if (statusEl) statusEl.innerText = res.message;
            if (typeof showToast === 'function') showToast(res.message, res.success ? 'success' : 'info');
        }
    };

    if (window.ipcRenderer) {
        try {
            const settings = await window.ipcRenderer.invoke('get-settings');
            if (settings) {
                applySettings(settings);
            }

            const note = await window.ipcRenderer.invoke('get-sticky-note');
            const stickyArea = document.querySelector('.sticky-area');
            if (stickyArea) {
                stickyArea.value = note || '';
                stickyArea.addEventListener('input', (e) => {
                    window.ipcRenderer.invoke('save-sticky-note', e.target.value);
                });
            }

            const paths = await window.ipcRenderer.invoke('get-custom-paths');
            if (paths && paths.bg) {
                document.body.style.backgroundImage = `url('${paths.bg.replace(/\\/g, '/')}')`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.animation = 'none';
            }
        } catch (e) {
            console.error("Failed to load persistence data:", e);
        }
    }
});

function applySettings(s) {
    if (s.theme) window.setTheme(s.theme);

    if (s.hasOwnProperty('audioEnabled')) {
        const audioSw = document.getElementById('audioSwitch');
        if (audioSw) {
            if (s.audioEnabled && !audioSw.classList.contains('active')) audioSw.classList.add('active');
            else if (!s.audioEnabled && audioSw.classList.contains('active')) audioSw.classList.remove('active');
            SoundManager.toggle(s.audioEnabled);
        }
    }

    if (s.hasOwnProperty('lowSpecMode')) {
        const lowSpecSw = document.getElementById('lowSpecSwitch');
        if (lowSpecSw) {
            if (s.lowSpecMode && !lowSpecSw.classList.contains('active')) {
                lowSpecSw.classList.add('active');
                document.body.classList.add('low-spec-mode');
            } else if (!s.lowSpecMode && lowSpecSw.classList.contains('active')) {
                lowSpecSw.classList.remove('active');
                document.body.classList.remove('low-spec-mode');
            }
        }
    }

    if (s.visibleApps) {
        const vInput = document.getElementById('visibleInput');
        if (vInput) vInput.value = s.visibleApps;
    }

    if (s.hasOwnProperty('utilityWidgetVisible')) {
        window.toggleUtilityWidget(s.utilityWidgetVisible);
    }

    if (s.hasOwnProperty('systemStatsEnabled')) {
        const statsToggle = document.getElementById('systemStatsToggle');
        if (statsToggle) {
            const isActive = statsToggle.classList.contains('active');
            if (s.systemStatsEnabled !== isActive) {
                window.toggleSystemStats(true);
            }
        }
    }

    if (s.hasOwnProperty('autoUpdate')) {
        const auToggle = document.getElementById('autoUpdateToggle');
        if (auToggle) {
            if (s.autoUpdate) auToggle.classList.add('active');
            else auToggle.classList.remove('active');
        }
    }

    if (s.hasOwnProperty('startup')) {
        const sw = document.getElementById('startupSwitch');
        if (sw) sw.classList.toggle('active', s.startup);
    }
    if (s.hasOwnProperty('runAsAdmin')) {
        const sw = document.getElementById('adminSwitch');
        if (sw) sw.classList.toggle('active', s.runAsAdmin);
    }
    if (s.hasOwnProperty('startMinimized')) {
        const sw = document.getElementById('minimizedSwitch');
        if (sw) sw.classList.toggle('active', s.startMinimized);
    }
}

function saveCurrentSettings() {
    if (!window.ipcRenderer) return;

    const settings = {
        theme: getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim() === '#00f2ff' ? 'cyberpunk' : 'zen',
        audioEnabled: document.getElementById('audioSwitch')?.classList.contains('active') || false,
        lowSpecMode: document.getElementById('lowSpecSwitch')?.classList.contains('active') || false,
        visibleApps: parseInt(document.getElementById('visibleInput')?.value) || 5,
        utilityWidgetVisible: document.getElementById('utilityWidget')?.style.display !== 'none',
        systemStatsEnabled: document.getElementById('systemStatsToggle')?.classList.contains('active') || false,
        autoUpdate: document.getElementById('autoUpdateToggle')?.classList.contains('active') || false,
        startup: document.getElementById('startupSwitch')?.classList.contains('active') || false,
        runAsAdmin: document.getElementById('adminSwitch')?.classList.contains('active') || false,
        startMinimized: document.getElementById('minimizedSwitch')?.classList.contains('active') || false
    };

    window.ipcRenderer.invoke('save-settings', settings);
}

const originalSetTheme = window.setTheme;
window.setTheme = function (name) {
    originalSetTheme(name);
    saveCurrentSettings();
};

const originalToggleAudio = window.toggleAudio;
window.toggleAudio = function () {
    originalToggleAudio();
    saveCurrentSettings();
};

const originalToggleLowSpec = window.toggleLowSpec;
window.toggleLowSpec = function () {
    originalToggleLowSpec();
    saveCurrentSettings();
};

const originalToggleUtilityWidget = window.toggleUtilityWidget;
window.toggleUtilityWidget = function (force) {
    originalToggleUtilityWidget(force);
    saveCurrentSettings();
};

window.toggleStartup = function () {
    const sw = document.getElementById('startupSwitch');
    if (sw) {
        sw.classList.toggle('active');
        saveCurrentSettings();
    }
};

window.toggleAdmin = function () {
    const sw = document.getElementById('adminSwitch');
    if (sw) {
        sw.classList.toggle('active');
        saveCurrentSettings();
    }
};

window.toggleMinimized = function () {
    const sw = document.getElementById('minimizedSwitch');
    if (sw) {
        sw.classList.toggle('active');
        saveCurrentSettings();
    }
};

window.targetFPS = 60;
window.setFPS = function (val) {
    window.targetFPS = parseInt(val);
    if (isNaN(window.targetFPS)) window.targetFPS = 60;

    console.log("Target FPS set to:", window.targetFPS);

    if (typeof saveCurrentSettings === 'function') saveCurrentSettings();
};

window.uiFPS = 60;

async function fetchSystemStats() {
    if (!ipcRenderer) {
        console.warn("IPC Renderer not available, skipping stats fetch.");
        return;
    }
    try {
        const stats = await ipcRenderer.invoke('get-system-stats');

        if (stats) {
            const loader = document.getElementById('statsLoader');
            if (loader) loader.remove();

            if (typeof initGraph === 'function' && typeof updateGraph === 'function') {
                initGraph('cpuGraph', 'CPU', '#00f2ff');
                updateGraph('cpuGraph', stats.cpu.load, stats.cpu.name);

                initGraph('ramGraph', 'RAM', '#7bed9f');
                const ramLoad = (stats.ram.used / stats.ram.total) * 100;
                updateGraph('ramGraph', ramLoad, `${stats.ram.name} ${(stats.ram.used / 1024 / 1024 / 1024).toFixed(1)}GB / ${(stats.ram.total / 1024 / 1024 / 1024).toFixed(1)}GB`);

                const ramTxt = document.getElementById('val_ramGraph');
                if (ramTxt) ramTxt.innerText = (stats.ram.used / 1024 / 1024 / 1024).toFixed(1) + ' GB';

                if (stats.gpus && stats.gpus.length > 0) {
                    stats.gpus.forEach((gpu, i) => {
                        const id = `gpuGraph_${i}`;
                        const lbl = `GPU ${i + 1}`;
                        initGraph(id, lbl, '#ff0055');
                        updateGraph(id, gpu.load, gpu.name);
                    });
                }
                if (typeof ensureTimeDisplay === 'function') ensureTimeDisplay();
            }
        }
    } catch (err) {
        console.error("Fetch Stats Error:", err);
    }

    if (window.systemStatsEnabled) {
        const fps = window.targetFPS || 60;
        setTimeout(fetchSystemStats, 1000);
    }
};

let bgMusicAudio = null;

window.handleCustomMusic = function (input) {

    if (input.files && input.files[0]) {
        const file = input.files[0];

        try {
            const path = file.path;
            const name = file.name;

            playBackgroundMusic(path, name);

            if (window.ipcRenderer) {
                window.ipcRenderer.invoke('save-custom-paths', { music: path, musicName: name });
            }
        } catch (err) {
            alert("Handler Error: " + err.message);
        }
    } else {
        alert("No file selected or input empty");
    }
};

function debugToast(msg) {
    const d = document.createElement('div');
    d.style.position = 'fixed';
    d.style.bottom = '20px';
    d.style.right = '20px';
    d.style.background = 'red';
    d.style.color = 'white';
    d.style.padding = '10px';
    d.style.zIndex = '99999';
    d.innerText = msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 5000);
}
