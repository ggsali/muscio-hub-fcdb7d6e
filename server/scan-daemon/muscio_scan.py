#!/usr/bin/env python3
"""
3DMuscio Scan-Dienst (läuft auf dem Server "muscio").

Liest den USB-Barcodescanner (Dongle am Server) direkt aus /dev/input, belegt das Gerät exklusiv
(der Server tippt die Scans also nirgends hinein) und meldet jeden gescannten Code per HTTPS an die
Supabase Edge Function "scan-eingang". Diese stempelt bei Stempel-Code ein/aus und reicht alle anderen
Codes an das Admin-Panel weiter.

Konfiguration über Umgebungsvariablen (Datei /etc/muscio-scan.env, nur root lesbar):
  SCAN_URL         https://<projekt>.supabase.co/functions/v1/scan-eingang
  SCAN_API_KEY     Wert des Supabase-Secrets SCAN_API_KEY
  SCANNER_DEVICE   (optional) Pfad, z. B. /dev/input/by-id/usb-...-event-kbd
                   Ohne Angabe wird das erste Gerät gewählt, dessen Name SCANNER_NAME enthält.
  SCANNER_NAME     (optional) Namensteil des Geräts, Standard: "scan"
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

import evdev
from evdev import ecodes

URL = os.environ.get("SCAN_URL", "")
KEY = os.environ.get("SCAN_API_KEY", "")
DEVICE = os.environ.get("SCANNER_DEVICE", "")
NAME = os.environ.get("SCANNER_NAME", "scan").lower()

if not URL or not KEY:
    sys.exit("SCAN_URL und SCAN_API_KEY müssen gesetzt sein (abgebrochen, nichts wird gesendet).")

# US-Layout (Standard bei Barcodescannern im Keyboard-Modus)
PLAIN = {}
SHIFT = {}
for i, ch in enumerate("1234567890"):
    PLAIN[ecodes.KEY_1 + i if ch != "0" else ecodes.KEY_0] = ch
for ch in "abcdefghijklmnopqrstuvwxyz":
    PLAIN[getattr(ecodes, "KEY_" + ch.upper())] = ch
    SHIFT[getattr(ecodes, "KEY_" + ch.upper())] = ch.upper()
for code, (a, b) in {
    ecodes.KEY_MINUS: ("-", "_"), ecodes.KEY_EQUAL: ("=", "+"), ecodes.KEY_SLASH: ("/", "?"),
    ecodes.KEY_DOT: (".", ">"), ecodes.KEY_COMMA: (",", "<"), ecodes.KEY_SEMICOLON: (";", ":"),
    ecodes.KEY_SPACE: (" ", " "), ecodes.KEY_APOSTROPHE: ("'", '"'), ecodes.KEY_BACKSLASH: ("\\", "|"),
    ecodes.KEY_LEFTBRACE: ("[", "{"), ecodes.KEY_RIGHTBRACE: ("]", "}"), ecodes.KEY_GRAVE: ("`", "~"),
}.items():
    PLAIN[code] = a
    SHIFT[code] = b
for i, ch in enumerate("!@#$%^&*()"):
    SHIFT[ecodes.KEY_1 + i if ch != ")" else ecodes.KEY_0] = ch


def log(msg):
    print(msg, flush=True)


def finde_geraet():
    if DEVICE:
        return evdev.InputDevice(DEVICE)
    for path in evdev.list_devices():
        d = evdev.InputDevice(path)
        if NAME in d.name.lower() and ecodes.EV_KEY in d.capabilities():
            return d
    return None


def senden(code):
    req = urllib.request.Request(
        URL,
        data=json.dumps({"code": code}).encode(),
        headers={"Content-Type": "application/json", "x-api-key": KEY},
        method="POST",
    )
    for versuch in range(4):
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                log(f"Scan gesendet ({len(code)} Zeichen): {r.read().decode()[:120]}")
                return True
        except urllib.error.HTTPError as e:
            log(f"Server lehnt ab ({e.code}): {e.read().decode()[:120]}")
            if e.code in (400, 401):
                return False
        except Exception as e:
            log(f"Senden fehlgeschlagen ({e}), neuer Versuch")
        time.sleep(2 * (versuch + 1))
    return False


def lauf():
    dev = finde_geraet()
    if dev is None:
        log("Kein Scanner gefunden, neuer Versuch in 10 s")
        time.sleep(10)
        return
    log(f"Scanner: {dev.name} ({dev.path})")
    dev.grab()
    puffer, shift = [], False
    try:
        for ev in dev.read_loop():
            if ev.type != ecodes.EV_KEY:
                continue
            if ev.code in (ecodes.KEY_LEFTSHIFT, ecodes.KEY_RIGHTSHIFT):
                shift = ev.value != 0
                continue
            if ev.value != 1:
                continue
            if ev.code in (ecodes.KEY_ENTER, ecodes.KEY_KPENTER):
                code = "".join(puffer).strip()
                puffer = []
                if code:
                    senden(code)
            else:
                zeichen = (SHIFT if shift else PLAIN).get(ev.code)
                if zeichen:
                    puffer.append(zeichen)
    finally:
        try:
            dev.ungrab()
        except Exception:
            pass


if __name__ == "__main__":
    while True:
        try:
            lauf()
        except (OSError, FileNotFoundError) as e:
            log(f"Gerät weg ({e}), neuer Versuch in 5 s")
            time.sleep(5)
