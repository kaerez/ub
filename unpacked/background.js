// --- Imports ---
try {
    importScripts('js-yaml.min.js');
  } catch (e) {
    console.error("Could not import js-yaml.min.js. Please ensure the file is in the extension's root directory.", e);
  }
  
  // --- Constants ---
  const CONTEXT_MENU_ID_OPTIONS = "options";
  const CONTEXT_MENU_ID_DEBUG = "debug";
  const FETCH_ALARM_NAME = "fetchUrlAlarm";
  
  // --- Initialization ---
  chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed.");
    setup();
    chrome.alarms.create(FETCH_ALARM_NAME, { delayInMinutes: 1, periodInMinutes: 10 });
  });
  
  chrome.runtime.onStartup.addListener(() => {
    console.log("Extension started up.");
    setup();
  });
  
  // --- Core Logic ---
  async function setup() {
    await updateContextMenus();
    const { configUrl } = await chrome.storage.local.get("configUrl");
    const managedConfig = await chrome.storage.managed.get("configUrl");
    if (configUrl || managedConfig.configUrl) {
      fetchAndProcessUrl();
    }
  }
  
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === FETCH_ALARM_NAME) {
      fetchAndProcessUrl();
    }
  });
  
  async function fetchAndProcessUrl() {
    const managedConfig = await chrome.storage.managed.get("configUrl");
    const localConfig = await chrome.storage.local.get("configUrl");
    const url = managedConfig.configUrl || localConfig.configUrl;
  
    if (!url) {
      await chrome.storage.local.set({ lastFetchAttempt: new Date().toISOString(), lastFetchResult: "No URL configured." });
      return;
    }
  
    await chrome.storage.local.set({ lastFetchAttempt: new Date().toISOString() });
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const text = await response.text();
      await chrome.storage.local.set({ lastFetchResult: "Success", lastSuccessfulFetch: new Date().toISOString() });
      await processFetchedContent(text);
    } catch (error) {
      console.error("Fetch failed:", error);
      await chrome.storage.local.set({ lastFetchResult: `Error: ${error.message}` });
      await clearAllDynamicRules();
    }
  }
  
  async function processFetchedContent(yamlText) {
    let config;
    try {
      config = jsyaml.load(yamlText);
      if (typeof config !== 'object' || config === null) throw new Error("YAML content is not a valid object.");
    } catch (e) {
      console.error("YAML Parsing Error:", e);
      await chrome.storage.local.set({ lastFetchResult: `Error: Invalid YAML format. ${e.message}` });
      await clearAllDynamicRules();
      return;
    }
  
    // Process lock status
    if (config.lock === true && config.authn && /^[a-f0-9]{64}$/i.test(config.authn)) {
      await chrome.storage.local.set({ lockStatus: 'locked', lockHash: config.authn });
    } else {
      await chrome.storage.local.set({ lockStatus: 'unlocked', lockHash: null });
    }
  
    const blockRules = [];
    const redirectRules = [];
    const globalRedirect = config.global || {};
    // --- FIX: Check for global redirect target existence ---
    const hasGlobalRedirectTarget = globalRedirect.hasOwnProperty('html') || globalRedirect.hasOwnProperty('htmlsrc');
  
    if (Array.isArray(config.urls)) {
      for (const rule of config.urls) {
        if (!rule || typeof rule.url !== 'string') continue;
  
        const hasRuleRedirectTarget = rule.hasOwnProperty('html') || rule.hasOwnProperty('htmlsrc');
  
        // --- FIX: A rule is a redirect if it has its own target OR a global target exists ---
        if (hasRuleRedirectTarget || hasGlobalRedirectTarget) {
          redirectRules.push({
            pattern: rule.url,
            ruleConfig: rule,
            globalConfig: globalRedirect
          });
        } else {
          // This is a pure block rule (no local or global redirect config).
          blockRules.push({ urlFilter: rule.url });
        }
      }
    }
  
    // Update DeclarativeNetRequest with BLOCK rules
    const dnrBlockRules = blockRules.map((rule, index) => ({
      id: index + 1,
      priority: 1,
      action: { type: 'block' },
      condition: { urlFilter: rule.urlFilter, resourceTypes: ["main_frame", "sub_frame", "script", "xmlhttprequest", "image", "stylesheet", "object", "other"] }
    }));
  
    const oldDnrRules = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldDnrRules.map(r => r.id),
      addRules: dnrBlockRules
    });
    console.log(`Applied ${dnrBlockRules.length} blocking rules.`);
  
    // Store REDIRECT rules for the tabs listener
    await chrome.storage.local.set({ redirectRules: redirectRules });
    console.log(`Stored ${redirectRules.length} redirection rules.`);
  }
  
  // --- Listener for Programmatic Redirection ---
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'loading' || !changeInfo.url) return;
  
    const { redirectRules } = await chrome.storage.local.get('redirectRules');
    if (!Array.isArray(redirectRules) || redirectRules.length === 0) return;
  
    for (const storedRule of redirectRules) {
      try {
        const patternAsRegex = escapeRegex(storedRule.pattern).replace(/\\\*/g, '.*');
        const regex = new RegExp(`^${patternAsRegex}$`);
  
        if (regex.test(changeInfo.url)) {
          console.log(`Checking redirect for tab ${tabId} (URL: ${changeInfo.url}) based on pattern: ${storedRule.pattern}`);
          const redirectTarget = await getRedirectTarget(storedRule.ruleConfig, storedRule.globalConfig);
  
          if (redirectTarget) {
            console.log(`Redirecting to: ${redirectTarget.substring(0, 100)}...`);
            chrome.tabs.update(tabId, { url: redirectTarget });
            return; // Stop after first match
          }
        }
      } catch (e) {
        console.error(`Error processing redirect rule: "${storedRule.pattern}". Skipping.`, e);
      }
    }
  });
  
  // --- Utility and Housekeeping ---
  async function getRedirectTarget(rule, globalConfig) {
    // 1. Rule htmlsrc
    if (rule.htmlsrc) {
      try {
        const response = await fetch(rule.htmlsrc, { method: 'HEAD', cache: 'no-store' });
        if (response.ok) return rule.htmlsrc;
      } catch (e) {
        console.warn(`Failed to fetch rule.htmlsrc: ${rule.htmlsrc}. Falling back.`);
      }
    }
    // 2. Rule html
    if (rule.html) return `data:text/html;charset=utf-8,${encodeURIComponent(rule.html)}`;
    // 3. Global htmlsrc
    if (globalConfig.htmlsrc) {
      try {
        const response = await fetch(globalConfig.htmlsrc, { method: 'HEAD', cache: 'no-store' });
        if (response.ok) return globalConfig.htmlsrc;
      } catch (e) {
        console.warn(`Failed to fetch global.htmlsrc: ${globalConfig.htmlsrc}. Falling back.`);
      }
    }
    // 4. Global html
    if (globalConfig.html) return `data:text/html;charset=utf-8,${encodeURIComponent(globalConfig.html)}`;
    return null;
  }
  
  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  async function clearAllDynamicRules() {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    if (existingRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingRules.map(r => r.id) });
      console.log("Cleared all dynamic blocking rules.");
    }
    await chrome.storage.local.set({ redirectRules: [] });
    console.log("Cleared all dynamic redirection rules.");
  }
  
  async function updateContextMenus() {
    chrome.contextMenus.removeAll(async () => {
      chrome.contextMenus.create({ id: CONTEXT_MENU_ID_OPTIONS, title: "Options", contexts: ["action"] });
      const { configUrl } = await chrome.storage.local.get("configUrl");
      const managedConfig = await chrome.storage.managed.get("configUrl");
      if (configUrl || managedConfig.configUrl) {
        chrome.contextMenus.create({ id: CONTEXT_MENU_ID_DEBUG, title: "Debug", contexts: ["action"] });
      }
    });
  }
  
  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === CONTEXT_MENU_ID_OPTIONS) {
      chrome.runtime.openOptionsPage();
    } else if (info.menuItemId === CONTEXT_MENU_ID_DEBUG) { // <-- FIX: Corrected typo from CONTEST to CONTEXT
      chrome.windows.create({ url: 'debug.html', type: 'popup', width: 500, height: 400 });
    }
  });
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateContextMenus") {
      updateContextMenus();
      sendResponse({status: "Context menus updated"});
    } else if (request.action === "forceRefresh") {
      fetchAndProcessUrl();
      sendResponse({ status: "Refresh triggered" });
    } else if (request.action === "verifyPassword") {
      verifyPassword(request.password).then(isValid => sendResponse({ isValid }));
      return true;
    }
    return false;
  });
  
  async function verifyPassword(password) {
    const { lockHash } = await chrome.storage.local.get('lockHash');
    if (!password || !lockHash) return false;
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('') === lockHash;
    } catch (e) {
      console.error("Error hashing password:", e);
      return false;
    }
  }
  