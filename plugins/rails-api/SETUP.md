# Setup — rails-api

This preset requires external tools not bundled in the plugin.
Complete the steps below after installing the plugin.

## External Dependencies

### mgrep `[claude_plugin]`

**Install:**
```sh
/plugins install mgrep@Mixedbread-Grep
```

**Docs:** https://github.com/mixedbread-ai/mgrep

**Notes:** Semantic code search plugin. settings_patch registers the Mixedbread-Grep marketplace and auto-enables the plugin.

### postgres-mcp `[mcp_server]` ⚠ **[COMPLEX]**

> **Warning:** This dependency requires complex setup (env vars, custom binaries, or
> multi-step installation). It may not be portable to other machines without manual work.

**Install:**
```sh
claude mcp add postgres --env DATABASE_URI=postgresql://<readonly_user>:<pass>@localhost:5432/<db_development> -- uvx postgres-mcp --access-mode=restricted
```

**Docs:** https://github.com/crystaldba/postgres-mcp

**Notes:** Not enabled by default — needs DATABASE_URI. Use a read-only role against the development DB; keep --access-mode=restricted. Gives EXPLAIN analysis, index tuning, health checks.

### playwright-mcp `[mcp_server]` *(moderate setup)*

**Install:**
```sh
claude mcp add playwright -- npx -y @playwright/mcp@latest
```

**Docs:** https://github.com/microsoft/playwright-mcp

**Notes:** Not enabled by default — low value for API-only apps. Enable only if the project serves admin/HTML pages or you need browser-based acceptance checks.
