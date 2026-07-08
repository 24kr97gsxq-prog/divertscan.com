#!/usr/bin/env python3
"""
DivertScan Pi Health Reporter
==============================
Standalone. Does NOT touch scale_capture.py or the serial port — if this
script dies, truck capture is unaffected.

Reads CPU temp, throttle state, under-voltage, disk, memory, uptime, and
the default-route interface, then POSTs one row to Supabase pi_health.
Run every 5 minutes by pi-health.timer (systemd). Fire-and-forget: any
failure just means one missing data point.

Install:
  1. Fill in SUPABASE_URL and SUPABASE_ANON_KEY below (copy the same
     values scale_capture.py uses — do NOT commit the key to GitHub;
     keep the repo copy with the placeholder).
  2. Save as /home/pi/pi_health.py
  3. chmod +x /home/pi/pi_health.py
  4. Test once:  python3 /home/pi/pi_health.py   (should print "OK ...")
  5. Install the .service and .timer files, then:
       sudo systemctl daemon-reload
       sudo systemctl enable --now pi-health.timer
"""

import json
import subprocess
import time
import urllib.request

# ---- FILL THESE IN ON THE PI (same values as scale_capture.py) ----
SUPABASE_URL = "YOUR_SUPABASE_URL"          # e.g. https://xxxx.supabase.co
SUPABASE_ANON_KEY = "YOUR_ANON_KEY"
# -------------------------------------------------------------------

TIMEOUT = 15  # seconds; cellular can be slow


def read_temp_c():
    with open("/sys/class/thermal/thermal_zone0/temp") as f:
        return round(int(f.read().strip()) / 1000.0, 1)


def read_throttled():
    """Returns (currently_throttled, under_voltage_now, raw_hex).
    vcgencmd get_throttled bit meanings:
      bit 0 = under-voltage now, bit 1 = ARM freq capped now,
      bit 2 = currently throttled, bit 3 = soft temp limit active.
    Higher bits are 'has occurred since boot' history."""
    try:
        out = subprocess.check_output(
            ["vcgencmd", "get_throttled"], timeout=5
        ).decode().strip()  # "throttled=0x0"
        raw = out.split("=")[1]
        val = int(raw, 16)
        return bool(val & 0x4 or val & 0x8), bool(val & 0x1), raw
    except Exception:
        return False, False, None


def read_disk_used_pct():
    import shutil
    du = shutil.disk_usage("/")
    return round(du.used / du.total * 100, 1)


def read_mem_used_pct():
    info = {}
    with open("/proc/meminfo") as f:
        for line in f:
            parts = line.split(":")
            if len(parts) == 2:
                info[parts[0]] = int(parts[1].strip().split()[0])
    total = info.get("MemTotal", 0)
    avail = info.get("MemAvailable", 0)
    if not total:
        return None
    return round((total - avail) / total * 100, 1)


def read_uptime_hours():
    with open("/proc/uptime") as f:
        return round(float(f.read().split()[0]) / 3600.0, 1)


def read_default_iface():
    """Which interface carries the default route (usb0 = cellular modem)."""
    try:
        out = subprocess.check_output(
            ["ip", "route", "show", "default"], timeout=5
        ).decode()
        # "default via 192.168.x.x dev usb0 ..."
        toks = out.split()
        return toks[toks.index("dev") + 1] if "dev" in toks else None
    except Exception:
        return None


def post_row(row):
    req = urllib.request.Request(
        SUPABASE_URL + "/rest/v1/pi_health",
        data=json.dumps(row).encode(),
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="POST",
    )
    urllib.request.urlopen(req, timeout=TIMEOUT)


def cleanup_old():
    """Delete rows older than 30 days (RLS only permits exactly this).
    Runs ~once/day: only in the 03:00–03:04 window, i.e. one timer tick."""
    t = time.localtime()
    if not (t.tm_hour == 3 and t.tm_min < 5):
        return
    req = urllib.request.Request(
        SUPABASE_URL + "/rest/v1/pi_health"
        "?captured_at=lt." + time.strftime(
            "%Y-%m-%dT%H:%M:%S",
            time.gmtime(time.time() - 30 * 86400)),
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        },
        method="DELETE",
    )
    try:
        urllib.request.urlopen(req, timeout=TIMEOUT)
    except Exception:
        pass  # cleanup is best-effort


def main():
    temp_c = read_temp_c()
    throttled, under_volt, raw = read_throttled()
    row = {
        "temp_c": temp_c,
        "temp_f": round(temp_c * 9 / 5 + 32, 1),
        "throttled": throttled,
        "under_voltage": under_volt,
        "throttle_flags": raw,
        "disk_used_pct": read_disk_used_pct(),
        "mem_used_pct": read_mem_used_pct(),
        "uptime_hours": read_uptime_hours(),
        "wifi_or_cell": read_default_iface(),
    }
    post_row(row)
    cleanup_old()
    print("OK", row["temp_f"], "F", "throttled" if throttled else "")


if __name__ == "__main__":
    main()
