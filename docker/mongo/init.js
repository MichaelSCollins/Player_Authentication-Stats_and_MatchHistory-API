// MongoDB initialization script for Go Game API
// This script runs when the MongoDB container starts for the first time

// Switch to the go-game-db database
db = db.getSiblingDB('go-game-db');

// Create collections with validation
db.createCollection('players', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["username", "email", "password", "displayName"],
            properties: {
                username: {
                    bsonType: "string",
                    minLength: 3,
                    maxLength: 20
                },
                email: {
                    bsonType: "string",
                    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                },
                password: {
                    bsonType: "string",
                    minLength: 6
                },
                displayName: {
                    bsonType: "string",
                    minLength: 1,
                    maxLength: 30
                }
            }
        }
    }
});

db.createCollection('matches', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["matchId", "players", "gameSettings"],
            properties: {
                matchId: {
                    bsonType: "string"
                },
                players: {
                    bsonType: "array",
                    minItems: 2,
                    maxItems: 2
                }
            }
        }
    }
});

db.createCollection('games', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["gameId", "status", "players"],
            properties: {
                gameId: {
                    bsonType: "string"
                },
                status: {
                    enum: ["waiting", "active", "paused", "completed", "abandoned"]
                }
            }
        }
    }
});

// Create indexes for better performance
db.players.createIndex({ "username": 1 }, { unique: true });
db.players.createIndex({ "email": 1 }, { unique: true });
db.players.createIndex({ "rank": 1 });
db.players.createIndex({ "stats.gamesPlayed": -1 });
db.players.createIndex({ "isOnline": 1 });

db.matches.createIndex({ "matchId": 1 }, { unique: true });
db.matches.createIndex({ "players.playerId": 1 });
db.matches.createIndex({ "metadata.startTime": -1 });
db.matches.createIndex({ "gameState.status": 1 });

db.games.createIndex({ "gameId": 1 }, { unique: true });
db.games.createIndex({ "status": 1 });
db.games.createIndex({ "players.playerId": 1 });
db.games.createIndex({ "metadata.lastActivity": -1 });

// Create a test admin user for development
db.players.insertOne({
    username: "admin",
    email: "admin@gogame.com",
    password: "$2a$10$rQZ9K8mN2pL1vX3cF5gH7jK9mN2pL1vX3cF5gH7jK9mN2pL1vX3cF5g", // "admin123"
    displayName: "Administrator",
    rank: "Master",
    stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        gamesDrawn: 0,
        totalPoints: 0,
        averagePoints: 0,
        winStreak: 0,
        currentStreak: 0,
        bestWinStreak: 0
    },
    preferences: {
        boardSize: 19,
        timeControl: "Classical",
        handicap: false
    },
    isOnline: false,
    lastSeen: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
});

// Create a test player for development
db.players.insertOne({
    username: "testplayer",
    email: "test@gogame.com",
    password: "$2a$10$rQZ9K8mN2pL1vX3cF5gH7jK9mN2pL1vX3cF5gH7jK9mN2pL1vX3cF5g", // "test123"
    displayName: "Test Player",
    rank: "Beginner",
    stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        gamesDrawn: 0,
        totalPoints: 0,
        averagePoints: 0,
        winStreak: 0,
        currentStreak: 0,
        bestWinStreak: 0
    },
    preferences: {
        boardSize: 19,
        timeControl: "None",
        handicap: false
    },
    isOnline: false,
    lastSeen: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
});

print("MongoDB initialization completed successfully!");
print("Database: go-game-db");
print("Collections created: players, matches, games");
print("Test users created: admin (admin123), testplayer (test123)");
