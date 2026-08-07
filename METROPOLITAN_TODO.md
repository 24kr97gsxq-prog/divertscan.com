# METROPOLITAN RECYCLING — PROJECT TO-DO

**Last updated: Thursday, August 6, 2026.**
Update the date whenever you change something.

**What this is:** the second DivertScan site. Product destruction and recycling
facility at 4141 Singleton Blvd, Dallas TX. Separate instance from DalMex —
own repo, own Supabase project, own capture node. DalMex production is never
touched by anything on this list.

**The DalMex list is a different file:** `DivertScan_TODO.md`.

---

**Architecture decision: separate instance, NOT multi-tenant.** Own repo, own
Supabase project, own capture node. DalMex production is never touched. RLS
work, shared-database blast radius, and two months of scoping all avoided.
Revisit multi-tenancy only at 4–5 sites Robert actually controls.

**Site facts — CONFIRMED ON SITE Aug 6:**
- Indicator: **Avery Weigh-Tronix ZM305-SG1**, serial 14435020, NTEP CC 11-096,
  Class III/IIIL, n max 10,000. Board AWT25-500953 (2014). 110–240 VAC, 0.5 A.
  Rated −10°C to +40°C (104°F) — mind that when siting the capture box.
- **UNSEALED.** User menu → SEAL reads "no seal". Configuration is open, no
  scale technician needed to change port settings. ⚠️ But this also means the
  scale is likely NOT currently certified for commercial use — raise with Mark,
  it affects him independent of anything we build.
- **Master indicator is in the OFFICE.** The display the driver sees outside is
  a slave. We connect to the office unit.
- **RJ45 Ethernet jack on the board is EMPTY.** USB port empty too.
- **TB3 is completely EMPTY — both serial ports free.** Silkscreen reads:
  1 GND, 2 UIN−, 3 UIN+, 4 TX1, 5 RX1, 6 TX2, 7 RX2. Nothing feeds the outside
  display from TB3, so nothing can be broken by using TX1.
- Load cell is on TB1/TB2 (EXC±, SEN±, SIG±, SHLD) — **do not touch**.
- Menu navigation: long-press SETUP, passcode **111** = user level (date, time,
  seal only), **1793** = supervisor. **SELECT is ENTER, not ZERO.** IN/OUT is
  escape. Keypad membrane is worn — UNITS was unresponsive. Do not grind on the
  menu; the laptop sniff answers everything faster.
- Address: **4141 Singleton Blvd, Dallas, TX 75212**, (972) 773-9132,
  metropolitanrecycling.com. Google lists them as "Metropolitan Services" —
  ⚠️ confirm the legal entity name before it goes on a certificate.
- Layout: office sits at the south end of the scale; network drop lands near
  both the laptop and the indicator. Short cable runs, all indoors.

**Business facts:**
- Product destruction is the real business, not diversion. Certificate of
  Destruction is the valuable artifact. Photos on their Google listing show
  branded footwear and rugs — ask what else crosses that scale.
- Mills: Georgia-Pacific mostly. **GP sends their own truck and trailer, live
  load.** So outbound tares are always Measured, never Estimated.
- **One release number per load**, issued by the mill. Price per ton already
  negotiated on the contract — so outbound loads have a computable value and
  the BOL can carry it.
- Drivers are mostly **contracted, different every time**. Do not build around
  driver identity — build around the load.
- Currently Non-LEED but may take LEED work later. LEED stays a PROJECT-level
  flag. Do NOT add a site-level LEED switch.

**Aug 6 status:**
- Demo shown to Mark, Greg and Haniya. All positive.
- Parts list emailed: Epson TM-T20IV (C31CL47022, Ethernet version), thermal
  paper, TP-Link TL-SG105 switch, UPS, Cat6, power strip. ~$455, Mark buys.
- Mark providing a laptop; his guy running the Cat6 drop.
- Do NOT send the updated demo until their requested changes are in — "here's
  what you asked for" lands better than "here's what you already saw."

**MEETING FEEDBACK — Aug 6**

⚠️ **CORRECT THE INTERNET-OUTAGE ANSWER IN WRITING.** Robert told them "we'd do
it the manual way." That undersells it and is not quite right. The accurate
answer, and it needs a design change to be true:
- Capture never stops — laptop reads the indicator over the LAN, writes to a
  local DB, buffers, syncs when the connection returns. Nothing lost.
- Printing keeps working — printer is on the same switch, not the internet.
- Driver's phone keeps working — it runs on his own cellular.
- **BUT the office screen currently would NOT work.** As built for DalMex, the
  browser talks to Supabase in the cloud. No internet = no office screen = no
  way to assign a job or confirm a ticket.
- **FIX: make the capture box serve the app locally.** Office browser points at
  the laptop's LAN IP, not the internet. Laptop syncs to Supabase in the
  background. Cloud becomes backup + remote access, not a dependency.
- This is a real architectural change and more work than the DalMex build, but
  it is the right answer for a scale house and a much better story than
  "we'd go manual." Frame it as a strength.

**What they said:**
- ✅ Fine with drivers self-scanning after hours. Confirmed drivers will be
  different contract drivers each time — build around the LOAD, not the driver.
- ✅ They like print-on-demand.
- ⚠️ **Concerned some drivers will struggle with the self-serve option.** Most
  useful thing they said. Mitigations: Spanish on the QR sign and the driver
  page; fewest possible taps; never an account or login; office fallback always
  available so a driver who can't or won't use it is never stuck; put a phone
  number on the QR sign.
- **Future: printer outside, other side of the wall from the indicator**, for
  after-hours ticket pickup. ⚠️ A thermal printer is not weatherproof and
  thermal paper fades fast in Texas sun. Better: keep the printer inside and cut
  a pass-through slot or chute through the wall, like a bank drawer. No
  electronics outdoors, nothing to vandalize.
- **Accounting software — NOT QuickBooks.** Find out what it is. Almost
  everything exports CSV; if it doesn't, its import format tells us what to
  produce. Same question covers importing their existing data.
- [ ] Ask what accounting package they run.
- [ ] Ask whether they have existing data to import, and in what format.


**Docs / where things live:**
- Master template: `docs/Node_Hardening_Spec_v1.md` in the DivertScan repo.
  Stays generic — no site IPs in the master.
- Filled-in copy per site: `docs/SITE_RECORD_metropolitan.md` in THEIR repo.
- `capture_node.py` — site-agnostic v3. TCP or serial via `SOURCE_MODE`, all
  per-site values in one CONFIG block, plus `--sniff` and `--test` modes.
- Demo lives in its own GitHub repo → Pages. Must be `index.html`, lowercase.

**Ordered next steps:**
- [ ] **Decide the local-first architecture.** Biggest open technical question.
      Office screen must keep working with the ISP down. Options: serve the app
      from the capture box over the LAN with background sync to Supabase, or a
      service-worker/offline-cache approach. This affects the whole build, so
      settle it before forking anything.
- [ ] **Email Mark the corrected outage answer.** Do not leave "we'd go manual"
      standing — it is both wrong and weaker than the truth.
- [ ] **Get ownership of DivertScan in writing** with DalMex while the
      relationship is good.
- [ ] **`--sniff` on visit two.** Bring a laptop with Python + `requests`, a
      Cat6 patch cable, a USB-to-RS232 adapter with bare leads (FTDI chipset,
      RS-232 level not TTL), a 2mm flathead, an RJ45 crimper and spare ends.
      Try Ethernet first — the RJ45 is empty and needs no screwdriver. Fall
      back to TB3: GND→pin 1, adapter RX→pin 4 (TX1). Power down before wiring.
- [ ] Confirm the laptop: make, age, OS. Windows 10 = decline or install Linux.
- [ ] New Supabase project (same account — a new ACCOUNT is not needed; free
      tier allows 2 active projects per org).
- [ ] Fork the repo, swap the config block, strip DalMex branding.
- [ ] Seed haulers into `approved_haulers` (never hard-coded), materials,
      clients, work orders, mill contracts with per-ton rates.
- [ ] Deploy to Cloudflare Pages — GitHub Pages allows one custom domain per
      repo. Branded URL needs their DNS.
- [ ] Move the Supabase org to Pro ($25/mo + $10 per extra project) BEFORE it
      is a paid production system — free tier has no backups.
- [ ] Scope and payment terms in writing before this becomes production.

**Still unanswered — Mark's call, not build decisions:**
- [ ] Legal entity name: Metropolitan Services or Metropolitan Recycling?
- [ ] How is destruction work priced — per ton, per load, or per job? If per
      ton, the certificate can carry a value like the BOL does.
- [ ] What happens if a trailer arrives before the mill's release number does?
      A hard block on a trailer already on site will get worked around.
- [ ] Partial receipts — can half a load go into one destruction run and half
      into the next? Currently all-or-nothing.
- [ ] Does GP ever short-pay against their own mill scale weight? If so, a
      weight-discrepancy report pays for itself the first time it happens.

**Demo design decisions already settled (do not relitigate):**
- Weight is captured and sealed BEFORE anyone identifies it. Never match an
  outbound weight by weight or by timing — a person or a scan decides.
- Receiving and destruction are SEPARATE events. Driver leaves with a weight
  ticket, not a certificate. Certificate issues at destruction.
- One certificate per destruction RUN, covering the receipts in that run, with
  a work-order coverage line saying whether the job is complete.
- Certificates are never edited — void and reissue, both preserved, and a
  voided number still verifies as "superseded by X".
- Driver copy of the BOL carries NO pricing. Office file copy does.
- Ticket always generates; print vs phone is only a delivery choice.
- SHA-256 integrity is a quiet backend feature, NOT the headline. The industry
  credibility currency is NAID AAA certification — worth raising with Mark as
  a growth path, since ~75% of certified members say it opened doors.
- Certificate must carry: facility ID block with address and registrations,
  work order AND invoice number, method, lot/batch codes, witness, days in
  custody, applicable-standards reference (FDA voluntary product destruction,
  EPA disposition), and a six-year retention line.
- ⚠️ Attestation and standards wording is PLAUSIBLE, NOT VETTED. Metropolitan's
  attorney reviews it before it goes on a real client document. Say this out
  loud — it is a credibility move, not a weakness.
- Driver self-serve must NEVER be required. Contract drivers change weekly,
  phones and languages vary. The office fallback always works, and a driver who
  does nothing at all still gets weighed and ticketed.
- Build around the LOAD, not the driver. No accounts, no logins, nothing to
  install, ever.

**Pricing — Robert quoted ~$200/month to Mark. Do not walk it back.**
Market for comparison: ScrapRight publishes $698/mo (Buy Side + Compliance) and
$1,998/mo (enterprise) with an $8,500 startup fee; their lite version starts at
$49/mo. ReSpark (ReMatter + GreenSpark) prices per location per month. So $200
is well under market — frame it as a starting price for one site that does NOT
include the destruction certificate module, and that goes up per location.
Telling Mark what ScrapRight charges reframes $200 from "cheap" to "a favor".
Hard costs are ~$35/mo Supabase for both sites + hosting (free).
⚠️ The bigger money is the commission/hire conversation, not the licence. If
they hire Robert, keep the licence and the employment agreement as TWO separate
documents, and get an IP carve-out naming DivertScan as pre-existing BEFORE
signing anything. Worth an employment lawyer for an hour.

**After-hours driver access:** already built — `drivers` table + `driver_token`
+ `driver.html?t=` loadbook + `welcome.html` onboarding (the Jaguar flow).
⚠️ But note: with the office-alert design, unattended weighing means a load with
no job attached cannot produce a certificate. Policy question for Mark.

**Prep work needed in the DalMex codebase before forking** — that work lives on
the DalMex list (`DivertScan_TODO.md`, under Metropolitan — Separate File),
because the edits happen in DalMex's repo through the normal branch-and-PR path.
