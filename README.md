# AutoForwardX: Advanced Telegram-Discord Message Forwarding System

AutoForwardX is a secure, scalable, AI-assisted message forwarding framework that automates and monitors message transfer across Telegram private channels and Discord servers. Designed for stealth-like environments where message security, traceability control, and trap-resistance are essential.

## 🎯 System Overview

The system provides:
- **Telegram Userbot Reader**: Multi-session Telethon clients for reading private channels
- **Discord Webhook Integration**: Automated message forwarding to Discord channels
- **Discord Bot Monitoring**: Edit/delete tracking with trap detection
- **Telegram Poster Bot**: Clean message delivery to destination channels
- **Web Dashboard**: Comprehensive management interface
- **Admin Bot**: Real-time Telegram controls with inline buttons
- **Advanced Trap Detection**: AI-powered content filtering and auto-pause mechanisms

## 🏗️ Architecture

### Core Components

1. **Telegram Reader** (`telegram_reader/main.py`)
   - Multi-session Telethon client
   - Automatic channel matching
   - Real-time message processing
   - Comprehensive trap detection

2. **Discord Bot** (`discord_bot.py`)
   - Webhook message monitoring
   - Edit/delete synchronization
   - Cross-platform message mapping
   - Trap pattern recognition

3. **Admin Bot** (`telegram_admin_bot.py`)
   - Inline keyboard controls
   - Real-time pair management
   - Blocklist management
   - System monitoring alerts

4. **Web Dashboard** (React/TypeScript)
   - Pair configuration interface
   - Session management
   - Live activity monitoring
   - Statistics and analytics

### Data Flow

```
Telegram Channel → Userbot Reader → Discord Webhook → Discord Bot → Telegram Poster → Destination Channel
                                        ↓
                              Trap Detection & AI Processing
                                        ↓
                              Admin Bot Notifications & Controls
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ with npm
- Python 3.11+
- PostgreSQL database (optional, uses in-memory storage by default)
- Telegram API credentials
- Discord bot token
- Telegram bot tokens for posting

### Installation

1. **Clone and setup the project:**
   ```bash
   git clone <repository-url>
   cd autoforwardx
   npm install
   ```

2. **Install Python dependencies:**
   ```bash
   pip install telethon pyrogram discord.py python-telegram-bot aiohttp aiofiles pillow cryptg
   ```

3. **Environment Configuration:**
   Create a `.env` file with:
   ```env
   # Telegram API (get from https://my.telegram.org/)
   TELEGRAM_API_ID=your_api_id
   TELEGRAM_API_HASH=your_api_hash
   
   # Bot Tokens
   DISCORD_BOT_TOKEN=your_discord_bot_token
   ADMIN_BOT_TOKEN=your_telegram_admin_bot_token
   TELEGRAM_BOT_TOKEN=your_telegram_poster_bot_token
   
   # Admin Access
   ADMIN_USER_IDS=your_telegram_user_id
   ADMIN_CHAT_ID=admin_chat_id
   
   # Database (optional)
   DATABASE_URL=postgresql://user:pass@host:port/db
   ```

4. **Start the services:**
   ```bash
   # Web Dashboard
   npm run dev
   
   # Telegram Reader (in separate terminal)
   cd telegram_reader && python main.py
   
   # Discord Bot (in separate terminal)
   python discord_bot.py
   
   # Admin Bot (in separate terminal)
   python telegram_admin_bot.py
   ```

## 📋 Configuration

### Pairs Configuration

Create forwarding pairs through the web dashboard or edit `telegram_reader/config/pairs.json`:

```json
[
  {
    "pair_name": "EURUSD_Signals",
    "source_channel": "@vip_signals_source",
    "discord_webhook": "https://discord.com/api/webhooks/...",
    "destination_channel": "@public_signals_dest",
    "bot_token": "123456:ABC...",
    "session": "main_session",
    "status": "active",
    "enable_ai": false
  }
]
```

### Session Management

Configure Telegram userbot sessions via `telegram_reader/session_loader.py`:

```bash
cd telegram_reader
python session_loader.py
```

Follow the interactive prompts to:
- Add phone number
- Verify with OTP
- Save session file
- Configure session name

### Blocklist Configuration

Global and pair-specific blocking rules in `telegram_reader/config/blocklist.json`:

```json
{
  "global_blocklist": {
    "text": ["trap", "/ *", "leak", "1"],
    "images": ["md5_hash_1", "md5_hash_2"]
  },
  "pair_blocklist": {
    "EURUSD_Signals": {
      "text": ["copy warning"],
      "images": ["specific_hash"]
    }
  }
}
```

## 🛡️ Trap Detection

### Automated Detection

The system automatically detects:
- **Text Traps**: `/ *`, `1`, `trap`, `leak`, `copy warning`
- **Image Traps**: MD5 hash comparison against blocklist
- **Edit Traps**: Messages edited >3 times trigger auto-pause
- **Suspicious Patterns**: Short numeric messages, known trap keywords

### Response Actions

When traps are detected:
1. Message is blocked from forwarding
2. Pair is auto-paused (high confidence traps)
3. Admin receives immediate notification
4. Auto-resume after cooldown period (2-3 minutes)
5. Detailed logging for analysis

## 🎛️ Admin Controls

### Telegram Admin Bot Commands

- `/start` - Main control panel
- `/status` - System overview
- `/pairs` - Pair management
- `/blocklist` - Blocklist controls

### Inline Controls

- ⏸️ Pause/▶️ Resume individual pairs
- ⏸️ Pause All/▶️ Resume All pairs
- 🚫 Add text blocks
- 🖼️ Block images from messages
- 📋 View system statistics

### Web Dashboard Features

- **Real-time Monitoring**: Live activity feed, system statistics
- **Pair Management**: Create, edit, pause/resume pairs
- **Session Controls**: Start/stop userbot sessions
- **Trap Detection**: Configure blocking rules, view detection logs
- **Analytics**: Message counts, block statistics, session status

## 🔧 Advanced Features

### AI Integration

Enable AI content rewriting (optional):
```json
{
  "enable_ai": true,
  "ai_provider": "openai",
  "ai_model": "gpt-3.5-turbo"
}
```

### Multi-Bot Support

Single bot token can handle up to 10 pairs:
- Automatic load balancing
- Rate limit management
- Failover support

### Message Formatting

Preserves original formatting:
- Bold, italic, underline text
- Links and mentions
- Reply chains and threads
- Media attachments

### Cross-Platform Sync

- Edit synchronization between platforms
- Delete propagation
- Message ID mapping
- Reply chain preservation

## 📊 Monitoring & Analytics

### System Metrics

- Active pairs count
- Total messages processed
- Blocked messages count
- Session status tracking
- Trap detection statistics

### Logging

Comprehensive logging across all components:
- `logs/telegram_reader.log` - Userbot activities
- `logs/discord_bot.log` - Discord bot operations
- `logs/admin_bot.log` - Admin bot interactions
- Web dashboard console logs

### Alerts & Notifications

Real-time notifications for:
- Trap detection events
- Session connection issues
- Pair auto-pause/resume
- System errors and warnings

## 🔒 Security Features

### Anti-Leak Protection

- Content filtering before reposting
- Trap detection and suppression
- No user identifier leakage
- Message transformation capabilities
- Admin control without UI login

### Access Control

- Authorized user validation
- Session-based authentication
- API key protection
- Environment variable security

### Data Privacy

- Local configuration storage
- Encrypted session files
- Secure API communications
- Optional database encryption

## 🔄 Deployment

### Development Mode

```bash
npm run dev  # Starts web dashboard with hot reload
```

### Production Deployment

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Configure process manager:**
   ```bash
   # Using PM2
   pm2 start ecosystem.config.js
   ```

3. **Setup database:**
   ```bash
   npm run db:push  # Push schema to database
   ```

### Docker Deployment

```dockerfile
# Example Dockerfile structure
FROM node:20-alpine
# ... build steps
EXPOSE 5000
CMD ["npm", "start"]
```

## 🛠️ Development

### Project Structure

```
autoforwardx/
├── client/                 # React dashboard
│   ├── src/components/    # UI components
│   ├── src/pages/        # Dashboard pages
│   └── src/lib/          # Utilities
├── server/               # Express backend
│   ├── routes.ts         # API endpoints
│   └── storage.ts        # Data layer
├── shared/               # Shared types
│   └── schema.ts         # Database schema
├── telegram_reader/      # Python userbot
│   ├── main.py          # Main reader
│   ├── config.py        # Configuration
│   └── session_loader.py # Session setup
├── discord_bot.py        # Discord bot
├── telegram_admin_bot.py # Admin bot
└── README.md            # This file
```

### Adding New Features

1. **Database Changes**: Update `shared/schema.ts`
2. **API Endpoints**: Add routes in `server/routes.ts`
3. **Frontend**: Create components in `client/src/components/`
4. **Python Integration**: Extend functionality in respective Python files

### Testing

```bash
# Frontend tests
npm test

# Python tests
python -m pytest telegram_reader/tests/

# Integration tests
npm run test:integration
```

## 📝 Configuration Reference

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_API_ID` | Telegram API ID | Yes |
| `TELEGRAM_API_HASH` | Telegram API Hash | Yes |
| `DISCORD_BOT_TOKEN` | Discord bot token | Yes |
| `ADMIN_BOT_TOKEN` | Telegram admin bot token | Yes |
| `ADMIN_USER_IDS` | Comma-separated user IDs | Yes |
| `DATABASE_URL` | PostgreSQL connection string | No |

### File Configurations

- `telegram_reader/config/pairs.json` - Forwarding pair definitions
- `telegram_reader/config/sessions.json` - Userbot session metadata  
- `telegram_reader/config/blocklist.json` - Blocking rules
- `telegram_reader/config/bot_tokens.json` - Bot token assignments

## ❓ Troubleshooting

### Common Issues

**Session Connection Fails:**
- Verify API credentials
- Check phone number format
- Ensure OTP verification completed

**Discord Bot Not Responding:**
- Verify bot permissions
- Check webhook URL format
- Confirm bot is in correct servers

**Messages Not Forwarding:**
- Check pair status (active/paused)
- Verify channel permissions
- Review trap detection logs

**Database Connection Issues:**
- Verify DATABASE_URL format
- Check database connectivity
- Run schema migrations

### Support

For technical support:
1. Check logs in respective log files
2. Review configuration files
3. Verify environment variables
4. Contact system administrator

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

---

**AutoForwardX** - Advanced message forwarding with intelligent trap detection and real-time controls.