# The Begining After The End 📁

A powerful Telegram bot that allows admins to store files from channels and generate shareable links for easy file retrieval. Perfect for creating organized file archives and sharing content efficiently.

## Features 🌟

- **Single File Storage**: Store individual files from channel posts
- **Batch File Storage**: Store multiple files from a range of messages
- **Custom Captions**: Set and manage custom captions for shared files
- **Multiple File Types Support**: 
  - Documents 📄
  - Photos 🖼️
  - Videos 🎥
  - Animations (GIFs) 🎭
  - Stickers 🎯
- **Admin Management**: Secure admin-only storage capabilities
- **Logging System**: Comprehensive logging of all bot activities
- **User-Friendly Interface**: Interactive buttons and clear instructions

## Prerequisites 📋

Before setting up the bot, make sure you have:

- Node.js (v14 or higher)
- MongoDB database
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- A Telegram channel where the bot is an admin

## Installation 🚀

1. Clone the repository:
```bash
git clone https://github.com/iglideCS/pk-cinema-ai.git
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
BOT_TOKEN=your_bot_token
MONGODB_URI=your_mongodb_uri
ADMIN_IDS=admin_id1,admin_id2
TARGET_CHANNEL=your_channel_id
LOG_CHANNEL_ID=your_log_channel_id
```

4. Start the bot:
```bash
npm start
```

## Usage 💡

### Admin Commands

- `/link` or `/sl`: Store a single file from a channel post
  ```
  /link https://t.me/c/xxxxx/123
  ```

- `/batch` or `/ml`: Store multiple files from a range of messages
  ```
  /batch https://t.me/c/xxxxx/123 https://t.me/c/xxxxx/128
  ```

- `/broadcast`: Broadcast a message


- `/stats`: View bot statistics
  

### User Commands

- `/start`: Start the bot and view welcome message
- `/start <unique_id>`: Retrieve stored files using a unique ID

## File Storage Process 📝

1. Admin sends a channel post link to the bot
2. Bot validates the link and admin permissions
3. Bot generates a unique ID for the file(s)
4. Files are stored in the database with the unique ID
5. Bot returns a shareable link for file retrieval
6. Users can access files using the shareable link

## Logging System 📊

The bot includes a comprehensive logging system that tracks:
- Command usage
- User actions
- File storage activities
- Error events

Logs are:
- Saved to daily log files
- Sent to a designated Telegram logging channel
- Formatted for easy reading and monitoring

## Error Handling ⚠️

The bot includes robust error handling for:
- Invalid links
- Unauthorized access attempts
- File storage failures
- Database connection issues
- Message processing errors

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License 📜

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support 💬

If you encounter any issues or have questions, please:
1. Check the existing issues or create a new one
2. Contact the bot creator through Telegram
3. Submit a pull request with your proposed changes

## Acknowledgments 🙏

- [Telegraf](https://github.com/telegraf/telegraf) - Telegram Bot Framework
- [MongoDB](https://www.mongodb.com/) - Database
- [Node.js](https://nodejs.org/) - Runtime Environment

---
Made with ❤️ by [Glider]