const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

log.transports.file.level = 'info';
autoUpdater.logger = log;
log.info('App starting...');

let mainWindow = null;

const { protocol } = require('electron');
protocol.registerSchemesAsPrivileged([
    { scheme: 'media', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
]);

function createWindow() {
    const iconPath = path.join(__dirname, 'slauncher_logo.png');
    console.log("DEBUG: Icon Path ->", iconPath);

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        backgroundColor: '#0f0c29',
        icon: iconPath,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            devTools: !app.isPackaged
        },
        autoHideMenuBar: true,
        show: false
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.webContents.once('did-finish-load', () => {
        const settings = store.get('settings', {});
        if (settings.autoUpdate !== false) {
            const projectRoot = path.join(__dirname, '..');
            child_process.exec('git pull', { cwd: projectRoot }, (err, stdout) => {
                if (!err && stdout && !stdout.includes('Already up to date')) {
                    console.log("Auto-Update applied changes.");
                }
            });
        }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        autoUpdater.checkForUpdatesAndNotify();
    });

    mainWindow.removeMenu();

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
            event.preventDefault();
        }
    });
}

app.whenReady().then(() => {
    log.transports.console.level = 'info';

    console.log("Electron Version:", process.versions.electron);
    const { protocol, net } = require('electron');
    const path = require('path');
    const url = require('url');

    if (protocol.handle) {
        log.info("Using modern protocol.handle");
        protocol.handle('media', (request) => {
            const requestUrl = request.url;
            log.info("Media Request: " + requestUrl);

            let rawPath = requestUrl.replace(/^media:\/\//, '');

            rawPath = decodeURIComponent(rawPath);

            if (process.platform === 'win32' && rawPath.match(/^\/[a-zA-Z]:/)) {
                rawPath = rawPath.substring(1);
            }

            log.info("Raw Path Resolved: " + rawPath);

            const fileUrl = url.pathToFileURL(rawPath).href;

            log.info("Fetching File URL: " + fileUrl);
            return net.fetch(fileUrl);
        });
    } else {
        log.info("Using legacy registerFileProtocol");
        protocol.registerFileProtocol('media', (request, callback) => {
            const reqUrl = request.url;
            let filePath = reqUrl.replace(/^media:\/\//, '');
            if (process.platform === 'win32' && filePath.match(/^\/[a-zA-Z]:/)) {
                filePath = filePath.substring(1);
            }
            filePath = decodeURIComponent(filePath);
            callback({ path: filePath });
        });
    }

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

const si = require('systeminformation');

let staticHardwareInfo = null;

ipcMain.handle('get-system-stats', async () => {
    try {
        if (!staticHardwareInfo) {
            try {
                const cpu = await si.cpu();
                const gpuPromise = si.graphics();
                const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ controllers: [] }), 2000));
                const gpu = await Promise.race([gpuPromise, timeoutPromise]);

                staticHardwareInfo = {
                    cpuName: `${cpu.manufacturer} ${cpu.brand}`,
                    gpuNames: gpu.controllers ? gpu.controllers.map(g => g.model) : []
                };
            } catch (initErr) {
                console.error("Init Stats Error:", initErr);
                staticHardwareInfo = { cpuName: "Unknown CPU", gpuNames: [] };
            }
        }

        const fetchWithTimeout = (promise, ms, fallback) => {
            const timeout = new Promise(resolve => setTimeout(() => resolve(fallback), ms));
            return Promise.race([promise, timeout]).catch(() => fallback);
        };

        const [cpuLoad, mem, gpuLoad] = await Promise.all([
            fetchWithTimeout(si.currentLoad(), 3000, { currentLoad: 0 }),
            fetchWithTimeout(si.mem(), 4000, { used: 0, total: 1 }),
            fetchWithTimeout(si.graphics(), 5000, { controllers: [] })
        ]);

        return {
            cpu: { load: cpuLoad.currentLoad, name: staticHardwareInfo.cpuName },
            ram: { used: mem.used, total: mem.total, name: "DDR4" },
            gpus: (gpuLoad.controllers || []).map(g => ({
                name: g.model,
                load: g.utilizationGpu || 0
            }))
        };
    } catch (e) {
        console.error("System Stats Error:", e);
        return null;
    }
});

class SimpleStore {
    constructor(opts) {
        const userDataPath = app.getPath('userData');
        this.path = path.join(userDataPath, opts.configName + '.json');
        this.data = parseDataFile(this.path, opts.defaults);
    }

    get(key, defaultValue) {
        return this.data[key] || defaultValue;
    }

    set(key, val) {
        this.data[key] = val;
        try {
            fs.writeFileSync(this.path, JSON.stringify(this.data));
        } catch (e) { console.error(e); }
    }
}

function parseDataFile(filePath, defaults) {
    try {
        return JSON.parse(fs.readFileSync(filePath));
    } catch (error) {
        return defaults;
    }
}

const store = new SimpleStore({
    configName: 'user-preferences',
    defaults: { apps: [] }
});

const child_process = require('child_process');

ipcMain.handle('get-apps', () => {
    return store.get('apps', []);
});

ipcMain.handle('save-apps', (event, apps) => {
    store.set('apps', apps);
    return true;
});

ipcMain.handle('get-settings', () => {
    const defaults = {
        theme: 'cyberpunk',
        audioEnabled: true,
        lowSpecMode: false,
        visibleApps: 5,
        utilityWidgetVisible: false,
        systemStatsEnabled: false,
        autoUpdate: true
    };
    const stored = store.get('settings', {});
    return { ...defaults, ...stored };
});

ipcMain.handle('check-for-updates', async () => {
    return new Promise((resolve) => {
        const projectRoot = path.join(__dirname, '..');
        child_process.exec('git pull', { cwd: projectRoot }, (error, stdout, stderr) => {
            if (error) {
                console.error("Git Update Error:", error);
                resolve({ success: false, message: "Update Failed (Git not found?)" });
                return;
            }
            if (stdout && stdout.includes('Already up to date')) {
                resolve({ success: true, message: "Already up to date." });
            } else if (stdout) {
                resolve({ success: true, message: "Updated! Restarting..." });
            } else {
                resolve({ success: false, message: "Unknown Git Response" });
            }
        });
    });
});

ipcMain.handle('save-settings', (event, settings) => {
    store.set('settings', settings);
    return true;
});

ipcMain.handle('get-sticky-note', () => {
    return store.get('stickyNote', '');
});

ipcMain.handle('save-sticky-note', (event, text) => {
    store.set('stickyNote', text);
    return true;
});

ipcMain.handle('get-pinned-apps', () => {
    return store.get('pinnedApps', []);
});

ipcMain.handle('save-pinned-apps', (event, pins) => {
    store.set('pinnedApps', pins);
    return true;
});

ipcMain.handle('get-custom-paths', () => {
    return store.get('customPaths', { bg: '', music: '' });
});

ipcMain.handle('save-custom-paths', (event, paths) => {
    const current = store.get('customPaths', { bg: '', music: '' });
    store.set('customPaths', { ...current, ...paths });
    return true;
});

ipcMain.handle('load-music-file', async (event, filePath) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const data = await fs.promises.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase().substring(1);
        const mime = ext === 'mp3' ? 'mpeg' : ext;
        const base64 = data.toString('base64');
        return `data:audio/${mime};base64,${base64}`;
    } catch (e) {
        console.error("Failed to load music file:", e);
        return null;
    }
});

ipcMain.handle('get-displays', () => {
    return screen.getAllDisplays().map((d, index) => ({
        id: d.id,
        label: `Display ${index + 1} (${d.size.width}x${d.size.height})`,
        bounds: d.bounds
    }));
});


ipcMain.handle('launch-app', async (event, appPath) => {
    try {
        console.log("Launching:", appPath);
        await shell.openPath(appPath);
        return true;
    } catch (e) {
        console.error("Launch Failed:", e);
        return false;
    }
});

ipcMain.handle('launch-on-monitor', async (event, appPath, displayId) => {
    const displays = screen.getAllDisplays();
    const targetDisplay = displays.find(d => d.id === parseInt(displayId));

    if (!targetDisplay) {
        shell.openPath(appPath);
        return false;
    }

    const targetX = targetDisplay.bounds.x;
    const targetY = targetDisplay.bounds.y;

    const safeAppPath = appPath.replace(/'/g, "''");

    const psCommand = `
$code = @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
Add-Type -TypeDefinition $code -Language CSharp

$appPath = '${safeAppPath}'
$appName = [System.IO.Path]::GetFileNameWithoutExtension($appPath)

try {
    $p = Start-Process -FilePath $appPath -PassThru -ErrorAction Stop
} catch {
    exit 1
}

if ($p -eq $null) { exit }

$targetHandle = 0
$attempts = 0

while ($attempts -lt 40) {
    if (-not $p.HasExited) {
        $p.Refresh()
        if ($p.MainWindowHandle -ne 0) {
            $targetHandle = $p.MainWindowHandle
            break
        }
    }
    
    if ($targetHandle -eq 0) {
        $candidates = @(Get-Process -Name $appName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 })
        if ($candidates.Count -gt 0) {
            $targetHandle = $candidates[$candidates.Count - 1].MainWindowHandle
            break
        }
    }

    Start-Sleep -Milliseconds 500
    $attempts++
}

if ($targetHandle -ne 0) {
    Start-Sleep -Milliseconds 200
    [Win32]::SetWindowPos($targetHandle, 0, ${targetX}, ${targetY}, 0, 0, 0x0045)
    [Win32]::ShowWindow($targetHandle, 9)
    [Win32]::SetForegroundWindow($targetHandle)
    Start-Sleep -Milliseconds 1000
    [Win32]::SetWindowPos($targetHandle, 0, ${targetX}, ${targetY}, 0, 0, 0x0045)
}
`;

    const child_process = require('child_process');
    const spawn = child_process.spawn;

    const ps = spawn('powershell.exe', ['-Command', psCommand], {
        windowsHide: true
    });

    ps.on('error', (err) => {
        console.error('Failed to start subprocess.', err);
        shell.openPath(appPath);
    });

    ps.on('exit', (code) => {
        if (code !== 0) {
            console.log("PowerShell launch failed code " + code + ", fallback to shell.openPath");
            shell.openPath(appPath);
        }
    });

    return true;
});

ipcMain.handle('add-app-manual', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Executables', extensions: ['exe', 'lnk'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const name = path.basename(filePath, path.extname(filePath));

    let iconDataURL = null;
    try {
        const { nativeImage } = require('electron');
        const icon = await app.getFileIcon(filePath, { size: 'large' });
        iconDataURL = icon.toDataURL();
    } catch (error) {
    }

    return {
        name,
        path: filePath,
        icon: 'fa-solid fa-box-open',
        iconDataURL: iconDataURL
    };
});

ipcMain.handle('get-running-apps', async () => {
    try {
        const psCommand = `Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.Path -ne $null } | Select-Object Name, Path, MainWindowTitle | ConvertTo-Json -Compress`;
        const { exec } = require('child_process');

        return new Promise((resolve) => {
            exec(`powershell -Command "${psCommand.replace(/"/g, '\\"')}"`, { maxBuffer: 1024 * 1024 * 10 }, async (error, stdout, stderr) => {
                if (error) {
                    console.error("PS Exec Error:", error);
                    console.error("Stderr:", stderr);
                }

                if (!stdout || !stdout.trim()) {
                    console.log("No stdout from Process Scan");
                    resolve([]);
                    return;
                }

                try {
                    let processes = JSON.parse(stdout);
                    if (!Array.isArray(processes)) processes = [processes];

                    const validApps = processes
                        .filter(p => p.Path && !p.Path.toLowerCase().includes('windows\\system32'))
                        .map(p => ({
                            name: p.MainWindowTitle || p.Name,
                            path: p.Path,
                            icon: 'fa-solid fa-window-maximize'
                        }));

                    const uniqueApps = Array.from(new Map(validApps.map(item => [item.path, item])).values());

                    const finalApps = await Promise.all(uniqueApps.map(async (appItem) => {
                        try {
                            const icon = await app.getFileIcon(appItem.path, { size: 'large' });
                            appItem.iconDataURL = icon.toDataURL();
                        } catch (e) { }
                        return appItem;
                    }));

                    resolve(finalApps);
                } catch (parseError) {
                    console.error('Failed to parse process list', parseError);
                    resolve([]);
                }
            });
        });
    } catch (e) {
        console.error('Error fetching running apps:', e);
        return [];
    }
});

ipcMain.handle('smart-scan', async () => {
    const homeDir = app.getPath('home');
    const startMenu = path.join(homeDir, 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    const commonStartMenu = 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs';

    const foundApps = [];
    const seenPaths = new Set();

    const scanDir = (dir) => {
        try {
            if (!fs.existsSync(dir)) return;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    scanDir(fullPath);
                } else if (file.toLowerCase().endsWith('.lnk')) {
                    const details = shell.readShortcutLink(fullPath);
                    if (details.target && details.target.toLowerCase().endsWith('.exe')) {
                        const target = details.target;
                        const name = file.replace('.lnk', '');

                        const lowTarget = target.toLowerCase();
                        if (lowTarget.includes('uninstall') || lowTarget.includes('checker') || lowTarget.includes('helper')) continue;

                        if (!seenPaths.has(target)) {
                            seenPaths.add(target);
                            foundApps.push({ name, path: target, icon: 'fa-solid fa-gamepad', iconDataURL: null });
                        }
                    }
                }
            }
        } catch (e) { }
    };

    scanDir(startMenu);
    scanDir(commonStartMenu);
    scanDir(path.join(homeDir, 'Desktop'));

    const { nativeImage } = require('electron');
    const appsWithIcons = await Promise.all(
        foundApps.map(async (appData) => {
            try {
                const icon = await app.getFileIcon(appData.path, { size: 'large' });
                appData.iconDataURL = icon.toDataURL();
            } catch (error) {
            }
            return appData;
        })
    );

    return appsWithIcons;
});



autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
    if (mainWindow) mainWindow.webContents.send('checking_update');
});

autoUpdater.on('update-available', (info) => {
    log.info('Update available.', info);
    if (mainWindow) mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available.', info);
});

autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater. ' + err);
    if (mainWindow) mainWindow.webContents.send('update_error', err.toString());
});

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    log.info(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded');
    if (mainWindow) mainWindow.webContents.send('update_downloaded');
});

ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
});
