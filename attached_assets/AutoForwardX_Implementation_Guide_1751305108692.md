
# 🛠️ AutoForwardX Implementation Guide: Completing Missing Functions & Adding Telegram Copier Module

This guide helps you complete critical missing features and integrate a new **Telegram Message Copier Module** that supports:
- Telegram → Telegram copying
- Multi-user, multi-session support
- Full message formatting preservation
- Trap detection, image blocking
- Pause/resume pairs per user

---

## 📌 PART 1: Completing Existing Missing Features

### ✅ 1. Telethon Session Loader via Web UI
**Goal**: Let users login with their Telegram number and OTP via Web UI

#### Steps:
- Add API: `POST /api/sessions`
  - Accept phone number
  - Spawn subprocess: `telethon_loader.py --phone +91xxxx`
- Add API: `POST /api/sessions/:id/verify-otp`
  - Accept OTP
  - Complete login with Telethon and save `.session` file
- Save session metadata in `sessions.json`
- Secure with rate limit + OTP expiry timer

---

### ✅ 2. Live Python Process Management
**Goal**: Start/stop `userbot.py`, `poster.py`, and `discord_bot.py` from UI

#### Steps:
- Backend:
  - Add `start_process(name)`, `stop_process(name)`
  - Use `subprocess.Popen` or `multiprocessing`
  - Track PID/logs
- API Routes:
  - `POST /api/start/:bot`
  - `POST /api/stop/:bot`
- Web UI:
  - Add toggle buttons for each bot

---

### ✅ 3. Edit/Delete Sync Support
**Goal**: When a message is edited/deleted in Discord/TG, sync across

#### Steps:
- Store original ↔ copied message ID in `message_map.json`
- Implement `on_message_edit` and `on_message_delete` handlers
- For each pair:
  - Telegram → Discord → back → edit in destination
  - Discord → edit → Telegram edit

---

### ✅ 4. Real Trap Detection
**Goal**: Block messages with known traps (text/image/edit bait)

#### Trap Types:
- **Text**: "trap", "/ *", "leak" etc.
- **Image**: Match MD5/SHA256 hash
- **Edit Trap**: If a message is edited 3+ times

#### Code Integration:
- Use `hashlib` for image hashes
- Track edit count per message
- Block via centralized `trap_detector.py`

---

### ✅ 5. Telegram Admin Bot Enhancements
**Goal**: Full inline admin control

#### New Inline Buttons:
- [🖼 Block Image]: Hashes image and adds to blocklist
- [⏸ Pause All] / [▶ Resume All]: Toggles all pairs
- [📋 Show Blocklist]: Sends full list
- [➕ Add Word]: Add a word to blocklist manually

---

## 📌 PART 2: Telegram → Telegram Copier Module (Multi-User)

### 📂 New File: `telegram_copier/copier_multi_session.py`

#### Features:
- Supports multiple `.session` files
- Supports multiple users with independent pairs
- Reads from `user_copies.json`

---

### 🧾 Example: `user_copies.json`

```json
{
  "users": [
    {
      "user_id": "sunil",
      "session_file": "sunil_1.session",
      "pairs": [
        {
          "source": "@vip_signals_1",
          "destination": "@sunil_copy_1"
        }
      ]
    },
    {
      "user_id": "trader_joe",
      "session_file": "joe_1.session",
      "pairs": [
        {
          "source": "@premium_fx",
          "destination": "@copy_fxjoe"
        }
      ]
    }
  ]
}
```

---

### 🧠 Logic Flow:
1. Load all users and their `.session` files
2. For each session:
   - Monitor source channels with `@client.on(events.NewMessage)`
   - Check message against trap rules
   - If clean, forward to destination
3. Track original ↔ copied message ID for edits
4. Admin Bot can block images and pause per user

---

### 📋 Multi-User Controls in Web UI:
- Add user
- Upload session
- Assign pairs
- Pause/resume specific user
- View logs for specific user

---

### 🛡 Blocked Image Logic:
- On receiving image, hash file with MD5
- Compare against `blocklist.json`
- If matched: do not forward
- Admin can add new image to blocklist via Telegram bot

---

## ✅ Final Checklist for Completion

| Task | Status |
|------|--------|
| Telethon OTP login via Web UI | 🔧 In progress |
| Bot start/stop via API | 🔧 Needed |
| Discord/TG edit sync | 🔧 Needed |
| Full-format message forwarding | 🔧 Needed |
| Trap detection core module | ✅ Exists, needs hook |
| Admin bot inline upgrades | 🔧 To build |
| Telegram copier module | ✅ New, build next |
| Multi-user config UI | 🔧 Needed |
| Logging & error alerts | 🔧 Needed |

---

## ✅ Suggested Order of Implementation

1. 🔐 Session Loader via UI + OTP
2. 🧠 Trap Detection Core Finalization
3. 🔁 Copier Module (Telegram → Telegram)
4. 📤 Poster edit/delete sync
5. 🧑‍💻 Admin Bot upgrades
6. ⚙️ Process Control APIs
7. 🧪 Final end-to-end testing

---

## 📦 Tech Stack Summary

- Telethon (reader & copier)
- Pyrogram (poster)
- FastAPI + Tailwind + HTMX (UI)
- discord.py (edit handling)
- SQLite + JSON (state + config)
- WebSocket (optional real-time trap logs)

---

Now you're ready to complete AutoForwardX with secure multi-user TG copying and full trap-aware infrastructure.
