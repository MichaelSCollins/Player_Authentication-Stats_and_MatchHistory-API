import mongoose, { Schema, Document, Types } from 'mongoose';
import {
    IMatch,
    MatchPlayer,
    GameSettings,
    GameState,
    GameMove,
    MatchResult,
    MatchMetadata,
    BoardState,
    EndReason,
    FinalScores,
    GameStatus,
    StoneColor,
    LastMove,
    BoardCell,
    CapturedStones,
    CapturedPosition
} from '../types';

export interface MatchDocument extends IMatch, Document { }

const matchSchema = new Schema<MatchDocument>({
    matchId: {
        type: String,
        required: true,
        unique: true
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
        finalScore: Number,
        capturedStones: Number,
        territory: Number,
        komi: { type: Number, default: 6.5 }
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
        handicap: {
            type: Number,
            default: 0
        },
        komi: {
            type: Number,
            default: 6.5
        }
    },
    gameState: {
        status: {
            type: String,
            enum: ['active', 'completed', 'abandoned', 'resigned'] as GameStatus[],
            default: 'active'
        },
        currentTurn: {
            type: String,
            enum: ['black', 'white'] as StoneColor[],
            default: 'black'
        },
        moveCount: {
            type: Number,
            default: 0
        },
        lastMove: {
            x: Number,
            y: Number,
            color: String,
            timestamp: Date
        },
        board: [[{
            stone: String, // 'black', 'white', or null
            liberties: Number
        }]],
        capturedStones: {
            black: { type: Number, default: 0 },
            white: { type: Number, default: 0 }
        }
    },
    moves: [{
        playerId: {
            type: Schema.Types.ObjectId,
            ref: 'Player'
        },
        color: String,
        x: Number,
        y: Number,
        timestamp: { type: Date, default: Date.now },
        capturedStones: [{
            x: Number,
            y: Number
        }]
    }],
    result: {
        winner: {
            type: Schema.Types.ObjectId,
            ref: 'Player'
        },
        winnerColor: String,
        finalScore: {
            black: Number,
            white: Number
        },
        margin: Number,
        endReason: {
            type: String,
            enum: ['resignation', 'timeout', 'normal', 'abandoned'] as EndReason[],
            default: 'normal'
        }
    },
    metadata: {
        startTime: { type: Date, default: Date.now },
        endTime: Date,
        duration: Number, // in minutes
        spectators: [{
            type: Schema.Types.ObjectId,
            ref: 'Player'
        }]
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
matchSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Method to calculate game duration
matchSchema.methods.calculateDuration = function (): number {
    if (this.metadata.endTime && this.metadata.startTime) {
        return Math.round((this.metadata.endTime.getTime() - this.metadata.startTime.getTime()) / (1000 * 60));
    }
    return 0;
};

// Method to get current board state
matchSchema.methods.getBoardState = function (): BoardState {
    return {
        board: this.gameState.board,
        currentTurn: this.gameState.currentTurn,
        moveCount: this.gameState.moveCount,
        lastMove: this.gameState.lastMove,
        capturedStones: this.gameState.capturedStones
    };
};

// Method to add a move
matchSchema.methods.addMove = function (moveData: GameMove): void {
    this.moves.push(moveData);
    this.gameState.moveCount += 1;
    this.gameState.currentTurn = this.gameState.currentTurn === 'black' ? 'white' : 'black';
    this.gameState.lastMove = {
        x: moveData.x,
        y: moveData.y,
        color: moveData.color,
        timestamp: moveData.timestamp
    };
};

// Method to end the game
matchSchema.methods.endGame = function (endReason: EndReason, winnerId: Types.ObjectId, finalScores: FinalScores): void {
    this.gameState.status = 'completed';
    this.metadata.endTime = new Date();
    this.metadata.duration = this.calculateDuration();

    this.result = {
        winner: winnerId,
        winnerColor: finalScores.black > finalScores.white ? 'black' : 'white',
        finalScore: finalScores,
        margin: Math.abs(finalScores.black - finalScores.white),
        endReason: endReason
    };

    // Update player stats
    this.players.forEach(player => {
        if (player.playerId.toString() === winnerId.toString()) {
            player.finalScore = finalScores[player.color];
        }
    });
};

// Index for efficient queries
matchSchema.index({ 'players.playerId': 1, 'metadata.startTime': -1 });
matchSchema.index({ 'gameState.status': 1 });
matchSchema.index({ 'metadata.startTime': -1 });

export const Match = mongoose.model<MatchDocument>('Match', matchSchema);
