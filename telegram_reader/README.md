# AutoForwardX Telegram Reader

Multi-session Telegram message reader that forwards messages from private channels to Discord webhooks.

## Features

- **Multi-Session Support**: Load balance across multiple Telegram accounts
- **Async Processing**: Handle multiple sessions concurrently using asyncio
- **Channel Matching**: Intelligent matching between source channels and forwarding pairs
- **Discord Integration**: Direct webhook forwarding with custom usernames
- **Error Handling**: Comprehensive logging and graceful error recovery
- **Configuration-Driven**: JSON-based configuration for sessions and pairs

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Get Telegram API Credentials

1. Visit https://my.telegram.org/apps
2. Create a new application
3. Note down your `api_id` and `api_hash`

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 4. Create Sessions

```bash
python session_loader.py
```

Follow the prompts to:
- Enter your phone number (e.g., +91xxxxxxxxxx)
- Input the OTP code from Telegram
- Session file will be saved as `{session_name}.session`

### 5. Configure Pairs

```bash
cp pairs.json.example pairs.json
# Edit pairs.json with your channel and webhook configurations
```

## Running

```bash
python main.py
```

The script will:
- Load all active sessions from `sessions.json`
- Connect to Telegram using session files
- Monitor configured source channels
- Forward matching messages to Discord webhooks

## Configuration

### sessions.json Format

```json
{
  "session_name": {
    "phone": "+91xxxxxxxxxx",
    "session_file": "session_name.session",
    "status": "active"
  }
}
```

### pairs.json Format

```json
{
  "pair_name": {
    "source_tg_channel": "@source_channel",
    "discord_webhook": "https://discord.com/api/webhooks/...",
    "session": "session_name",
    "status": "active"
  }
}
```

## Logging

- Console output for real-time monitoring
- `telegram_reader.log` file for persistent logging
- Configurable log levels

## Error Handling

- Automatic reconnection for dropped sessions
- Graceful handling of rate limits
- Failed webhook delivery logging
- Session validation on startup

## Security Notes

- Session files contain authentication tokens - keep them secure
- Use environment variables for API credentials
- Webhook URLs should be kept private
- Consider using separate sessions for different purposes