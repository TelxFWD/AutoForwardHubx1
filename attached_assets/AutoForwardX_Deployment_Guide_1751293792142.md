# 📦 AutoForwardX: Full Deployment & Feature Guide

> A complete solution for **secure**, **adaptive**, and **hard-to-trace** message replication from **Telegram → Discord → Telegram**, with AI moderation, admin dashboard, session control, and in-message trap resistance.

---

## 🚀 Overview

AutoForwardX allows you to:
- Read from **Telegram private channels** using a Userbot
- Post to **Discord** using Webhooks (one per signal channel)
- Filter & rewrite messages via AI + trap detection
- Repost back to **Telegram channels** using multiple Telegram Bots
- Control every pair, trap filter, and session from a Web UI
- Get **admin notifications + inline button controls via Telegram Bot**

---

## 📁 Project Structure

```
/AutoForwardX
├── ui/                         ← Web Dashboard (HTML + Tailwind + HTMX)
├── configs/
│   ├── pairs.json              ← Telegram ↔ Discord ↔ Telegram routing
│   ├── blocklist.json          ← Blocked words / hashes (global & per-pair)
│   ├── sessions.json           ← All userbot sessions metadata
├── telegram_reader/
│   └── multi_session.py        ← Telethon-based reader (1+ sessions)
├── discord/
│   ├── bot.py                  ← Discord Bot: Edit/Delete/Trap/AI/Pause
│   └── webhook_manager.py      ← Registers/updates webhooks per channel
├── telegram_poster/
│   └── poster.py               ← Pyrogram-based poster (multi-bot support)
├── tg_admin_bot/
│   └── admin_bot.py            ← Admin Telegram Bot (with inline buttons)
├── db/
│   └── message_map.json        ← Discord ↔ Telegram message map
```

---

## 🧠 Core Features (A–Z)

### ✅ A. Adaptive Pair Routing
Define multiple signal pairs. Each has its own:
- Telegram Source Channel (private)
- Discord Webhook
- Telegram Destination Channel
- Telegram Bot Token
- Telethon Session
Fully manageable via UI.

### ✅ B. Bot Management (Telegram)
- Use multiple Telegram bot tokens (each posting to different channels)
- All tokens are mapped in `pairs.json`

### ✅ C. Control Panel (Web UI)
- Pause/Resume All Pairs
- View global system status
- Auto-pause on trap detection

### ✅ D. Discord Webhook Management
- One webhook per Discord channel
- Managed from Web UI or `webhook_manager.py`
- Used to post from Telegram → Discord and keep message mapping

### ✅ E. Editable Blocklists (Web UI)
- Manage blocked content:
  - Blocked Text
  - Blocked Image Hashes
  - Trap Words
- Per-pair or global

### ✅ F. Filtering Traps & Bait
- Block messages with traps like `/ *`, `1`, etc.
- OCR + hash + size filters for images
- Optional GPT/AI integration for text rewriting or validation

### ✅ G. Global & Pair-Based Pausing
- Manually or automatically pause pairs
- Auto-resume after cooldown
- Set trap thresholds per pair

### ✅ H. Hash-Based Image Filtering
- Detect repeated bait images by MD5/SHA
- Prevent repost if hash matches blocklist

### ✅ I. Inline Telegram Admin Buttons
- Pause/Resume a pair from Telegram
- View & edit trap/block lists
- Toggle pairs live
- Example buttons:
  - [⏸ Pause GBPUSD]
  - [▶ Resume XAUUSD]
  - [📋 Show Blocklist]

### ✅ J. JSON Configs
- All pairs, tokens, sessions, and blocklists are JSON-based
- UI writes to and reads from configs
- Easy for import/export and syncing

### ✅ K. Keep Sessions Secure
- Each session is stored separately
- One account can run multiple `.session` files
- Can isolate sessions per signal pair

### ✅ L. Live Trap Monitoring (Planned)
- Real-time logs and alerts for blocked messages and trap detection
- WebSocket-based live viewer

---

## 📡 Discord Bot Responsibilities

- Run alongside webhooks to:
  - Edit messages (webhooks can't)
  - Delete baited/edited posts
  - Detect trap pattern edits in Discord
  - Forward to Telegram (2nd stage)

- Uses `discord.py` and runs persistently
- Maintains message mapping in `message_map.json`
- Notifies Admin Bot if:
  - Traps are detected
  - Messages are flagged
  - A message was edited multiple times

---

## 🔑 Session Management & Setup

### ✅ Add Telegram Sessions (Telethon)

1. Run the session loader:
```bash
python3 telegram_reader/session_loader.py
```

2. Enter Telegram phone number (e.g., `+91xxxxxxxxxx`)

3. You’ll receive OTP from Telegram → enter it.

4. It creates `session_name.session` file in the directory.

5. Add session metadata to `sessions.json`:
```json
{
  "gold_session_1": {
    "phone": "+91xxxxxxxx",
    "session_file": "gold_session_1.session",
    "status": "active"
  }
}
```

---

### ✅ Example Pair Entry in `pairs.json`

```json
{
  "pair_name": "GBPUSD",
  "source_tg_channel": "@vip_source_channel",
  "discord_webhook": "https://discord.com/api/webhooks/...",
  "destination_tg_channel": "@client_channel",
  "bot_token": "123456:ABCDEF...",
  "session": "gold_session_1",
  "status": "active"
}
```

---

## 🧠 AI Logic (Optional)

- Rewrite suspicious messages
- Detect likely bait text/images
- Pause forwarding dynamically
- Score messages before forwarding

---

## 📢 Telegram Admin Bot

- Sends alerts:
  - Trap detected
  - Pair auto-paused
  - Session failure
- Inline control buttons:
  - Pause/Resume
  - Block/Unblock
  - Show status/blocklist

---

## 🛠 Run the System

```bash
# Start Web UI
uvicorn ui.main:app --reload --port 8000

# Start Telegram session handler
python3 telegram_reader/multi_session.py

# Start Discord Bot
python3 discord/bot.py

# Start Telegram Poster
python3 telegram_poster/poster.py

# Start Admin Bot
python3 tg_admin_bot/admin_bot.py
```

---

## 🧩 Optional Upgrades

- GPT text rewriting
- Spam scoring
- Daily signal repost reports
- Webhook testing tool
- Screenshot-only mode (screenshot of TG message instead of forwarding)

---

## 📚 Glossary

| Term | Meaning |
|------|---------|
| Pair | One complete TG→Discord→TG route |
| Session | One `.session` file (userbot) |
| Bot Token | Telegram bot that posts |
| Blocklist | Words/images to reject |
| Admin Bot | Telegram bot with inline control |
| Trap | Message designed to catch leakers |
| Adaptive | AI logic adjusts behavior in real-time |

---

## 📞 Support

Need help setting up? Contact:
**@AutoForwardX_SupportBot**
