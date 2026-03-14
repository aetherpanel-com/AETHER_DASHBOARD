# Aether Discord Bot

Discord bot for Aether Dashboard invite tracking and rewards.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the project root:
```bash
# Copy the example file
cp .env.example .env

# Or create manually with these variables:
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DASHBOARD_API_URL=http://localhost:3000
BOT_API_KEY=secure_internal_key
```

**Important:** Never commit your `.env` file to version control. It contains sensitive information.

3. Run the bot:
```bash
node bot.js
```

## Expected Output

When the bot starts successfully, you should see:
```
Connecting to dashboard: http://localhost:3000
Aether Discord Bot is online
Cached X invite(s)
```

When a user joins via an invite:
```
User joined: player123
Invite used: abc123xyz
Invited by: inviter456
Invite reward event sent to dashboard.
```

## Getting a Discord Bot Token

1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to the "Bot" section
4. Click "Add Bot"
5. Copy the token (keep it secret!)
6. Enable the following Privileged Gateway Intents:
   - Server Members Intent
   - Message Content Intent (if needed)

## Notes

- This is a minimal implementation for testing bot connection
- Invite tracking functionality will be added in future phases
