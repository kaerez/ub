# URL Blocker Extension: Configuration File Syntax

## Overview

This document outlines the YAML syntax for the configuration file used by the URL Blocker Extension. The extension operates on a hybrid model:
* **Blocking:** Uses Chrome's efficient `declarativeNetRequest` API to block requests.
* **Redirection:** Uses the `tabs` API to programmatically redirect users to different pages.

The configuration file must be a valid YAML file.

---

## Top-Level Structure

The configuration file is a YAML object that can contain four top-level keys.

| Key      | Type                      | Required                               | Description                                                                                                                              |
| :------- | :------------------------ | :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `lock`   | Boolean (`true`/`false`)  | No                                     | If set to `true`, the extension's "Options" page is locked, preventing users from changing the configuration URL.                      |
| `authn`  | String                    | Yes, if `lock` is `true`               | A 64-character lowercase SHA256 hash of the password required to unlock the options page.                                                |
| `global` | Object                    | No                                     | Defines default redirect targets (`html` or `htmlsrc`) for any redirect rules that do not specify their own.                             |
| `urls`   | List of rule objects      | Yes                                    | The primary list containing all blocking and redirection rules.                                                                          |

---

## Rule Syntax

Each item in the `urls` list is an object that defines a single rule. The structure of the object determines whether it's a blocking or a redirection rule.

### Rule Object Keys

| Key       | Type   | Required | Description                                                                                                                              |
| :-------- | :----- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `url`     | String | Yes      | A URL pattern using wildcard (`*`) matching. The `*` matches any sequence of zero or more characters. All other characters are literals. |
| `html`    | String | No       | If present, makes the rule a **redirect rule**. The value is a string of raw HTML to be displayed to the user.                           |
| `htmlsrc` | String | No       | If present, makes the rule a **redirect rule**. The value is a full URL to an external page where the user will be redirected.           |

### Blocking Rule

A rule is treated as a **block rule** if it contains **only** the `url` key.

**Example:**
```yaml
- url: "*://*.ad-network.com/*" # Blocks all protocols, e.g.: https://*.ad-network.com/* and http://*.ad-network.com/*

Redirection Rule
A rule is treated as a redirect rule if it contains the url key and either html or htmlsrc.

Example:

# Redirect to an external page
- url: "*://social-media.com/*.html" # Doesn't block subdomains such as www. and only blocks files in url root ending in .html
  htmlsrc: "https://internal.mycompany.com/acceptable-use-policy.html"

# Redirect to a custom inline HTML page
- url: "*://*.gaming-site.net/abc/*" # Doesn't block outside /abc/
  html: "<h1>Access Denied</h1><p>This site is not accessible from the corporate network.</p>"

Logic and Precedence
Redirect Target Precedence
When a URL matches a redirect rule, the extension decides where to send the user based on the following order of priority:

Rule htmlsrc: The htmlsrc URL defined within the specific rule itself. If htmlsrc cannot be fetched or malformed, will fallback to html (if present)

Rule html: The html content defined within the specific rule.

Global htmlsrc: The htmlsrc URL defined in the top-level global section. If htmlsrc cannot be fetched or malformed, will fallback to html (if present)

Global html: The html content defined in the top-level global section.

If a rule is a redirect rule (i.e., it has an empty html or htmlsrc key) but no target can be found in the precedence list, only blocking will occur.

Full Configuration Example
# ------------------------------------------------------------------
# URL Blocker Extension - Sample Configuration
# ------------------------------------------------------------------

# Lock the options page to prevent manual changes.
lock: true

# The SHA256 hash for the password "s3cureP@ss!".
# Users will need this password to unlock the options page.
authn: "a113a878d6bde954a1822bd524d9c4728a74136540c504b2880a18f773659cd8"

# Define default pages for any redirect rules that don't have their own.
# The 'htmlsrc' will be prioritized over 'html' if both are present.
global:
  htmlsrc: "https://www.example.com/en/access-denied.html"
  html: "<h1>Access Restricted</h1><p>Your access to this type of content is restricted by company policy.</p>"

# The list of all rules to be enforced by the extension.
urls:
  # --- BLOCKING RULES ---
  # These patterns will be completely blocked by the extension.
  - url: "*://*.adserver.com/*"
  - url: "*://*.tracking-analytics.net/*"
  - url: "*://*.cryptomining.org/*"

  # --- REDIRECTION RULES ---

  # 1. Redirects a specific domain to a custom external page.
  #    This rule's 'htmlsrc' overrides the global setting.
  - url: "*://*.banned-social-network.com/*"
    htmlsrc: "https://internal.mycompany.com/policies/social-media.html"

  # 2. Redirects a category of sites to a custom inline HTML page.
  #    This rule's 'html' content is used because it has no 'htmlsrc'.
  - url: "*://*.online-games-portal.com/*"
    html: "<h1>Gaming Policy</h1><p>Recreational gaming sites are unavailable.</p>"

  # 3. Redirects using the 'global' fallback.
  #    This rule is a redirect because the 'html' key is present (even if empty).
  #    Since it has no value, it will fall back to using the 'htmlsrc' from the 'global' section.
  - url: "*://*.streaming-video-service.io/*"
    html: ""
