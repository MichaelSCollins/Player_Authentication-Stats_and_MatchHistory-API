import mongoose, { Schema, Document, Types } from 'mongoose';
import {
    IGame,
    GameSessionStatus,
    GamePlayer,
    GameSessionSettings,
    GameBoardState,
    GameRules,
    GameMetadata,
    ChatMessage,
    GamePlayerData,
    GameStateResponse,
    StoneColor,
    LastMove,
    GameBoardCell,
    CapturedStones,
    CapturedPosition,
    GameMoveHistory
} from '../types';

export interface GameDocument extends IGame, Document { }

const gameSchema = new Schema<GameDocument>({
    gameId: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['waiting', 'active', 'paused', 'completed', 'abandoned'] as GameSessionStatus[],
        default: 'waiting'
    },
    players: [{
        playerId: {
            type: Schema.Types.ObjectId,
            ref: 'Player',
            required: true
        },
        username: String,
        displayName: String,
        color: {
            type: String,
            enum: ['black', 'white'] as StoneColor[],
            required: true
        },
        isReady: { type: Boolean, default: false },
        isConnected: { type: Boolean, default: false },
        lastSeen: { type: Date, default: Date.now },
        timeRemaining: Number, // in seconds
        score: { type: Number, default: 0 },
        capturedStones: { type: Number, default: 0 }
    }],
    gameSettings: {
        boardSize: {
            type: Number,
            required: true,
            enum: [9, 13, 19],
            default: 19
        },
        timeControl: {
            type: String,
            enum: ['None', 'Blitz', 'Rapid', 'Classical'],
            default: 'None'
        },
        timeLimit: Number, // in minutes
        handicap: {
            type: Number,
            default: 0
        },
        komi: {
            type: Number,
            default: 6.5
        },
        allowUndo: { type: Boolean, default: false },
        allowResign: { type: Boolean, default: true }
    },
    boardState: {
        currentTurn: {
            type: String,
            enum: ['black', 'white'] as StoneColor[],
            default: 'black'
        },
        moveCount: { type: Number, default: 0 },
        lastMove: {
            x: Number,
            y: Number,
            color: String,
            timestamp: Date
        },
        board: [[{
            stone: String, // 'black', 'white', or null
            liberties: Number,
            groupId: String
        }]],
        capturedStones: {
            black: { type: Number, default: 0 },
            white: { type: Number, default: 0 }
        },
        moveHistory: [{
            playerId: Schema.Types.ObjectId,
            color: String,
            x: Number,
            y: Number,
            timestamp: { type: Date, default: Date.now },
            capturedStones: [{
                x: Number,
                y: Number
            }],
            pass: { type: Boolean, default: false }
        }],
        consecutivePasses: { type: Number, default: 0 }
    },
    gameRules: {
        suicideAllowed: { type: Boolean, default: false },
        koRule: { type: String, default: 'standard', enum: ['standard', 'superko'] },
        scoringMethod: { type: String, default: 'area', enum: ['area', 'territory'] }
    },
    metadata: {
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'Player',
            required: true
        },
        createdAt: { type: Date, default: Date.now },
        startedAt: Date,
        lastActivity: { type: Date, default: Date.now },
        spectators: [{
            type: Schema.Types.ObjectId,
            ref: 'Player'
        }],
        maxSpectators: { type: Number, default: 10 }
    },
    chat: [{
        playerId: Schema.Types.ObjectId,
        username: String,
        message: String,
        timestamp: { type: Date, default: Date.now },
        type: { type: String, enum: ['chat', 'system'], default: 'chat' }
    }],
    updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
gameSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    this.metadata.lastActivity = Date.now();
    next();
});

// Method to initialize board
gameSchema.methods.initializeBoard = function (): void {
    const size = this.gameSettings.boardSize;
    this.boardState.board = Array(size).fill(null).map(() =>
        Array(size).fill(null).map(() => ({
            stone: null,
            liberties: 4,
            groupId: null
        }))
    );

    // Set edge liberties
    for (let i = 0; i < size; i++) {
        this.boardState.board[0][i].liberties = 3; // top edge
        this.boardState.board[size - 1][i].liberties = 3; // bottom edge
        this.boardState.board[i][0].liberties = 3; // left edge
        this.boardState.board[i][size - 1].liberties = 3; // right edge
    }

    // Corner liberties
    this.boardState.board[0][0].liberties = 2;
    this.boardState.board[0][size - 1].liberties = 2;
    this.boardState.board[size - 1][0].liberties = 2;
    this.boardState.board[size - 1][size - 1].liberties = 2;
};

// Method to add a player
gameSchema.methods.addPlayer = function (playerData: GamePlayerData): void {
    if (this.players.length >= 2) {
        throw new Error('Game is full');
    }

    const color: StoneColor = this.players.length === 0 ? 'black' : 'white';
    this.players.push({
        ...playerData,
        color,
        isReady: false,
        isConnected: true,
        lastSeen: new Date()
    });
};

// Method to make a move
gameSchema.methods.makeMove = function (playerId: Types.ObjectId, x: number, y: number, color: StoneColor): boolean {
    if (this.status !== 'active') {
        throw new Error('Game is not active');
    }

    if (this.boardState.currentTurn !== color) {
        throw new Error('Not your turn');
    }

    if (x < 0 || x >= this.gameSettings.boardSize || y < 0 || y >= this.gameSettings.boardSize) {
        throw new Error('Invalid coordinates');
    }

    if (this.boardState.board[y][x].stone !== null) {
        throw new Error('Position already occupied');
    }

    // Add move to history
    this.boardState.moveHistory.push({
        playerId,
        color,
        x,
        y,
        timestamp: new Date(),
        capturedStones: [],
        pass: false
    });

    // Place stone
    this.boardState.board[y][x].stone = color;
    this.boardState.moveCount += 1;
    this.boardState.currentTurn = color === 'black' ? 'white' : 'black';
    this.boardState.lastMove = { x, y, color, timestamp: new Date() };

    // Reset consecutive passes
    this.boardState.consecutivePasses = 0;

    return true;
};

// Method to pass turn
gameSchema.methods.passTurn = function (playerId: Types.ObjectId, color: StoneColor): boolean {
    if (this.status !== 'active') {
        throw new Error('Game is not active');
    }

    if (this.boardState.currentTurn !== color) {
        throw new Error('Not your turn');
    }

    this.boardState.moveHistory.push({
        playerId,
        color,
        x: -1,
        y: -1,
        timestamp: new Date(),
        pass: true
    });

    this.boardState.currentTurn = color === 'black' ? 'white' : 'black';
    this.boardState.consecutivePasses += 1;

    // Check for game end (two consecutive passes)
    if (this.boardState.consecutivePasses >= 2) {
        this.status = 'completed';
    }

    return true;
};

// Method to get game state for Unity
gameSchema.methods.getGameState = function (): GameStateResponse {
    return {
        gameId: this.gameId,
        status: this.status,
        players: this.players.map(p => ({
            playerId: p.playerId,
            username: p.username,
            displayName: p.displayName,
            color: p.color,
            isReady: p.isReady,
            isConnected: p.isConnected,
            timeRemaining: p.timeRemaining,
            score: p.score,
            capturedStones: p.capturedStones
        })),
        gameSettings: this.gameSettings,
        boardState: {
            currentTurn: this.boardState.currentTurn,
            moveCount: this.boardState.moveCount,
            lastMove: this.boardState.lastMove,
            board: this.boardState.board,
            capturedStones: this.boardState.capturedStones
        },
        metadata: {
            createdAt: this.metadata.createdAt,
            startedAt: this.metadata.startedAt,
            lastActivity: this.metadata.lastActivity
        }
    };
};

// Method to start game
gameSchema.methods.startGame = function (): void {
    if (this.players.length !== 2) {
        throw new Error('Need exactly 2 players to start');
    }

    if (!this.players.every(p => p.isReady)) {
        throw new Error('All players must be ready');
    }

    this.status = 'active';
    this.metadata.startedAt = new Date();
    this.initializeBoard();
};

// Indexes for efficient queries
gameSchema.index({ status: 1, 'metadata.lastActivity': -1 });
gameSchema.index({ 'players.playerId': 1 });
gameSchema.index({ gameId: 1 });

export const Game = mongoose.model<GameDocument>('Game', gameSchema);
