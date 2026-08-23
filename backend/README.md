# Backend Setup

## Database Setup

This backend uses MongoDB to store user registration data.

### Option 1: Local MongoDB

1. Install MongoDB on your machine:
   - macOS: `brew install mongodb-community`
   - Or download from [MongoDB website](https://www.mongodb.com/try/download/community)

2. Start MongoDB:
   ```bash
   brew services start mongodb-community
   # or
   mongod
   ```

3. The app will connect to `mongodb://localhost:27017/48app` by default

### Option 2: MongoDB Atlas (Cloud)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster and get your connection string
3. Add it to your `.env` file:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/48app
   ```

### Environment Variables

Create a `.env` file in the backend directory:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/48app
```

## Running the Server

```bash
npm start
# or for development with auto-reload
npm run dev
```

## API Endpoints

- `POST /api/register` - Register a new user
  - Body: `{ name, surname, gender, dateOfBirth, email, password }`
  - Returns: User data on success

## Notes

- Passwords are currently stored in plain text. For production, use bcrypt to hash passwords.
- The database will be created automatically when you first run the server.

