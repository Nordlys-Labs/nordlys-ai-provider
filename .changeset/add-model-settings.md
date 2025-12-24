---
"@nordlys-labs/nordlys-ai-provider": minor
---

Add model-level settings support to provider functions. Users can now pass optional settings (temperature, maxOutputTokens, topP, etc.) when creating model instances. Settings are merged with call-level options, with call-level taking precedence. Also includes improved README documentation for settings and API key configuration.
