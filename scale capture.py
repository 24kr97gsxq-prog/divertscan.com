#!/usr/bin/env python3
"""
DivertScan Scale Capture v2
Reads weight data from AWT 1310 via RS-232, detects stable weights,
buffers locally in SQLite, pushes to Supabase over WiFi/cellular.
"""

import serial
import sqlite3
import hashlib
import json
import time
import logging
import os
import re
import sys
import argparse
import random
import requests
from datetime import datetime, timezone
from threading import Thread

SERIAL_PORT = "/dev/ttyUSB0"
SERIAL_BAUD = 9600
SERIAL_TIMEOUT = 1

SUPABASE_URL = "https://cyvvlngtojagfoaitoog.supabase.co"
SUPABASE_ANON_KEY = "PUT_KEY_HERE"  # real key lives only on the Pi

MIN_WEIGHT_LBS = 2000
CAPTURE_MIN_LBS = 5000  # below this: never capture, and the scale counts as empty (re-arm).
STABLE_READINGS = 5
STABLE_TOLERANCE = 20
RECAPTURE_RISE_LBS = 1000  # Oct 14 2026: locked truck settles this much heavier -> capture again
NEW_TRUCK_DROP_LBS = 5000  # Oct 14 2026: falls this far below the capture -> next truck coming on
SAME_TRUCK_LBS = 200       # Oct 14 2026: after a dip, settling within this of the capture = same truck
SYNC_INTERVAL = 10
RETRY_INTERVAL = 30
MAX_RETRIES = 100
HTTP_TIMEOUT = 15

DEVICE_ID = "dalmex-scale-01"
FACILITY = "Dalmex Recycling"
DB_PATH = "/home/pi/divertscan/scale_data.db"
LOG_PATH = "/home/pi/divertscan/scale_capture.log"

def parse_args():
    parser = argparse.ArgumentParser(description="DivertScan Scale Capture")
    parser.add_argument("--test", action="store_true", help="Test mode")
    parser.add_argument("--gross", type=float, default=48200, help="Test gross lbs")
    parser.add_argument("--tare", type=float, default=16400, help="Test tare lbs")
    parser.add_argument("--delay", type=int, default=10, help="Seconds between gross/tare")
    parser.add_argument("--repeat", action="store_true", help="Repeat test every 60s")
    return parser.parse_args()

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_PATH), logging.StreamHandler()]
)
log = logging.getLogger("scale_capture")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS weight_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            weight_lbs REAL NOT NULL,
            weight_type TEXT DEFAULT 'unknown',
            device_id TEXT NOT NULL,
            facility TEXT NOT NULL,
            sha256_hash TEXT NOT NULL,
            synced INTEGER DEFAULT 0,
            sync_attempts INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()
    log.info("Local database initialized at %s", DB_PATH)

def generate_hash(timestamp, weight_lbs, device_id):
    data = f"{timestamp}|{weight_lbs}|{device_id}|divertscan"
    return hashlib.sha256(data.encode()).hexdigest()

def store_weight(timestamp, weight_lbs, weight_type, sha256_hash):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO weight_readings (timestamp, weight_lbs, weight_type,
                                     device_id, facility, sha256_hash)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (timestamp, weight_lbs, weight_type, DEVICE_ID, FACILITY, sha256_hash))
    conn.commit()
    conn.close()
    log.info("STORED locally: %.0f lbs (%s) hash=%s...", weight_lbs, weight_type, sha256_hash[:16])

def parse_awt_weight(line):
    line = line.strip()
    if not line:
        return None
    # Strip STX/ETX control chars if present
    line = line.replace('\x02', '').replace('\x03', '')
    line_upper = line.upper()
    # Stable unless the indicator signals motion ('M' / 'MOT')
    is_stable = ('M' not in line_upper) and ('MOT' not in line_upper)
    # Weight type by whole word (AWT prints Gross/Tare/Net)
    weight_type = "unknown"
    if "GROSS" in line_upper:
        weight_type = "gross"
    elif "TARE" in line_upper:
        weight_type = "tare"
    elif "NET" in line_upper:
        weight_type = "net"
    # Extract the numeric weight
    match = re.search(r'([\d,]+\.?\d*)\s*(?:lb|LB)', line)
    if not match:
        match = re.match(r'^\s*([\d,]+\.?\d*)\s*$', line)
    if not match:
        return None
    try:
        weight = float(match.group(1).replace(',', ''))
    except ValueError:
        return None
    if weight < 0 or weight > 200000:
        return None
    # Defensive: flag any weighable line we could not classify
    if weight_type == "unknown" and weight >= MIN_WEIGHT_LBS:
        log.info("UNCLASSIFIED weight line (type=unknown): %r", line)
    return (weight, is_stable, weight_type)

class StabilityDetector:
    """One capture per weighing event.
    Captures once when the weight settles, then LOCKS until the scale
    returns to empty (truck drives off). A parked truck cannot re-trigger.
    Oct 14 2026 - two exceptions while locked:
      * pulled forward: settles RECAPTURE_RISE_LBS+ heavier -> capture again (88281)
      * back-to-back: weight falls NEW_TRUCK_DROP_LBS+ below the capture, then
        settles at a different weight -> capture the new truck (88284)
    """
    def __init__(self):
        self.readings = []
        self.locked = False
        self.captured_weight = 0
        self.dipped = False
        self.last_state = "empty"

    def add_reading(self, weight_lbs, is_stable):
        # Scale empty / truck gone -> re-arm for the next weighing
        if weight_lbs < CAPTURE_MIN_LBS:  # Oct 1 2026: re-arm below 5,000 (empty scale drifted to 3,040)
            self.readings = []
            self.locked = False
            self.captured_weight = 0
            self.dipped = False
            self.last_state = "empty"
            return None
        if self.locked and weight_lbs <= self.captured_weight - NEW_TRUCK_DROP_LBS:
            self.dipped = True
        # Accumulate rolling window (also while locked, to spot the two exceptions)
        self.readings.append(weight_lbs)
        if len(self.readings) > STABLE_READINGS:
            self.readings = self.readings[-STABLE_READINGS:]
        n = len(self.readings)
        avg = sum(self.readings) / n
        settled = (n >= STABLE_READINGS and is_stable and
                   all(abs(r - avg) <= STABLE_TOLERANCE for r in self.readings))
        if self.locked:
            if settled:
                new_w = round(avg / 10) * 10
                if new_w >= self.captured_weight + RECAPTURE_RISE_LBS:
                    why = "pulled forward"
                elif self.dipped and abs(new_w - self.captured_weight) > SAME_TRUCK_LBS:
                    why = "next truck"
                else:
                    why = None
                if why:
                    self.captured_weight = new_w
                    self.dipped = False
                    self.readings = []
                    self.last_state = "captured %.0f lbs (%s)" % (new_w, why)
                    return new_w
            self.last_state = "locked, next truck coming on" if self.dipped else "locked"
            return None
        if n < STABLE_READINGS:
            self.last_state = "settling %d/%d @ %.0f lbs" % (n, STABLE_READINGS, weight_lbs)
            return None
        # Settled = full window agrees within tolerance AND scale reports stable
        if settled:
            stable_weight = round(avg / 10) * 10
            self.locked = True
            self.captured_weight = stable_weight
            self.dipped = False
            self.readings = []
            self.last_state = "captured %.0f lbs" % stable_weight
            return stable_weight
        # Full window but not yet agreeing (still moving / jittering)
        spread = max(self.readings) - min(self.readings)
        self.last_state = "settling %d/%d spread=%.0f (need <=%d)" % (
            n, STABLE_READINGS, spread, STABLE_TOLERANCE)
        return None


def sync_to_supabase():
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    while True:
        try:
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("""
                SELECT id, timestamp, weight_lbs, weight_type, device_id,
                       facility, sha256_hash
                FROM weight_readings
                WHERE synced = 0 AND sync_attempts < ?
                ORDER BY id ASC LIMIT 10
            """, (MAX_RETRIES,))
            rows = c.fetchall()
            conn.close()
            for row in rows:
                reading_id, ts, weight, wtype, dev, fac, sha = row
                payload = {
                    "captured_at": ts,
                    "weight_lbs": weight,
                    "weight_type": wtype,
                    "device_id": dev,
                    "facility": fac,
                    "sha256_hash": sha,
                    "status": "pending"
                }
                try:
                    resp = requests.post(
                        f"{SUPABASE_URL}/rest/v1/scale_weights",
                        headers=headers, json=payload, timeout=HTTP_TIMEOUT
                    )
                    conn = sqlite3.connect(DB_PATH)
                    c = conn.cursor()
                    if resp.status_code in (200, 201):
                        c.execute("UPDATE weight_readings SET synced = 1 WHERE id = ?", (reading_id,))
                        log.info("SYNCED: reading %d -> Supabase (HTTP %d)", reading_id, resp.status_code)
                    else:
                        c.execute("UPDATE weight_readings SET sync_attempts = sync_attempts + 1 WHERE id = ?", (reading_id,))
                        log.warning("SYNC FAILED: reading %d -> HTTP %d: %s", reading_id, resp.status_code, resp.text[:200])
                    conn.commit()
                    conn.close()
                except requests.exceptions.Timeout:
                    log.warning("SYNC TIMEOUT: reading %d (will retry)", reading_id)
                    _increment_attempts(reading_id)
                except requests.exceptions.ConnectionError:
                    log.warning("NO CONNECTION: will retry all")
                    time.sleep(RETRY_INTERVAL)
                    break
                except Exception as e:
                    log.error("SYNC ERROR: reading %d -> %s", reading_id, str(e))
                    _increment_attempts(reading_id)
                time.sleep(0.5)
        except Exception as e:
            log.error("Sync thread error: %s", str(e))
            time.sleep(RETRY_INTERVAL)
        time.sleep(SYNC_INTERVAL)

def _increment_attempts(reading_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("UPDATE weight_readings SET sync_attempts = sync_attempts + 1 WHERE id = ?", (reading_id,))
        conn.commit()
        conn.close()
    except Exception:
        pass

def print_status():
    while True:
        try:
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("SELECT COUNT(*) FROM weight_readings")
            total = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM weight_readings WHERE synced = 1")
            synced = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM weight_readings WHERE synced = 0")
            pending = c.fetchone()[0]
            c.execute("SELECT weight_lbs, timestamp FROM weight_readings ORDER BY id DESC LIMIT 1")
            last = c.fetchone()
            conn.close()
            log.info("STATUS: total=%d synced=%d pending=%d last=%s",
                     total, synced, pending,
                     f"{last[0]} lbs at {last[1]}" if last else "none")
        except Exception as e:
            log.error("Status error: %s", str(e))
        time.sleep(60)

def run_test_mode(args):
    log.info("=" * 60)
    log.info("DivertScan Scale Capture - TEST MODE")
    log.info("Device: %s | Facility: %s", DEVICE_ID, FACILITY)
    log.info("Gross: %.0f lbs | Tare: %.0f lbs", args.gross, args.tare)
    log.info("=" * 60)
    init_db()
    sync_thread = Thread(target=sync_to_supabase, daemon=True)
    sync_thread.start()
    status_thread = Thread(target=print_status, daemon=True)
    status_thread.start()
    while True:
        gross = round((args.gross + random.uniform(-10, 10)) / 10) * 10
        timestamp = datetime.now(timezone.utc).isoformat()
        sha_hash = generate_hash(timestamp, gross, DEVICE_ID)
        log.info("TEST - GROSS CAPTURED: %.0f lbs", gross)
        store_weight(timestamp, gross, "gross", sha_hash)
        log.info("TEST - Waiting %d seconds for tare...", args.delay)
        time.sleep(args.delay)
        tare = round((args.tare + random.uniform(-10, 10)) / 10) * 10
        timestamp = datetime.now(timezone.utc).isoformat()
        sha_hash = generate_hash(timestamp, tare, DEVICE_ID)
        log.info("TEST - TARE CAPTURED: %.0f lbs", tare)
        store_weight(timestamp, tare, "tare", sha_hash)
        net = gross - tare
        log.info("TEST - NET: %.0f lbs (%.2f tons)", net, net / 2000)
        if not args.repeat:
            log.info("TEST complete. Check driver-confirm.html on your phone.")
            log.info("Press Ctrl+C to stop.")
            while True:
                time.sleep(10)
        else:
            log.info("TEST - Repeating in 60 seconds...")
            time.sleep(60)

def run_live_mode():
    log.info("=" * 60)
    log.info("DivertScan Scale Capture - LIVE MODE")
    log.info("Device: %s | Serial: %s @ %d", DEVICE_ID, SERIAL_PORT, SERIAL_BAUD)
    log.info("=" * 60)
    init_db()
    sync_thread = Thread(target=sync_to_supabase, daemon=True)
    sync_thread.start()
    status_thread = Thread(target=print_status, daemon=True)
    status_thread.start()
    detector = StabilityDetector()
    prev_state = None
    ser = None
    consecutive_errors = 0
    while True:
        try:
            if ser is None:
                log.info("Opening serial port %s...", SERIAL_PORT)
                ser = serial.Serial(
                    port=SERIAL_PORT, baudrate=SERIAL_BAUD,
                    bytesize=serial.EIGHTBITS, parity=serial.PARITY_NONE,
                    stopbits=serial.STOPBITS_ONE, timeout=SERIAL_TIMEOUT
                )
                log.info("Serial port open. Listening for weight data...")
            raw = ser.readline()
            if not raw:
                continue
            try:
                line = raw.decode('ascii', errors='ignore').strip()
            except Exception:
                continue
            if not line:
                continue
            consecutive_errors = 0
            result = parse_awt_weight(line)
            if result is None:
                continue
            weight_lbs, is_stable, weight_type = result
            stable_weight = detector.add_reading(weight_lbs, is_stable)
            if detector.last_state != prev_state:
                log.info("SCALE: %s", detector.last_state)
                prev_state = detector.last_state
            if stable_weight is not None:
                timestamp = datetime.now(timezone.utc).isoformat()
                sha256_hash = generate_hash(timestamp, stable_weight, DEVICE_ID)
                log.info("CAPTURED: %.0f lbs (%s)", stable_weight, weight_type)
                store_weight(timestamp, stable_weight, weight_type, sha256_hash)
        except serial.SerialException as e:
            consecutive_errors += 1
            log.error("Serial error: %s (attempt %d)", str(e), consecutive_errors)
            if consecutive_errors > 10:
                log.critical("Too many serial errors - resetting port")
                try:
                    ser.close()
                except Exception:
                    pass
                ser = None
                time.sleep(5)
        except KeyboardInterrupt:
            log.info("Shutting down...")
            if ser:
                ser.close()
            break
        except Exception as e:
            log.error("Unexpected error: %s", str(e))
            time.sleep(1)
    log.info("DivertScan Scale Capture stopped")

if __name__ == "__main__":
    args = parse_args()
    if args.test:
        try:
            run_test_mode(args)
        except KeyboardInterrupt:
            log.info("Test mode stopped")
    else:
        run_live_mode()
