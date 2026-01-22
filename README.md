# SLauncher 

A high-performance Desktop App Launcher built with Electron, featuring a "Cyberpunk" aesthetic, real-time system metrics, and smart widgets.

## Project Status (v1.0 - SLauncher Release)
- **Status**: Production Ready / Portable
- **Core Features**:
  - **App Launching**: Drag-and-drop or manual add.
  - **Persistence**: Remembers pinned apps, settings, and sticky notes.
  - **System Stats**: Real-time CPU, RAM, and GPU monitoring.
  - **Auto-Updates**: Built-in Git integration for seamless updates.
  - **Multi-Monitor Launch Support**: Launch an application on a chosen display, if more than one.
- **UI**: Premium "Glassmorphism" design with 60FPS animations.

## Quick Start

1.  **Install Dependencies**
    ```powershell
    npm install
    ```

2.  **Run Development Mode**
    ```powershell
    npm start
    ```

3.  **Build Executable**
    ```powershell
    npm run dist
    ```
    *Creates a portable executable in `dist/win-unpacked/`.*

## File Structure

- **`src/`**: All source code (`main.js`, `renderer`, `styles`, `html`).
- **`dist/`**: Production builds.
- **`tests/`**: Testing scripts.
- **`logs/`**: Build and error logs.

## Features
- **Smart Dock**: Infinite carousel with keyboard navigation.
- **System Resource Monitor**: Low-overhead monitoring powered by `systeminformation`.
- **Low Spec Mode**: Performance toggle for older hardware.
- **Customization**: Change background wallpapers and themes.

## Credits
- **Developer**: sxpper (discord)
- **Tech Stack**: Electron, Node.js, SystemInformation
