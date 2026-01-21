
console.log('Settings Handler: Loading...');


function toggleSettings() {
    console.log('Settings Handler: Toggle called');
    const panel = document.getElementById('settingsPanel');
    if (!panel) {
        console.error('Settings Handler: Panel not found!');
        return;
    }


    panel.classList.toggle('active');


    const bgInput = document.getElementById('bgInput');
    if (bgInput) {
        bgInput.removeAttribute('onchange');
        bgInput.addEventListener('change', function () {
            handleCustomBg(this);
        });
    }


    const gearBtn = document.querySelector('.settings-btn');
    const backdrop = document.getElementById('settingsBackdrop');

    if (panel.classList.contains('active')) {
        panel.style.right = '0px';
        if (gearBtn) {
            gearBtn.style.opacity = '0';
            gearBtn.style.pointerEvents = 'none';
        }
        if (backdrop) backdrop.classList.add('active');
    } else {
        panel.style.right = '-650px';
        if (gearBtn) {
            gearBtn.style.opacity = '1';
            gearBtn.style.pointerEvents = 'auto';
        }
        if (backdrop) backdrop.classList.remove('active');
    }
}


function switchSettingsTab(tabId, clickedBtn) {
    console.log('Settings Handler: Switch tab to', tabId);


    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    if (clickedBtn) clickedBtn.classList.add('active');


    const sections = document.querySelectorAll('.settings-section');
    sections.forEach(sec => sec.classList.remove('active'));

    const target = document.getElementById('tab-' + tabId);
    if (target) {
        target.classList.add('active');
    } else {
        console.warn('Settings Handler: Target section not found:', tabId);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    console.log('Settings Handler: DOM Content Loaded');


    const gearBtn = document.querySelector('.settings-btn');
    if (gearBtn) {
        gearBtn.removeAttribute('onclick');
        gearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSettings();
        });
        console.log('Settings Handler: Gear button bound');
    } else {
        console.error('Settings Handler: Gear button NOT found');
    }


    const panel = document.getElementById('settingsPanel');
    if (panel) {
        const closeBtn = panel.querySelector('.settings-header span:last-child');
        if (closeBtn) {
            closeBtn.removeAttribute('onclick');
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSettings();
            });
        }
    }


    const backdrop = document.getElementById('settingsBackdrop');
    if (backdrop) {
        backdrop.addEventListener('click', () => {
            console.log("Backdrop Clicked -> Closing Settings");
            toggleSettings();
        });
        console.log("Backdrop listener attached");
    }

});


function handleCustomBg(input) {
    console.log('Settings Handler: Custom BG selected');
    if (input.files && input.files[0]) {
        const file = input.files[0];
        console.log('Settings Handler: File found:', file.name);

        const reader = new FileReader();

        reader.onload = function (e) {
            console.log('Settings Handler: File read success');
            document.body.style.backgroundImage = `url('${e.target.result.replace(/\\/g, '/')}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';

            document.body.style.animation = 'none';
        };

        reader.readAsDataURL(file);

        if (window.ipcRenderer && file.path) {
            window.ipcRenderer.invoke('save-custom-paths', { bg: file.path });
        }
    }
}

function resetBackground() {
    document.body.style.backgroundImage = '';
    document.body.style.animation = 'gradientBG 15s ease infinite';
    const input = document.getElementById('bgInput');
    if (input) input.value = '';
}


window.handleCustomBg = handleCustomBg;
window.resetBackground = resetBackground;


window.toggleSettings = toggleSettings;
window.switchSettingsTab = switchSettingsTab;
