
# 📦 AutoForwardX: System Blueprint & Functional Overview

AutoForwardX is a secure, scalable, AI-assisted message forwarding framework that automates and monitors message transfer across **Telegram private channels** and **Discord servers**. It is designed to operate in stealth-like environments where message security, traceability control, and trap-resistance are essential.

---

## 🎯 Goal

To build a **modular system** that can:
- Read messages from **private Telegram channels** via user sessions
- Forward those messages to **Discord channels** via webhooks
- monitor and edit/delete forwarded messages via a Discord bot
- Repost clean/filtered content back to **destination Telegram channels** via bots
- Provide **web-based UI** to manage sessions, pairs, webhooks, bots, and blocklists
- Use a **Telegram Admin Bot** with inline buttons to pause/resume/manage routing in real time

---

## 🧩 System Components

### 1. 🔍 Telegram Userbot Reader (`userbot_reader.py`)
- Uses **Telethon sessions** to monitor private channels
- Each session handles 1–5 signal source channels
- Maps incoming messages to a `pair` using `pairs.json`
- Forwards messages to Discord using the correct webhook

### 2. 🌐 Discord Webhook (per pair)
- Posts raw messages received from the Telegram userbot
- One webhook per signal/channel
- Used to preserve message history and assist moderation

### 3. 🤖 Discord Bot (`bot.py`)
- Monitors messages posted by webhooks
- Handles message **edit/delete**
- Supports **trap detection**:
  - Excessive edits
  - Suspicious keywords (e.g., "/ *", "1", "trap")
- Optionally integrates **AI to rewrite or block** risky content
- Sends alerts to Admin Bot if traps detected

### 4. 📤 Telegram Poster Bot (`poster.py`)
- Posts clean messages into the final **destination TG channels**
- Supports multiple Telegram Bot tokens (one bot for 10 pair)
- Syncs edits and deletes if source message is changed
- Uses Pyrogram for speed and API support

### 5. 🧠 Trap Detection & AI Rewriting
- Detects traps using rules:
  - Repeated edits
  - Known trap keywords
  - OCR-processed image text
- Optionally rewrites content using GPT, Claude, or local LLM
- Automatically pauses affected pair and notifies admin

### 6. 🧑‍💻 Web UI
- Built with Tailwind + HTMX + FastAPI
- Provides interfaces to:
  - Add/edit/remove signal pairs
  - Assign bot tokens per pair
  - Assign userbot sessions per pair
  - Edit global or pair-based blocklists
  - Pause/resume forwarding globally or per-pair
- Webhook and trap settings are editable via UI

### 7. 🤖 Telegram Admin Bot
- Uses inline buttons to:
  - [⏸ Pause a pair]
  - [▶ Resume a pair]
  - [📋 View trap logs or blocklists]
  - [➕ Block a term]
- Sends real-time alerts when:
  - A trap is detected
  - A session fails or expires
  - A pair is paused by system

---

## 🔗 Configuration Files

### `pairs.json`
Stores all routing logic:
```json
{
  "pair_name": "GBPUSD",
  "source_tg_channel": "@vip_gold",
  "discord_webhook": "https://discord.com/api/webhooks/...",
  "destination_tg_channel": "@copy_channel",
  "bot_token": "123456:ABCDEF...",
  "session": "gold_session_1",
  "status": "active"
}
```

### `blocklist.json`
Stores global + pair-specific blocked items:
```json
{
  "global_blocklist": {
    "text": ["trap", "/ *", "leak"],
    "images": ["abc123hash", "xyz789"]
  },
  "pair_blocklist": {
    "GBPUSD": {
      "text": ["1", "copy warning"],
      "images": ["hash456"]
    }
  }
}
```

### `sessions.json`
Stores userbot session metadata:
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

## 🔁 Message Flow: End-to-End

```text
1. Telegram userbot reads message from source channel
2. Routes message to correct Discord webhook
3. Discord bot watches webhook channel
   - Detects trap or excessive edit
   - Rewrites if necessary
   - Posts to Telegram destination via correct bot
4. Admin Bot receives alerts (if traps or failures)
5. Web UI updates config/status live
```

---

## 📦 Key Functional Modules

| Function | Description |
|---------|-------------|
| `start_all_sessions()` | Starts all user sessions asynchronously |
| `handle_new_message()` | Called on Telegram new message event |
| `send_to_discord()` | Sends content to correct webhook |
| `trap_detector()` | Flags suspicious messages |
| `post_to_telegram()` | Posts final message to destination |
| `admin_notify()` | Sends alerts via Telegram Admin Bot |
| `update_pair_status()` | Pauses/resumes pairs (via UI or bot) |
| `add_block_term()` | Adds a new blocked word via UI or Admin Bot |

---

## 🛡️ Anti-Leak Strategy (Stealth Mode)

AutoForwardX is designed for **anti-leak use cases**:
- Messages are filtered before being reposted
- Traps are detected and suppressed
- No user identifiers or metadata leaks
- Messages are transformed if necessary
- Admin control via Telegram without UI login

---

## 🛠 Tech Stack

- **Python 3.10+**
- Telethon (userbot)
- Pyrogram (poster bot)
- discord.py
- FastAPI + HTMX + Tailwind
- SQLite + JSON config
- dotenv/env for secure keys

---

## ✅ Ready-to-Build Roadmap

1. Build and test Telegram session handler (done ✅)
2. Deploy Discord webhook listener + Discord bot
3. Integrate Telegram poster bot with multi-token routing
4. Connect blocklist + trap handler logic
5. Launch admin bot (Telegram-based)
6. Deploy control UI for non-technical users
7. Add reporting/logging & live dashboard (phase 2)

---

## 👨‍💻 Admin Access

| Tool | Access |
|------|--------|
| Telegram Admin Bot | Real-time inline controls |
| Web UI Dashboard | Edit config, pause pairs, block terms |
| Console Logs | Debugging and live traps |

---

## 🧪 Optional Add-ons


- Trap fingerprint logging
- Web dashboard with logs + metrics
- Integration with cloud storage (log archiving)

## 🆕  Updates

- ✅ One Telegram Bot Token can now manage **up to 10 pairs**
- ✅ **Message format is preserved**, including bold, italics, links, and replies
- ✅ Discord bot is responsible for **edit tracking** and **reply/thread preservation**
- ✅ Telegram Admin Bot includes:
  - 🔳 **Inline button** to add an image as a blocked trap
  - ⏸️ Pause all pairs globally
  - ▶️ Resume all pairs globally

---

## 🎯 Goal

To build a **modular system** that can:
- Read messages from **private Telegram channels** via user sessions
- Forward those messages to **Discord channels** via webhooks
- Monitor and edit/delete forwarded messages via a Discord bot
- Repost clean/filtered content back to **destination Telegram channels** via bots
- Provide **web-based UI** to manage sessions, pairs, webhooks, bots, and blocklists
- Use a **Telegram Admin Bot** with inline buttons to pause/resume/manage routing in real time
- Preserve **full message formatting and reply chains**

---

## 🔁 Updated Message Flow

```text
1. Telegram userbot reads a message with formatting or reply
2. Routes it to the correct Discord webhook
3. Discord bot:
   - Monitors messages
   - Handles edits
   - Maps Discord replies and threads
4. Message is sent to Telegram Poster bot:
   - Rebuilds formatting
   - Reposts to destination channel
5. Admin Bot can:
   - Pause/resume one or all pairs
   - Add a blocked image from a forwarded photo
   - Manage text/image traps
```

---

## 📤 Telegram Poster Bot

- Now supports using **one Telegram Bot Token for multiple pairs** (up to 10+)
- Selects destination channel from `pairs.json`
- Parses and **preserves formatting** (HTML/MarkdownV2)
- Supports replies and original post structure

---

## 🤖 Telegram Admin Bot (Extended)

- Inline button menu includes:
  - [⏸ Pause Pair] / [▶ Resume Pair]
  - [⏸ Pause All Pairs] / [▶ Resume All Pairs]
  - [➕ Add Blocked Text]
  - [🖼 Block Image From Message]
  - [📋 Show Global Blocklist]

- When image is blocked:
  - Hash (e.g., MD5) of image is saved
  - Added to `blocklist.json → images` (global or per pair)

---

## 🔁 Discord Bot Edits + Replies

- Listens to Discord webhook-posted messages
- Tracks **edits** and syncs back to Telegram (if edit-tracking enabled)
- Tracks **replies** in Discord and syncs them to Telegram as reply-to links
- Detects repeated edits to trap leakers

---

## 🔧 Configuration Improvements

### `pairs.json` (Updated)
```json
{
  "pair_name": "EURUSD",
  "source_tg_channel": "@source_eurusd",
  "discord_webhook": "https://discord.com/api/webhooks/...",
  "destination_tg_channel": "@dest_eurusd",
  "bot_token": "123456:ABCDEF...",  // shared across 10 pairs
  "session": "eurusd_session_1",
  "status": "active"
}
```

---

## 📦 Trap Enhancements

| Trap Type | Detection | Block Behavior |
|-----------|-----------|----------------|
| Keyword   | `/ *`, "trap", etc. | Reject message |
| Image     | Hash match or OCR text | Reject image |
| Edit Spam | >3 edits | Auto-pause pair |
| Admin Add | Block new text/image via Telegram | Immediate effect |

---

## ✅ Next Build Steps

1. Implement multi-pair support under one bot
2. Add edit/reply forwarding to Telegram
3. Add Telegram Bot inline button:
   - "Block this image"
   - "Pause all pairs"
   - "Resume all pairs"
4. UI config to toggle reply/edit sync
5. Add Telegram message formatting parser → Discord → back to Telegram

---

## 💬 Example Admin Menu in Telegram

```
🛠 Pair: EURUSD
Status: ✅ Active

[⏸ Pause Pair]   [▶ Resume Pair]
[⏸ Pause All]    [▶ Resume All]
[➕ Block Text]   [🖼 Block Image]
[📋 Show Blocklist]
```

---

This update ensures AutoForwardX is robust, formatting-aware, and built to defend against traps while supporting modern UI and cross-platform message integrity.





