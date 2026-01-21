console.log("Renderer Loader: Starting Initialization...");

window.ALL_APPS = [];
window.ipc = null;
window.isElectron = false;

try {
    if (typeof require !== 'undefined') {
        const { ipcRenderer } = require('electron');
        window.ipcRenderer = ipcRenderer;
        window.ipc = ipcRenderer;
        window.isElectron = true;
        console.log("Renderer Loader: IPC via Require SUCCESS");
    } else if (window.require) {
        const { ipcRenderer } = window.require('electron');
        window.ipcRenderer = ipcRenderer;
        window.ipc = ipcRenderer;
        window.isElectron = true;
        console.log("Renderer Loader: IPC via window.require SUCCESS");
    } else {
        console.warn("Renderer Loader: No Electron environment detected. Running in Browser Mode?");
    }
} catch (e) {
    console.error("Renderer Loader: CRITICAL IMPORT ERROR", e);
    alert("CRITICAL ERROR: Failed to load Electron IPC.\n" + e.message);
}

window.safeAudioContext = null;
try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
        window.safeAudioContext = new AudioContext();
    }
} catch (e) {
    console.warn("Renderer Loader: AudioContextBlocked", e);
}

console.log("Renderer Loader: Initialization Complete. IPC Available:", window.isElectron);
