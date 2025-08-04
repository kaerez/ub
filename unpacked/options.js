document.addEventListener('DOMContentLoaded', async () => {
    const optionsForm = document.getElementById('options-form');
    const urlInput = document.getElementById('url');
    const removeButton = document.getElementById('remove');
    const statusDiv = document.getElementById('status');
    const lockOverlay = document.getElementById('lock-overlay');
    const passwordForm = document.getElementById('password-form');
    const passwordInput = document.getElementById('password');
    const passwordError = document.getElementById('password-error');

    // --- FIX: Helper function to securely enable/disable the form ---
    function setFormEnabled(enabled) {
        urlInput.disabled = !enabled;
        optionsForm.querySelector('button[type="submit"]').disabled = !enabled;
        removeButton.disabled = !enabled;
    }

    function showStatus(message, duration = 3000) {
        statusDiv.textContent = message;
        setTimeout(() => { statusDiv.textContent = ''; }, duration);
    }

    async function checkLockStatus() {
        const managedConfig = await chrome.storage.managed.get('configUrl');
        if (managedConfig.configUrl) {
            urlInput.value = managedConfig.configUrl;
            setFormEnabled(false); // Permanently disable if managed
            showStatus("Configuration is managed by an administrator.", 10000);
            return;
        }

        const { lockStatus } = await chrome.storage.local.get('lockStatus');
        if (lockStatus === 'locked') {
            lockOverlay.style.display = 'flex';
            setFormEnabled(false); // Keep form disabled while locked
        } else {
            lockOverlay.style.display = 'none';
            setFormEnabled(true); // Enable form if not locked
        }
    }

    // Load saved URL and check lock status
    const localConfig = await chrome.storage.local.get('configUrl');
    if (localConfig.configUrl) {
        urlInput.value = localConfig.configUrl;
    }
    await checkLockStatus();

    // Handle saving the URL
    optionsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = urlInput.value;
        await chrome.storage.local.set({ configUrl: url });
        showStatus('URL saved!');
        await chrome.runtime.sendMessage({ action: "forceRefresh" });
        await chrome.runtime.sendMessage({ action: "updateContextMenus" });
        await checkLockStatus(); // Re-check lock status
    });

    // Handle removing the URL
    removeButton.addEventListener('click', async () => {
        await chrome.storage.local.remove(['configUrl', 'lockStatus', 'lockHash']);
        urlInput.value = '';
        showStatus('URL removed. Options are now unlocked.');
        await chrome.runtime.sendMessage({ action: "updateContextMenus" });
        await checkLockStatus(); // Re-check, which will now find it unlocked
    });

    // Handle password submission
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = passwordInput.value;
        passwordError.classList.add('hidden');

        const response = await chrome.runtime.sendMessage({ action: "verifyPassword", password: password });

        if (response.isValid) {
            lockOverlay.style.display = 'none';
            setFormEnabled(true); // Enable form on successful unlock
            showStatus('Options unlocked for this session.');
        } else {
            passwordError.classList.remove('hidden');
        }
        passwordInput.value = '';
    });
});
