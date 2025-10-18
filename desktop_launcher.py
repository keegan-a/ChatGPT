"""Lightweight desktop launcher for the Budget Builder retro experience."""

from __future__ import annotations

import argparse
import contextlib
import http.server
import socket
import threading
import time
import webbrowser
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent


class SilentHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Serve files without noisy console logging."""

    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=directory or str(APP_ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:  # noqa: A003 - http.server API
        return


def find_free_port(preferred: int | None = None) -> int:
    """Locate an available TCP port, falling back from the preferred option."""

    candidates = [preferred] if preferred else []
    candidates += [8765, 8888, 0]
    for port in candidates:
        with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                continue
            return sock.getsockname()[1]
    raise RuntimeError("Unable to find a free localhost port")


def run_server(port: int, ready_event: threading.Event) -> http.server.ThreadingHTTPServer:
    handler = lambda *args, **kwargs: SilentHTTPRequestHandler(*args, directory=str(APP_ROOT), **kwargs)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)  # type: ignore[arg-type]
    ready_event.set()
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        server.server_close()
    return server


def main() -> None:
    parser = argparse.ArgumentParser(description="Launch the Budget Builder desktop experience.")
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="Optional port to bind (defaults to the first free port starting at 8765).",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Serve the app without automatically opening the default browser.",
    )
    args = parser.parse_args()

    port = find_free_port(args.port)
    address = f"http://127.0.0.1:{port}/index.html"

    ready = threading.Event()
    server_thread = threading.Thread(target=run_server, args=(port, ready), daemon=True)
    server_thread.start()
    ready.wait()

    print("Budget Builder desktop server running!", flush=True)
    print(f"Serving from: {APP_ROOT}", flush=True)
    print(f"Open in your browser at: {address}\n", flush=True)

    if not args.no_browser:
        time.sleep(0.4)
        webbrowser.open(address)

    try:
        while server_thread.is_alive():
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nShutting down Budget Builder desktop server…", flush=True)


if __name__ == "__main__":
    main()
