# Plugin Marketplace (Provider Only)

## Overview
Internal marketplace managed in control-plane:
- Publish plugin releases (compatibility, channel, changelog)
- Approve install/update/remove requests from instances
- Agent executes rollouts with plugin-specific smoke

## Control-plane UI
Page:
- `/plugins`

Supports:
- Publish release
- Approve pending requests

## Release Publishing
Endpoint:
```
POST /api/plugins/releases
{ "name", "version", "channel", "compatibility", "changelog", "signature" }
```

Signature:
- HMAC-SHA256 using `PLUGIN_MARKETPLACE_SIGNING_SECRET` over the release payload (without signature).

## Instance Requests
Instance API:
```
POST /admin/plugins/request
{ "pluginName": "product-label", "version": "0.1.0", "action": "install" }
```

Control-plane stores `PluginRequest` and awaits approval.

## Approval Flow
Provider approves:
```
POST /api/plugins/requests/:id/approve
```

Approval creates a `PluginJob` for that instance.

## Agent Rollout
Agent polls:
- `POST /api/plugins/next`
- `POST /api/plugins/report`

Commands executed:
- `PLUGIN_INSTALL_CMD`
- `PLUGIN_UPDATE_CMD`
- `PLUGIN_REMOVE_CMD`
- `PLUGIN_SMOKE_CMD`

Commands can use:
- `{{name}}`, `{{version}}`, `{{action}}`

## Telemetry
Per plugin job:
- status
- duration (`durationMs`)
- errors

Use control-plane tables:
- `PluginJob`
- `PluginRelease`
- `PluginRequest`

## Env Vars
Control-plane:
- `PLUGIN_MARKETPLACE_SIGNING_SECRET`

Instance API:
- `CONTROL_PLANE_URL`
- `AGENT_SECRET`
- `INSTANCE_ID`

Agent:
- `PLUGIN_UPDATE_ENABLED`
- `PLUGIN_POLL_MIN`
- `PLUGIN_INSTALL_CMD`
- `PLUGIN_UPDATE_CMD`
- `PLUGIN_REMOVE_CMD`
- `PLUGIN_SMOKE_CMD`
