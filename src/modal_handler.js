console.log("Modal Handler Loading...");

let currentTab = 'manual';
let modalElement = null;
let scannedRunningApps = [];
let scannedSmartScanApps = [];

document.addEventListener('DOMContentLoaded', function () {
    modalElement = document.getElementById('addAppsModal');
    if (!modalElement) {
        return;
    }

    modalElement.addEventListener('click', function (e) {
        if (e.target === modalElement) {
            closeModal();
        }
    });

    setupModalHandlers();
});

function setupModalHandlers() {
    const addBtn = document.getElementById('addAppsBtn');
    if (addBtn) {
        addBtn.addEventListener('click', openModal);
    }

    const closeBtn = document.getElementById('closeAddAppsBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    attachTabHandler('manual');
    attachTabHandler('running');
    attachTabHandler('scan');

    const manualBtn = document.getElementById('btn-manualAdd');
    if (manualBtn) {
        manualBtn.addEventListener('click', handleManualAdd);
    }

    const refreshBtn = document.getElementById('btn-refreshRunning');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleRefreshRunning);
    }

    const addRunningBtn = document.getElementById('btn-addRunning');
    if (addRunningBtn) {
        addRunningBtn.addEventListener('click', handleAddRunning);
    }

    const scanBtn = document.getElementById('btn-startScan');
    if (scanBtn) {
        scanBtn.addEventListener('click', handleStartScan);
    }

    const addScanBtn = document.getElementById('btn-addScan');
    if (addScanBtn) {
        addScanBtn.addEventListener('click', handleAddScanned);
    }


    const searchInput = document.getElementById('scanSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const list = document.getElementById('scanResultsList');
            if (scannedSmartScanApps.length > 0 && list) {
                const filtered = scannedSmartScanApps.filter(app => app.name.toLowerCase().includes(query));
                renderAppList(list, filtered, 'scan_');
            }
        });
    }
}

function attachTabHandler(tabName) {
    const btn = document.getElementById('tabBtn-' + tabName);
    if (btn) {
        btn.addEventListener('click', function () {
            switchTab(tabName);
        });
    }
}

function openModal() {
    if (!modalElement) {
        alert("Error: Modal not initialized");
        return;
    }

    modalElement.classList.add('active');
    switchTab('manual');
}

function closeModal() {
    if (!modalElement) return;

    modalElement.classList.remove('active');
}

function switchTab(tabName) {
    currentTab = tabName;

    const allTabBtns = document.querySelectorAll('.modal-tab');
    const allSections = document.querySelectorAll('.add-section');

    allTabBtns.forEach(btn => btn.classList.remove('active'));
    allSections.forEach(section => section.classList.remove('active'));

    const targetBtn = document.getElementById('tabBtn-' + tabName);
    const targetSection = document.getElementById('addTab-' + tabName);

    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    if (targetSection) {
        targetSection.classList.add('active');
    }
}

async function handleManualAdd() {
    try {
        const ipcRenderer = window.ipc;
        if (!ipcRenderer) throw new Error("IPC not available");
        const app = await ipcRenderer.invoke('add-app-manual');

        if (app) {
            if (typeof window.addApp === 'function') {
                window.addApp(app);
                closeModal();
            } else {
                alert("Error: App management system not ready. Please restart.");
            }
        }
    } catch (error) {
        alert("Failed to add app: " + error.message);
    }
}

async function handleRefreshRunning() {
    const list = document.getElementById('runningAppsList');
    if (!list) return;

    list.innerHTML = '<div class="loader"><i class="fa-solid fa-spinner fa-spin"></i> Scanning...</div>';

    try {
        const ipcRenderer = window.ipc;
        if (!ipcRenderer) throw new Error("IPC not available");
        const apps = await ipcRenderer.invoke('get-running-apps');

        if (!apps || apps.length === 0) {
            scannedRunningApps = [];
            list.innerHTML = '<div class="loader">No running apps found</div>';
        } else {
            scannedRunningApps = apps;
            renderAppList(list, apps, 'run_');
        }
    } catch (error) {
        list.innerHTML = '<div class="loader">Error: ' + error.message + '</div>';
    }
}

function handleAddRunning() {
    const checked = document.querySelectorAll('input[name="run_select"]:checked');
    if (checked.length === 0) {
        alert("No apps selected");
        return;
    }

    let addedCount = 0;
    checked.forEach(checkbox => {
        const index = parseInt(checkbox.value);
        const app = scannedRunningApps[index];

        if (app && typeof window.addApp === 'function') {
            window.addApp(app);
            addedCount++;
        }
    });

    if (addedCount > 0) {
        if (typeof showToast === 'function') {
            showToast(`Added ${addedCount} app(s)`, 'success');
        }
    }

    closeModal();
}

async function handleStartScan() {
    const list = document.getElementById('scanResultsList');
    if (!list) return;

    list.innerHTML = '<div class="loader"><i class="fa-solid fa-spinner fa-spin"></i> Scanning...</div>';

    try {
        const ipcRenderer = window.ipc;
        if (!ipcRenderer) throw new Error("IPC not available");

        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Scan timeout (15s)')), 15000)
        );

        const scanPromise = ipcRenderer.invoke('smart-scan');
        const apps = await Promise.race([scanPromise, timeout]);

        if (!apps || apps.length === 0) {
            scannedSmartScanApps = [];
            list.innerHTML = '<div class="loader">No apps found</div>';
        } else {
            scannedSmartScanApps = apps;

            const searchInput = document.getElementById('scanSearchInput');
            if (searchInput) searchInput.value = '';
            renderAppList(list, apps, 'scan_');
        }
    } catch (error) {
        list.innerHTML = '<div class="loader">Error: ' + error.message + '</div>';
    }
}

function handleAddScanned() {
    const checked = document.querySelectorAll('input[name="scan_select"]:checked');
    if (checked.length === 0) {
        alert("No apps selected");
        return;
    }

    let addedCount = 0;
    checked.forEach(checkbox => {
        const index = parseInt(checkbox.value);
        const app = scannedSmartScanApps[index];

        if (app && typeof window.addApp === 'function') {
            window.addApp(app);
            addedCount++;
        }
    });

    if (addedCount > 0) {
        if (typeof showToast === 'function') {
            showToast(`Added ${addedCount} app(s)`, 'success');
        }
    }

    closeModal();
}

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
