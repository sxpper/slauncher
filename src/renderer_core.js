console.log("Renderer Core: IPC Available?", !!window.ipcRenderer);

window.ContextMenu = {
    menu: null,
    targetElement: null,

    init() {
        this.menu = document.getElementById('contextMenu');
        if (!this.menu) return;

        document.addEventListener('click', (e) => {
            if (this.menu && !this.menu.contains(e.target)) {
                this.hide();
            }
        });
    },

    hide() {
        if (this.menu) {
            this.menu.classList.remove('active');
            this.menu.style.display = 'none';
        }
        this.targetElement = null;
    },

    async handleAction(action) {
        if (!this.targetElement) {
            this.hide();
            return;
        }

        const appBox = this.targetElement;
        const appId = appBox.dataset.appId;
        const appPath = appBox.dataset.appPath;
        const appName = appBox.querySelector('.app-name')?.textContent || 'App';

        switch (action) {
            case 'launch':
                appBox.click();
                break;

            case 'monitors':

                break;

            case 'remove':
                if (confirm(`Remove "${appName}"?`)) {
                    const app = ALL_APPS.find(a => a.id === appId);
                    if (app && window.removeApp) {
                        window.removeApp(app.id);
                    }
                }
                break;

            case 'pin':
                const appToPin = ALL_APPS.find(a => a.id === appId);
                if (appToPin) {
                    if (PINNED_APPS.includes(appId)) {
                        if (window.unpinApp) {
                            window.unpinApp(appId);
                            if (typeof showToast === 'function') showToast('Unpinned ' + appToPin.name, 'info');
                        }
                    } else {
                        if (window.pinApp) {
                            window.pinApp(appId);
                            if (typeof showToast === 'function') showToast('Pinned ' + appToPin.name, 'success');
                        }
                    }
                }
                break;
            case 'timer':
                if (window.AppTimer) {
                    window.AppTimer.openModal(appName);
                } else {
                    console.error("AppTimer not found!");
                }
                break;
        }

        if (action !== 'monitors') this.hide();
    },

    async show(x, y, element) {
        if (!this.menu) this.menu = document.getElementById('contextMenu');
        if (!this.menu) return;

        this.targetElement = element;

        const appId = element.dataset.appId;
        const pinTextEl = document.getElementById('ctxPinText');
        const pinIcon = this.menu.querySelector('.fa-thumbtack');

        if (pinTextEl) {
            if (PINNED_APPS.includes(appId)) {
                pinTextEl.innerText = "Remove Pin";
                if (pinIcon) pinIcon.style.color = "#ff0055";
            } else {
                pinTextEl.innerText = "Add to Pins";
                if (pinIcon) pinIcon.style.color = "";
            }
        }


        let displays = [];
        try {
            if (ipcRenderer) displays = await ipcRenderer.invoke('get-displays');
        } catch (e) {
            console.warn("Failed to get displays:", e);
        }

        const monitorHtml = (displays || []).map(d =>
            `<div class="ctx-item" onclick="ContextMenu.launchOnDisplay(${d.id})">
                <i class="fa-solid fa-desktop"></i> ${d.label}
             </div>`
        ).join('');


        let monitorContainer = document.getElementById('ctxMonitorList');
        if (!monitorContainer) {
            const list = document.createElement('div');
            list.id = 'ctxMonitorList';
            list.style.display = 'none';
            list.style.borderTop = '1px solid rgba(255,255,255,0.1)';
            list.style.paddingTop = '5px';
            list.style.marginTop = '5px';


            const launchBtn = this.menu.querySelector('.ctx-item:nth-child(2)');
            if (launchBtn) launchBtn.insertAdjacentElement('afterend', list);
            monitorContainer = list;
        }

        monitorContainer.innerHTML = `<div style="font-size:0.7rem; color:#888; padding:5px 15px;">OPEN ON:</div>` + monitorHtml;
        monitorContainer.style.display = 'block';

        this.menu.classList.add('active');
        this.menu.style.display = 'flex';
        this.menu.style.left = x + 'px';
        this.menu.style.top = y + 'px';

        setTimeout(() => {
            const rect = this.menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                this.menu.style.left = (x - rect.width) + 'px';
            }
            if (rect.bottom > window.innerHeight) {
                this.menu.style.top = (y - rect.height) + 'px';
            }
        }, 0);
    },

    launchOnDisplay(displayId) {
        if (this.targetElement) {
            const appPath = this.targetElement.dataset.appPath;
            if (ipcRenderer) ipcRenderer.invoke('launch-on-monitor', appPath, displayId);
            this.hide();
        }
    }

};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ContextMenu.init());
} else {
    ContextMenu.init();
}


window.switchTab = function (tabId, btn) {
    if (typeof window.switchSettingsTab === 'function') {
        window.switchSettingsTab(tabId, btn);
        return;
    }

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById('tab-' + tabId);
    if (section) section.classList.add('active');
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
    const sw = document.getElementById('lowSpecSwitch');
    if (sw) {
        sw.classList.toggle('active');
        document.body.classList.toggle('low-spec-mode', sw.classList.contains('active'));
    }
};

window.toggleAudio = function () {
    const sw = document.getElementById('audioSwitch');
    if (sw) {
        sw.classList.toggle('active');
        if (typeof SoundManager !== 'undefined') {
            SoundManager.toggle(sw.classList.contains('active'));
        }
    }
};

window.toggleUtilityWidget = function (force) {
    const w = document.getElementById('utilityWidget');
    const t = document.getElementById('utilityWidgetToggle');
    if (!w) return;
    const state = (force !== undefined) ? force : (w.style.display === 'none');
    w.style.display = state ? 'block' : 'none';
    if (t) t.classList.toggle('active', state);
};

window.toggleWidget = function (side) {
    console.log("Toggle widget:", side);
};



let selectedAnim = 'charge';

window.resetAnims = function () {
    document.body.classList.remove('anim-snap', 'anim-charge', 'anim-glitch', 'anim-zoom');
    const dock = document.querySelector('.dock-wrapper');
    if (dock) dock.style = '';
};

window.triggerLaunch = function (appId) {
    if (document.body.classList.contains('launching')) return;

    console.log("Trigger Launch called for:", appId);
    if (appId) {
        const app = ALL_APPS.find(a => a.id === appId);
        if (app) {
            const ipc = window.ipcRenderer || window.ipc;
            if (ipc) {
                console.log("Invoking launch-app for path:", app.path);
                ipc.invoke('launch-app', app.path);
            } else {
                console.error("IPC Renderer not found!");
                alert("Error: System Interface Missing. Please restart app.");
            }
        } else {
            console.error("App not found in database:", appId);
        }
    }

    document.body.classList.add('launching');

    window.resetAnims();

    requestAnimationFrame(() => {
        if (selectedAnim !== 'none') {
            document.body.classList.add('anim-' + selectedAnim);
        }

        if (typeof SoundManager !== 'undefined') {
            if (selectedAnim === 'snap') SoundManager.playClick();
            else if (selectedAnim === 'charge') SoundManager.playHover();
            else if (selectedAnim === 'glitch') SoundManager.playClick();
            else SoundManager.playHover();
        }

        setTimeout(() => {
            window.resetAnims();
            document.body.classList.remove('launching');
        }, 1500);
    });
};

let ALL_APPS = [];
let PINNED_APPS = ['app_01', 'app_03', 'app_05'];

(async () => {
    if (!ipcRenderer) {
        console.warn("Renderer Core: IPC not available, skipping initial app load.");
        return;
    }
    try {
        const storedApps = await ipcRenderer.invoke('get-apps');

        if (storedApps && Array.isArray(storedApps)) {
            ALL_APPS = storedApps;
        }

        const storedPins = await ipcRenderer.invoke('get-pinned-apps');
        if (storedPins && Array.isArray(storedPins) && storedPins.length > 0) {
            PINNED_APPS = storedPins;
        }

        setTimeout(() => {
            if (window.rebuildCarousel) window.rebuildCarousel();
            if (window.rebuildPinned) window.rebuildPinned();
        }, 100);
    } catch (e) {
        console.error(e);
    }
})();

async function savePinnedApps() {
    if (ipcRenderer) await ipcRenderer.invoke('save-pinned-apps', PINNED_APPS);
}

async function saveApps() {
    if (ipcRenderer) await ipcRenderer.invoke('save-apps', ALL_APPS);
}

window.addApp = function (app) {
    if (ALL_APPS.find(a => a.path === app.path)) return;

    app.id = 'app_' + Date.now() + Math.random().toString(36).substr(2, 5);
    ALL_APPS.push(app);
    saveApps();
    if (window.rebuildCarousel) window.rebuildCarousel();
    if (typeof showToast === 'function') showToast(`Added ${app.name}`, 'success');
};

window.removeApp = function (id) {
    ALL_APPS = ALL_APPS.filter(a => a.id !== id);
    saveApps();
    if (window.rebuildCarousel) window.rebuildCarousel();
};

let currentIndex = 0;
let visibleCount = 5;
let carouselOffset = 0;
const BOX_WIDTH = 80;
const GAP = 20;

const track = document.getElementById('track');
const viewport = document.getElementById('viewport');

const AppTimer = {
    targetApp: null,
    timers: {},

    openModal: function (appName) {
        this.targetApp = appName;
        document.getElementById('tmAppName').innerText = appName;
        document.getElementById('usageTimerModal').style.display = 'block';
    },

    set: function (minutes) {
        console.log("Timer Set for:", minutes);
        this.startTimer(minutes);
    },

    setCustom: function () {
        const min = parseInt(document.getElementById('tmCustomInput').value);
        if (min > 0) this.startTimer(min);
    },

    startTimer: function (minutes) {
        document.getElementById('usageTimerModal').style.display = 'none';

        const ms = minutes * 60 * 1000;
        if (this.timers[this.targetApp]) clearTimeout(this.timers[this.targetApp]);

        console.log("Timer set for " + ms + "ms");

        this.timers[this.targetApp] = setTimeout(() => {
            this.triggerAlert(this.targetApp);
        }, ms);

        if (typeof showToast !== 'undefined') showToast(`Timer set for ${minutes}m`, 'info');
    },

    triggerAlert: function (appName) {
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playAlarm();
        }

        if (Notification.permission === 'granted') {
            new Notification("Time Ended", { body: `Time's up for ${appName}` });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification("Time Ended", { body: `Time's up for ${appName}` });
                }
            });
        }

        if (typeof showToast !== 'undefined') {
            showToast(`Time Ended: ${appName}`, 'warning');
        }

        const centerWidget = document.getElementById('centerWidget');
        if (centerWidget) {
            const alertHtml = `
                    <div class="cw-item" style="animation: highlight 1s infinite alternate;">
                        <div class="cw-icon warning"><i class="fa-solid fa-hourglass-end"></i></div>
                        <div class="cw-text">
                            <div class="cw-main">Time's Up: ${appName}</div>
                            <div class="cw-sub">Take a break!</div>
                        </div>
                    </div>`;

            const content = centerWidget.querySelector('.cw-content');
            if (content) {
                content.insertAdjacentHTML('afterbegin', alertHtml);
            }
        }
    }
};

window.pinApp = function (id) {
    if (!PINNED_APPS.includes(id)) {
        PINNED_APPS.push(id);
        savePinnedApps();
        refreshAll();
    }
};

window.unpinApp = function (id) {
    PINNED_APPS = PINNED_APPS.filter(pid => pid !== id);
    savePinnedApps();
    refreshAll();
};

function refreshAll() {
    window.rebuildCarousel();
    window.rebuildPinned();
}

function getUnpinnedApps() {
    return ALL_APPS.filter(app => !PINNED_APPS.includes(app.id));
}

function createBox(app, index, isClone = false, isPinned = false) {
    const el = document.createElement('div');
    el.className = 'app-box';
    if (isClone) el.classList.add('clone');
    if (isPinned) {
        el.classList.add('pinned-item');
        el.style.width = '60px';
        el.style.height = '60px';
    }

    el.onclick = () => {
        console.log("App Clicked:", app.name, "Pinned:", isPinned, "ID:", app.id);
        if (isPinned) {
            selectedAnim = 'snap';
            window.triggerLaunch(app.id);
            return;
        }

        if (currentIndex === index) {
            triggerLaunch(app.id);
        } else {
            activate(index);
        }
    };

    el.dataset.appPath = app.path;
    el.dataset.appId = app.id;

    let iconHTML;
    if (app.iconDataURL) {
        iconHTML = `<img src="${app.iconDataURL}" class="app-icon-img" alt="${app.name}">`;
    } else {
        iconHTML = `<i class="${app.icon}"></i>`;
    }

    el.innerHTML = `${iconHTML}<div class="app-name">${app.name}</div>`;

    if (isPinned) {
        if (app.iconDataURL) {
            el.innerHTML = `<img src="${app.iconDataURL}" class="app-icon-img-small" alt="${app.name}">`;
        } else {
            el.innerHTML = `<i class="${app.icon}" style="font-size:1.2rem;"></i>`;
        }
    }

    let lastFrame = 0;
    el.addEventListener('mousemove', (e) => {
        if (document.body.classList.contains('low-spec-mode')) return;

        const now = Date.now();
        const fps = window.targetFPS || 60;
        const interval = 1000 / fps;

        if (now - lastFrame < interval) return;
        lastFrame = now;

        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -12;
        const rotateY = ((x - centerX) / centerX) * 12;

        el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.1)`;
        el.style.zIndex = 100;

    });

    el.addEventListener('mouseenter', () => {
        if (typeof SoundManager != 'undefined') SoundManager.playHover();
    });
    el.addEventListener('mousedown', () => { if (typeof SoundManager != 'undefined') SoundManager.playClick() });
    el.addEventListener('mouseleave', () => {
        el.style.transform = '';
        el.style.zIndex = '';
    });

    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        ContextMenu.show(e.clientX, e.clientY, el);
    });

    return el;
}

function updateTransform(animate = true) {
    const itemSize = BOX_WIDTH + GAP;
    const centerOffset = viewport.offsetWidth / 2;

    const virtualPosition = currentIndex + carouselOffset;
    const itemCenter = (virtualPosition * itemSize) + (BOX_WIDTH / 2) + 50;

    const moveX = centerOffset - itemCenter;

    track.style.transition = animate ? `transform ${getComputedStyle(document.body).getPropertyValue('--anim-speed')}` : 'none';
    track.style.transform = `translateX(${moveX}px)`;

    updateActiveState();
}

function updateActiveState() {
    const list = window.currentList || ALL_APPS;
    const boxes = document.querySelectorAll('.app-box');

    let normalized = currentIndex % list.length;
    if (normalized < 0) normalized += list.length;

    boxes.forEach((b) => {
        b.classList.remove('is-active');
        if (list[normalized] && b.innerText === list[normalized].name) {
            if (!b.classList.contains('pinned-item')) b.classList.add('is-active');
        }
    });
}


window.move = function (dir) {
    const list = window.currentList || ALL_APPS;
    const fullUnpinnedCount = ALL_APPS.length - PINNED_APPS.length;
    const isFiltered = list.length !== fullUnpinnedCount;
    const canLoop = !isFiltered && list.length >= visibleCount;

    if (canLoop) {
        currentIndex += dir;
    } else {
        let next = currentIndex + dir;
        if (next > list.length - 1) next = 0;
        if (next < 0) next = list.length - 1;
        currentIndex = next;

        updateTransform(true);
        return;
    }

    updateTransform(true);
    checkInfiniteLoop();
};

function activate(virtualIndex) {
    currentIndex = virtualIndex;
    updateTransform(true);
    checkInfiniteLoop();
}

function checkInfiniteLoop() {
    const list = window.currentList || ALL_APPS;
    const fullUnpinnedCount = ALL_APPS.length - PINNED_APPS.length;
    if (list.length !== fullUnpinnedCount) return;
    if (list.length < visibleCount) return;

    if (currentIndex <= -1 || currentIndex >= list.length) {
        setTimeout(() => {
            track.style.transition = 'none';

            if (currentIndex >= list.length) {
                currentIndex = currentIndex % list.length;
            }

            else if (currentIndex <= -1) {
                currentIndex = (currentIndex % list.length) + list.length;
            }

            updateTransform(false);
        }, 300);
    }
}

window.rebuildCarousel = function (sourceList = ALL_APPS) {
    let effectiveList = sourceList.filter(app => !PINNED_APPS.includes(app.id));

    if (effectiveList.length === 0) {
        track.innerHTML = '<div style="color:white; padding:20px; text-align:center;">No apps available</div>';
        viewport.style.width = '200px';
        window.currentList = [];
        return;
    }

    window.currentList = effectiveList;

    const visibleInput = document.getElementById('visibleInput');
    visibleCount = visibleInput ? (parseInt(visibleInput.value) || 5) : 5;

    if (visibleCount > effectiveList.length) visibleCount = effectiveList.length;

    track.innerHTML = '';

    const fullUnpinnedCount = ALL_APPS.length - PINNED_APPS.length;
    const isFiltered = effectiveList.length !== fullUnpinnedCount;
    const canLoop = !isFiltered && effectiveList.length >= visibleCount;

    const totalW = (visibleCount * BOX_WIDTH) + ((visibleCount - 1) * GAP);
    viewport.style.width = `${totalW + 40}px`;

    if (canLoop) {
        const preClones = effectiveList.slice(-visibleCount);
        preClones.forEach((app, i) => track.appendChild(createBox(app, i - visibleCount, true)));
        carouselOffset = visibleCount;
    } else {
        carouselOffset = 0;
    }

    effectiveList.forEach((app, i) => track.appendChild(createBox(app, i)));

    if (canLoop) {
        const postClones = effectiveList.slice(0, visibleCount);
        postClones.forEach((app, i) => track.appendChild(createBox(app, i + effectiveList.length, true)));
    }

    currentIndex = 0;
    updateTransform(false);
};

window.rebuildPinned = function () {
    const row = document.getElementById('pinnedRow');
    if (!row) return;
    row.innerHTML = '';
    const list = PINNED_APPS.map(id => ALL_APPS.find(a => a.id === id)).filter(Boolean);

    if (list.length === 0) {
        row.innerHTML = '<div style="color:rgba(255,255,255,0.3); font-size:0.8rem; font-style:italic;">Right-click apps to pin them here</div>';
        return;
    }

    list.forEach(app => {
        const el = createBox(app, -1, false, true);
        row.appendChild(el);
    });
};

let lastScrollTime = 0;
const scrollCooldown = 150;

const dockWrapper = document.querySelector('.dock-wrapper');
if (dockWrapper) {
    dockWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();

        const now = Date.now();
        if (now - lastScrollTime < scrollCooldown) return;

        if (e.deltaY > 0) {
            window.move(1);
        } else {
            window.move(-1);
        }

        lastScrollTime = now;
    }, { passive: false });
}

if (window.autoScrollTimer) clearInterval(window.autoScrollTimer);

let navMode = 'carousel';
let pinnedNavIndex = 0;

function updatePinnedHighlights() {
    const row = document.getElementById('pinnedRow');
    if (!row) return;

    Array.from(row.children).forEach((el, i) => {
        if (navMode === 'pinned' && i === pinnedNavIndex) {
            el.style.transform = 'scale(1.2)';
            el.style.boxShadow = '0 0 15px var(--accent-primary)';
            el.style.zIndex = '100';
            el.style.border = '2px solid white';
        } else {
            el.style.transform = '';
            el.style.boxShadow = '';
            el.style.zIndex = '';
            el.style.border = '';
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowUp') {
        if (navMode === 'carousel' && PINNED_APPS.length > 0) {
            navMode = 'pinned';
            pinnedNavIndex = 0;
            updatePinnedHighlights();
        }
    }
    else if (e.key === 'ArrowDown') {
        if (navMode === 'pinned') {
            navMode = 'carousel';
            updatePinnedHighlights();
        }
    }
    else if (e.key === 'ArrowLeft') {
        if (navMode === 'carousel') {
            window.move(-1);
        } else {
            if (pinnedNavIndex > 0) pinnedNavIndex--;
            else pinnedNavIndex = PINNED_APPS.length - 1;
            updatePinnedHighlights();
        }
    }
    else if (e.key === 'ArrowRight') {
        if (navMode === 'carousel') {
            window.move(1);
        } else {
            if (pinnedNavIndex < PINNED_APPS.length - 1) pinnedNavIndex++;
            else pinnedNavIndex = 0;
            updatePinnedHighlights();
        }
    }
    else if (e.key === 'Enter') {
        if (navMode === 'pinned') {
            const appId = PINNED_APPS[pinnedNavIndex];
            if (appId) window.triggerLaunch(appId);
        } else {
            const list = window.currentList || ALL_APPS;
            let targetApp = null;

            if (list.length > 0) {
                let safeIndex = currentIndex % list.length;
                if (safeIndex < 0) safeIndex += list.length;
                targetApp = list[safeIndex];
            }

            if (targetApp) window.triggerLaunch(targetApp.id);
        }
    }
    else if (e.key === 'Escape') {
        if (navMode === 'pinned') {
            navMode = 'carousel';
            updatePinnedHighlights();
        }
    }
});
