# OpenClaw iPad Control Plugin

Drive an iPad cursor via an ESP32 BLE HID bridge. JavaScript ESM plugin for OpenClaw.

## Tools

| Tool | Description |
|---|---|
| `ipad_move_direction` | Move cursor in a cardinal direction (up/down/left/right) by N steps |
| `ipad_move` | Move cursor by dx/dy delta |
| `ipad_square` | Trace a square pattern — verifies bridge is live before issuing commands |

## Architecture

```
OpenClaw agent
  → ipad-control plugin (this repo)
    → SSH → bridge host
      → ipad-bridge-cli.py
        → TCP → bridge daemon (:18790)
          → USB serial → ESP32
            → BLE HID → iPad AssistiveTouch cursor
```

The plugin SSHes to a bridge host and runs `ipad-bridge-cli.py` (included in `scripts/`). That script connects to a bridge daemon over TCP, which relays commands to an ESP32 over USB serial. The ESP32 forwards them as BLE HID mouse reports to an iPad paired via AssistiveTouch.

## Prerequisites

1. **ESP32 BLE HID firmware** — flashed and paired to iPad via AssistiveTouch
2. **Bridge daemon** — running on the bridge host, listening on TCP `:18790`, connected to the ESP32 over USB serial
3. **`ipad-bridge-cli.py`** — deployed to the bridge host (copy from `scripts/`)
4. **SSH key auth** — the OpenClaw agent host must have a key accepted by the bridge host

## Installation

```bash
# On the OpenClaw host
cp -r openclaw-ipad /path/to/.openclaw/extensions/ipad-control
```

Add to `openclaw.json`:

```json
{
  "plugins": {
    "allow": ["ipad-control"],
    "entries": {
      "ipad-control": {
        "enabled": true,
        "config": {
          "bridgeUser": "BRIDGE_USER",
          "bridgeHost": "BRIDGE_HOST",
          "bridgeCmdPath": "/path/to/ipad-bridge-cli.py"
        }
      }
    },
    "installs": {
      "ipad-control": {
        "source": "path",
        "version": "1.0.0",
        "installPath": "/path/to/.openclaw/extensions/ipad-control"
      }
    }
  }
}
```

## Configuration

| Key | Required | Description |
|---|---|---|
| `bridgeUser` | Yes | SSH username on the bridge host |
| `bridgeHost` | Yes | Bridge host IP address or hostname |
| `bridgeCmdPath` | Yes | Absolute path to `ipad-bridge-cli.py` on the bridge host |

## Contributing

All work requires a GitHub Issue before any code is written. PRs must reference the issue (`Closes #N`) and include a `CHANGELOG.md` entry.
