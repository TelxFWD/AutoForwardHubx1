# AutoForwardX Telegram Copier Module

## Overview
The Telegram Copier Module provides direct Telegram → Telegram message copying with multi-user support, trap detection, and cross-platform synchronization.

## Features

### ✅ Multi-User Support
- Independent user sessions with separate configurations
- Multiple `.session` files per user for load balancing
- Per-user pair management and blocking rules

### ✅ Advanced Trap Detection
- **Text Traps**: Patterns like `/ *`, `1`, `leak`, `trap`
- **Image Traps**: MD5/SHA256 hash comparison
- **Edit Traps**: Messages edited 3+ times trigger alerts
- **Auto-Pause**: Pairs automatically paused after threshold exceeded

### ✅ Message Synchronization
- Edit/delete synchronization across platforms
- Message mapping for cross-platform tracking
- Format preservation during forwarding

### ✅ Content Filtering
- Global and per-pair blocklists
- Text pattern matching
- Image hash blocking
- Real-time trap detection

## Configuration

### User Configuration (`user_copies.json`)
```json
{
  "users": [
    {
      "user_id": "sunil",
      "session_file": "sessions/sunil_1.session",
      "pairs": [
        {
          "source": "@vip_signals_1",
          "destination": "@sunil_copy_1"
        }
      ]
    }
  ]
}
```

### Blocklist Configuration (`blocklist.json`)
```json
{
  "global": {
    "text_patterns": ["trap", "leak", "/ *"],
    "image_hashes": ["abc123...", "def456..."]
  },
  "pairs": {
    "user_pair_name": {
      "text_patterns": ["specific pattern"],
      "image_hashes": ["specific hash"]
    }
  }
}
```

## Usage

### Session Creation
```bash
# Create new session
python session_loader.py --phone +1234567890

# Verify OTP
python session_loader.py --phone +1234567890 --otp 12345

# List sessions
python session_loader.py --list

# Test session
python session_loader.py --test user_1234567890
```

### Running the Copier
```bash
# Set environment variables
export TELEGRAM_API_ID="your_api_id"
export TELEGRAM_API_HASH="your_api_hash"

# Start the copier
python copier_multi_session.py
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_API_ID` | Telegram API ID from my.telegram.org | Yes |
| `TELEGRAM_API_HASH` | Telegram API Hash from my.telegram.org | Yes |

## File Structure

```
telegram_copier/
├── copier_multi_session.py    # Main copier implementation
├── session_loader.py          # Session management utility
├── user_copies.json.example   # Example user configuration
├── message_mappings.json      # Message ID mappings (auto-generated)
├── blocklist.json            # Blocklist configuration (auto-generated)
└── sessions/                 # Directory for .session files
    ├── user_1234567890.session
    └── user_1234567890_metadata.json
```

## Integration with AutoForwardX

The copier module integrates seamlessly with the main AutoForwardX system:

1. **Web Dashboard**: Manage users and pairs through the web interface
2. **Discord Bot**: Edit/delete synchronization with Discord messages
3. **Admin Bot**: Real-time controls and trap detection alerts
4. **API Integration**: RESTful endpoints for session and pair management

## Trap Detection Flow

1. **Text Analysis**: Check incoming messages against blocked patterns
2. **Image Hashing**: Generate MD5/SHA256 hashes for image comparison
3. **Edit Monitoring**: Track edit frequency and pause on suspicious activity
4. **Auto-Recovery**: Automatic resume after cooldown period
5. **Admin Alerts**: Notifications sent to admin bot for manual intervention

## Security Features

- **Rate Limiting**: Built-in delays to avoid Telegram limits
- **Error Handling**: Comprehensive error recovery and logging
- **Session Isolation**: Users cannot access each other's data
- **Hash-based Blocking**: Secure image identification without storing files

## Monitoring and Logging

- Real-time activity logging
- Performance metrics tracking
- Error rate monitoring
- Trap detection statistics
- Session health monitoring

## Support

For technical support or configuration assistance, refer to the main AutoForwardX documentation or contact the system administrator.