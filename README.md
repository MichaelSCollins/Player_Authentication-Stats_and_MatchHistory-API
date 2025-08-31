# Go Game API - TypeScript

A comprehensive REST API and WebSocket server for a multiplayer Go (Baduk) board game, built with TypeScript, Node.js, Express, and MongoDB.

## Features

- **User Authentication & Management**: JWT-based authentication with user registration, login, and profile management
- **Player Statistics**: Comprehensive tracking of games played, wins, losses, rankings, and performance metrics
- **Match History**: Complete record of all games with detailed move history and results
- **Real-time Game Sessions**: WebSocket support for live game updates, moves, and chat
- **Game Rules Engine**: Support for different board sizes (9x9, 13x13, 19x19), time controls, and game settings
- **Leaderboards**: Multiple ranking systems based on wins, win rate, points, and streaks

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.IO
- **Validation**: Express-validator
- **Security**: bcryptjs for password hashing
- **Development**: ts-node-dev for hot reloading

## Project Structure

```
src/
├── models/          # MongoDB schemas and models
│   ├── Player.ts    # User/player data model
│   ├── Match.ts     # Completed game records
│   └── Game.ts      # Active game sessions
├── routes/          # API route handlers
│   ├── auth.ts      # Authentication endpoints
│   ├── players.ts   # Player management
│   ├── matches.ts   # Match history
│   └── games.ts     # Active games
├── middleware/      # Custom middleware
│   └── auth.ts      # JWT authentication
├── types/           # TypeScript interfaces
│   └── index.ts     # All type definitions
└── server.ts        # Main application entry point
```

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - User registration
- `POST /login` - User login
- `POST /logout` - User logout
- `GET /me` - Get current user profile
- `PUT /profile` - Update user profile
- `POST /change-password` - Change password
- `POST /refresh` - Refresh JWT token

### Players (`/api/players`)
- `GET /` - List players with pagination and search
- `GET /leaderboard` - Get leaderboards by different criteria
- `GET /:id` - Get player by ID
- `GET /:id/stats` - Get detailed player statistics
- `GET /:id/matches` - Get player's match history
- `PUT /:id/rank` - Update player rank
- `GET /online/status` - Get online players

### Matches (`/api/matches`)
- `GET /` - List matches with filtering and pagination
- `GET /:id` - Get match by ID with full details
- `GET /:id/moves` - Get match moves history
- `POST /:id/end` - End a match
- `GET /statistics/overview` - Get overall match statistics
- `GET /statistics/player/:playerId` - Get player match statistics
- `DELETE /:id` - Delete a match

### Games (`/api/games`)
- `POST /` - Create a new game
- `GET /` - List available games
- `GET /:gameId` - Get game by ID
- `POST /:gameId/join` - Join a game
- `POST /:gameId/ready` - Set player as ready
- `POST /:gameId/move` - Make a move
- `POST /:gameId/pass` - Pass turn
- `POST /:gameId/chat` - Send chat message
- `POST /:gameId/resign` - Resign from game
- `DELETE /:gameId` - Delete/abandon game

## WebSocket Events

### Client to Server
- `join-game` - Join a game room
- `leave-game` - Leave a game room
- `game-move` - Send game move data

### Server to Client
- `new-game-created` - New game available
- `player-joined` - Player joined game
- `player-ready` - Player ready status
- `game-started` - Game has started
- `move-made` - Move was made
- `turn-passed` - Turn was passed
- `chat-message` - New chat message
- `game-ended` - Game has ended
- `game-deleted` - Game was deleted

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd go-game-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Set up MongoDB**
   - Install MongoDB locally or use MongoDB Atlas
   - Update the `MONGODB_URI` in your `.env` file

5. **Build the project**
   ```bash
   npm run build
   ```

6. **Start the server**
   ```bash
   # Development mode with hot reload
   npm run dev
   
   # Production mode
   npm start
   ```

## Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/go-game-db

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# CORS Origins (Unity app domains)
CORS_ORIGIN=http://localhost:3000,http://localhost:8080
```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm test` - Run tests

### TypeScript Configuration

The project uses strict TypeScript configuration with:
- Strict type checking
- No implicit any
- Strict null checks
- Unused variable detection
- Source maps for debugging

## Database Models

### Player
- User authentication and profile information
- Game statistics and rankings
- Game preferences and settings
- Online status tracking

### Match
- Completed game records
- Move history and board states
- Player results and scores
- Game metadata and timing

### Game
- Active game sessions
- Real-time board state
- Player connections and readiness
- Chat messages and game rules

## API Response Format

All API responses follow a consistent format:

```typescript
interface ApiResponse<T> {
  message?: string;
  data?: T;
  error?: string;
  errors?: ValidationError[];
}

interface PaginationResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Error Handling

The API provides comprehensive error handling with appropriate HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

## Security Features

- Password hashing with bcrypt
- JWT token expiration
- Input validation and sanitization
- CORS configuration
- Rate limiting (can be added)

## Unity Integration

The API is designed to work seamlessly with Unity:
- RESTful endpoints for game state management
- WebSocket support for real-time updates
- JSON responses optimized for Unity's JSON parsing
- CORS configured for Unity WebGL builds

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For questions or support, please open an issue on GitHub or contact the development team.
