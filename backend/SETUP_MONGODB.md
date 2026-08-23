# MongoDB Setup Guide

## Quick Setup Options

### Option 1: MongoDB Atlas (Cloud - Recommended) ⭐

**Easiest option - no installation needed!**

1. **Sign up for free**: Go to https://www.mongodb.com/cloud/atlas/register
2. **Create a cluster**: 
   - Choose "Free" tier (M0)
   - Select a cloud provider and region
   - Click "Create Cluster"
3. **Get connection string**:
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/`)
4. **Create `.env` file** in the `backend` directory:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/48app?retryWrites=true&w=majority
   PORT=3000
   ```
   Replace `username` and `password` with your MongoDB Atlas credentials.

5. **Restart the backend server**

### Option 2: Install MongoDB Locally

#### macOS (with Homebrew):
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community
```

#### macOS (without Homebrew):
1. Download MongoDB from: https://www.mongodb.com/try/download/community
2. Follow the installation instructions
3. Start MongoDB manually

#### Windows:
1. Download MongoDB from: https://www.mongodb.com/try/download/community
2. Run the installer
3. MongoDB will start automatically as a service

## Verify MongoDB is Running

After installation, the server should show:
```
✅ MongoDB connected successfully
```

Instead of:
```
❌ MongoDB connection error
```

## Troubleshooting

- **Connection refused**: MongoDB is not running - start it using the commands above
- **Authentication failed**: Check your MongoDB Atlas username/password in the connection string
- **Network timeout**: Check your internet connection (for Atlas) or firewall settings

## Current Status

The backend server will run even without MongoDB, but registration won't work until MongoDB is connected.




