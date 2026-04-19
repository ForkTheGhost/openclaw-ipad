/**
 * OpenClaw iPad Control Plugin
 *
 * Drives an iPad cursor via an ESP32 BLE HID bridge. Registers 3 tools:
 * - ipad_move_direction: move in a cardinal direction by N steps
 * - ipad_move:           move by dx/dy delta
 * - ipad_square:         trace a square pattern (bridge liveness test)
 *
 * Architecture: plugin SSHes to a bridge host and runs ipad-bridge-cli.py,
 * which connects to the bridge daemon over TCP. The daemon relays commands
 * to the ESP32 over USB serial → BLE HID → iPad AssistiveTouch cursor.
 *
 * Required config (openclaw.json plugins.entries.<id>.config):
 *   bridgeUser    SSH username on the bridge host
 *   bridgeHost    bridge host IP or hostname
 *   bridgeCmdPath absolute path to ipad-bridge-cli.py on the bridge host
 */

import { definePluginEntry } from "/usr/lib/node_modules/openclaw/dist/plugin-sdk/core.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function sshBridge(bridgeUser, bridgeHost, bridgeCmdPath, ...args) {
  return execFileAsync(
    "ssh",
    [
      "-o", "BatchMode=yes",
      "-o", "ConnectTimeout=10",
      `${bridgeUser}@${bridgeHost}`,
      "python3", bridgeCmdPath,
      ...args,
    ],
    { timeout: 30000 }
  ).then(({ stdout }) => stdout.trim());
}

export default definePluginEntry({
  id: "ipad-control",
  name: "iPad Control",
  description: "Drive iPad cursor via ESP32 BLE HID bridge — move, directional swipe, test pattern",

  register(api) {
    const cfg = api.pluginConfig || {};
    const { bridgeUser, bridgeHost, bridgeCmdPath } = cfg;

    if (!bridgeUser || !bridgeHost || !bridgeCmdPath) {
      api.logger.error("[ipad-control] Missing required config: bridgeUser, bridgeHost, bridgeCmdPath");
      return;
    }

    api.registerTool({
      name: "ipad_move_direction",
      description: "Move the iPad cursor in a cardinal direction. One step = one firmware HID report; 25 steps ≈ a medium swipe.",
      parameters: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["up", "down", "left", "right"],
            description: "Direction to move",
          },
          steps: {
            type: "integer",
            description: "Number of steps (default 25)",
          },
        },
        required: ["direction"],
      },
      async execute(_id, params) {
        try {
          const args = ["move_direction", params.direction];
          if (params.steps) args.push("--steps", String(params.steps));
          await sshBridge(bridgeUser, bridgeHost, bridgeCmdPath, ...args);
          return {
            content: [{ type: "text", text: `Moved ${params.direction} ${params.steps ?? 25} steps` }],
          };
        } catch (err) {
          return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
      },
    });

    api.registerTool({
      name: "ipad_move",
      description: "Move the iPad cursor by a pixel delta. Positive dx = right, negative = left. Positive dy = down, negative = up. Each unit is one firmware step.",
      parameters: {
        type: "object",
        properties: {
          dx: { type: "integer", description: "Horizontal delta (positive = right)" },
          dy: { type: "integer", description: "Vertical delta (positive = down)" },
        },
        required: ["dx", "dy"],
      },
      async execute(_id, params) {
        try {
          await sshBridge(bridgeUser, bridgeHost, bridgeCmdPath, "move", String(params.dx), String(params.dy));
          return {
            content: [{ type: "text", text: `Moved cursor dx=${params.dx} dy=${params.dy}` }],
          };
        } catch (err) {
          return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
      },
    });

    api.registerTool({
      name: "ipad_square",
      description: "Move the iPad cursor in a square pattern (right → down → left → up). Use this to verify the HID bridge is live and the cursor is responding before issuing directional commands.",
      parameters: {
        type: "object",
        properties: {
          steps: {
            type: "integer",
            description: "Steps per side (default 25)",
          },
        },
      },
      async execute(_id, params) {
        try {
          const args = ["square"];
          if (params.steps) args.push("--steps", String(params.steps));
          await sshBridge(bridgeUser, bridgeHost, bridgeCmdPath, ...args);
          return {
            content: [{ type: "text", text: `Square pattern complete (${params.steps ?? 25} steps/side)` }],
          };
        } catch (err) {
          return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
      },
    });

    api.logger.info("[ipad-control] Plugin registered. 3 tools loaded.");
  },
});
