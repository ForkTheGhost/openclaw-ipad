#!/usr/bin/env python3
"""CLI entry point for the iPad HID bridge — called via SSH from the OpenClaw plugin."""
from __future__ import annotations
import argparse
import socket
import time


BRIDGE_HOST = "127.0.0.1"
BRIDGE_PORT = 18790


class BridgeClient:
    def __init__(self, host: str = BRIDGE_HOST, port: int = BRIDGE_PORT, timeout: float = 5.0):
        self.host = host
        self.port = port
        self.timeout = timeout
        self._sock: socket.socket | None = None
        self._buf = b""

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, *_):
        self.close()

    def connect(self):
        s = socket.create_connection((self.host, self.port), timeout=self.timeout)
        s.settimeout(self.timeout)
        self._sock = s
        self._read_line()  # drain [READY] banner

    def close(self):
        if self._sock is None:
            return
        try:
            self._send("QUIT")
            self._read_line()
        except OSError:
            pass
        try:
            self._sock.close()
        finally:
            self._sock = None

    def _send(self, line: str):
        if self._sock is None:
            raise RuntimeError("not connected")
        self._sock.sendall((line + "\n").encode("utf-8"))

    def _read_line(self) -> str:
        if self._sock is None:
            raise RuntimeError("not connected")
        while b"\n" not in self._buf:
            chunk = self._sock.recv(4096)
            if not chunk:
                raise RuntimeError("bridge closed connection")
            self._buf += chunk
        line, self._buf = self._buf.split(b"\n", 1)
        return line.decode("utf-8", errors="replace").rstrip("\r")

    def move(self, direction: str, steps: int = 1):
        """direction in {w, a, s, d}. One step = one firmware HID report."""
        if direction not in ("w", "a", "s", "d"):
            raise ValueError("direction must be w/a/s/d")
        for _ in range(max(1, steps)):
            self._send(direction)


DIR = {"up": "w", "down": "s", "left": "a", "right": "d"}


def main():
    ap = argparse.ArgumentParser(description="iPad HID bridge CLI")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sq = sub.add_parser("square", help="Trace a square pattern")
    sq.add_argument("--steps", type=int, default=25)

    md = sub.add_parser("move_direction", help="Move in a cardinal direction")
    md.add_argument("direction", choices=["up", "down", "left", "right"])
    md.add_argument("--steps", type=int, default=25)

    mv = sub.add_parser("move", help="Move by dx/dy delta")
    mv.add_argument("dx", type=int)
    mv.add_argument("dy", type=int)

    args = ap.parse_args()

    with BridgeClient() as c:
        if args.cmd == "square":
            for d in ("d", "s", "a", "w"):
                c.move(d, args.steps)
                time.sleep(0.5)
        elif args.cmd == "move_direction":
            c.move(DIR[args.direction], args.steps)
        elif args.cmd == "move":
            if args.dx > 0:
                c.move("d", abs(args.dx))
            elif args.dx < 0:
                c.move("a", abs(args.dx))
            if args.dy > 0:
                c.move("s", abs(args.dy))
            elif args.dy < 0:
                c.move("w", abs(args.dy))

    print("ok")


if __name__ == "__main__":
    main()
