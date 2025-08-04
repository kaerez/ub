document.addEventListener('DOMContentLoaded', () => {
    const urlTd = document.getElementById('url');
    const lastFetchAttemptTd = document.getElementById('lastFetchAttempt');
    const lastFetchResultTd = document.getElementById('lastFetchResult');
    const lastSuccessfulFetchTd = document.getElementById('lastSuccessfulFetch');
    const lockStatusTd = document.getElementById('lockStatus');
    const refreshButton = document.getElementById('refresh-now');

    // Function to update the debug info on the page
    async function updateDebugInfo() {
        // Get data from both managed and local storage
        const managedConfig = await chrome.storage.managed.get('configUrl');
        const localData = await chrome.storage.local.get([
            'configUrl',
            'lastFetchAttempt',
            'lastFetchResult',
            'lastSuccessfulFetch',
            'lockStatus'
        ]);

        // Display the URL, prioritizing the managed one
        urlTd.textContent = managedConfig.configUrl || localData.configUrl || 'Not set';

        // Display other debug data
        lastFetchAttemptTd.textContent = localData.lastFetchAttempt ? new Date(localData.lastFetchAttempt).toLocaleString() : 'N/A';
        lastFetchResultTd.textContent = localData.lastFetchResult || 'N/A';
        lastSuccessfulFetchTd.textContent = localData.lastSuccessfulFetch ? new Date(localData.lastSuccessfulFetch).toLocaleString() : 'N/A';
        lockStatusTd.textContent = localData.lockStatus || 'unlocked';
    }

    // Requirement 5: "Refresh Now" button
    refreshButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "forceRefresh" });
        refreshButton.textContent = "Refreshing...";
        // The storage listener below will update the UI automatically
        setTimeout(() => {
            refreshButton.textContent = "Refresh Now";
        }, 1000);
    });

    // Listen for changes in storage and update the UI in real-time
    chrome.storage.onChanged.addListener((changes, namespace) => {
        updateDebugInfo();
    });

    // Initial load of debug info
    updateDebugInfo();
});
