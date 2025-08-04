# URL Blocker Extension: Configuration File Syntax

This document outlines the syntax for the YAML configuration file used by the URL Blocker Extension.

## Overview

The configuration file uses the **YAML** format. It allows you to define a set of rules to either **block** network requests or **redirect** the user to a specific page.

The file consists of up to four top-level keys: `lock`, `authn`, `global`, and `urls`.

```yaml
# --- Top Level Keys ---

# (Optional) Locks the extension's "Options" page.
lock: true

# (Required if lock is true) The SHA256 hash of the password needed to unlock the options.
authn: "83ac674216f3e15c761ee1a5e255f067953623c8b388b4459e15f978d7c4a6f4"

# (Optional) Defines default redirect pages for any redirect rule that doesn't have its own.
global:
  htmlsrc: "[https://example.com/default_blocked_page.html](https://example.com/default_blocked_page.html)"
  html: "<h1>Blocked</h1><p>This content is unavailable.</p>"

# (Required) A list of all blocking and redirection rules.
urls:
  # ... rules go here ...
Top-Level Keys ExplainedlockType: true or falseDefault: falseDescription: If set to true, the "Options" page in the extension will be locked, preventing users from changing the configuration URL.authnType: stringRequired: Only if lock is true.Description: This must be a 64-character lowercase SHA256 hash of the password. When a user tries to access the locked options, they will be prompted for a password. The extension will hash their input and compare it to this value.globalType: objectDefault: (empty)Description: This section defines fallback redirect targets for any rule in the urls list that is a redirect rule but does not define its own html or htmlsrc.Sub-keys:htmlsrc: A URL to an external page to redirect to.html: A string of raw HTML to display as the blocked page.urlsType: list of objectsRequired: YesDescription: This is the main list of rules. Each item in the list is an object representing a single rule.Rule Object SyntaxEach rule in the urls list is an object with the following keys:urlType: stringRequired: YesDescription: The URL pattern to match. This uses a simple wildcard syntax:* matches any sequence of characters.All other characters are treated as literals.Example: *://*.google.com/search?q=* will match any Google search on both http and https.html (for Redirection)Type: stringOptional: YesDescription: If this key is present, any request matching the url pattern will be redirected to a page containing this raw HTML content.htmlsrc (for Redirection)Type: string (a valid URL)Optional: YesDescription: If this key is present, any request matching the url pattern will be redirected to this external URL.Rule Precedence and BehaviorBlock vs. Redirect:If a rule object only has a url key, it is a BLOCK rule. All matching requests will be blocked entirely.If a rule object has a url key and either an html or htmlsrc key, it is a REDIRECT rule.Redirect Precedence: For a matching redirect rule, the target is chosen in this order:The rule's own htmlsrc (if it exists).The rule's own html (if it exists and htmlsrc does not).The global section's htmlsrc (if it exists and the rule has no target).The global section's html (if it exists and no other target has been found).Full Example File# Configuration for the URL Blocker Extension

lock: true
authn: "83ac674216f3e15c761ee1a5e255f067953623c8b388b4459e15f978d7c4a6f4" # SHA256 hash for "password123"

global:
  # A default page for any redirected sites that don't have their own specific page.
  htmlsrc: "[https://company.com/pages/access-denied.html](https://company.com/pages/access-denied.html)"

urls:
  # --- BLOCKING RULES ---
  # These sites will be blocked completely.
  - url: "*://*.doubleclick.net/*"
  - url: "*://*[.adservice.com/](https://.adservice.com/)*"

  # --- REDIRECTION RULES ---

  # Rule 1: Redirects to a specific external page, overriding the global default.
  - url: "*://*[.social-media-site.com/](https://.social-media-site.com/)*"
    htmlsrc: "[https://company.com/pages/policy-social-media.html](https://company.com/pages/policy-social-media.html)"

  # Rule 2: Redirects to a page with custom inline HTML.
  - url: "*://*.gaming-site.net/*"
    html: "<h1>Access Restricted</h1><p>Gaming sites are not permitted during work hours.</p>"

  # Rule 3: This is also a redirect rule, but since it has no target,
  # it will fall back to the target defined in the 'global' section.
  - url: "*://*.streaming-service.org/*"
