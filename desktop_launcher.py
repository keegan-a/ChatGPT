#!/usr/bin/env python3
"""Lightweight launcher that serves the app and opens it in your browser."""
from __future__ import annotations

import contextlib
import http.server
import socket
import socketserver
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_PORT = 8765
PORT_RANGE = range(DEFAULT_PORT, DEFAULT_PORT + 20)


def find_open_port() -> int:
    for port in PORT_RANGE:
        with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
            try:
                sock.bind(('127.0.0.1', port))
            except OSError:
                continue
            return port
    raise RuntimeError('No open port available in the configured range.')


class LauncherRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        # Quieter output for packaged apps.
        return


def open_browser_once(url: str) -> None:
    def _open() -> None:
        time.sleep(0.5)
        webbrowser.open(url)

    threading.Thread(target=_open, daemon=True).start()


def main() -> None:
    port = find_open_port()
    address = ('127.0.0.1', port)
    handler = LauncherRequestHandler
    with socketserver.TCPServer(address, handler) as httpd:
        url = f'http://{address[0]}:{address[1]}/index.html'
        print(f'Budget Builder 95 running at {url}\nPress Ctrl+C to stop.')
        open_browser_once(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nShutting down...')


if __name__ == '__main__':
    main()
