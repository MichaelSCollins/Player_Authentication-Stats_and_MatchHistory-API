import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IPlayer, PlayerRank, PlayerStats, PlayerPreferences, GameResult } from '../types';

export interface PlayerDocument extends IPlayer, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  getWinRate(): number;
  updateStats(gameResult: GameResult, points: number): void;
}

const playerSchema = new Schema<PlayerDocument>({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30
  },
  avatar: {
    type: String,
    default: null
  },
  rank: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master'] as PlayerRank[],
    default: 'Beginner'
  },
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    gamesDrawn: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    averagePoints: { type: Number, default: 0 },
    winStreak: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    bestWinStreak: { type: Number, default: 0 }
  },
  preferences: {
    boardSize: { type: Number, default: 19, enum: [9, 13, 19] },
    timeControl: { type: String, default: 'None', enum: ['None', 'Blitz', 'Rapid', 'Classical'] },
    handicap: { type: Boolean, default: false }
  },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Hash password before saving
playerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Update timestamp on save
playerSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Method to compare passwords
playerSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to calculate win rate
playerSchema.methods.getWinRate = function (): number {
  if (this.stats.gamesPlayed === 0) return 0;
  return Number((this.stats.gamesWon / this.stats.gamesPlayed * 100).toFixed(2));
};

// Method to update stats after a game
playerSchema.methods.updateStats = function (gameResult: GameResult, points: number): void {
  this.stats.gamesPlayed += 1;
  this.stats.totalPoints += points;

  if (gameResult === 'win') {
    this.stats.gamesWon += 1;
    this.stats.currentStreak += 1;
    this.stats.bestWinStreak = Math.max(this.stats.bestWinStreak, this.stats.currentStreak);
  } else if (gameResult === 'loss') {
    this.stats.gamesLost += 1;
    this.stats.currentStreak = 0;
  } else {
    this.stats.gamesDrawn += 1;
    this.stats.currentStreak = 0;
  }

  this.stats.averagePoints = this.stats.totalPoints / this.stats.gamesPlayed;
};

// Virtual for win rate
playerSchema.virtual('winRate').get(function (): number {
  return this.getWinRate();
});

// Ensure virtual fields are serialized
playerSchema.set('toJSON', { virtuals: true });
playerSchema.set('toObject', { virtuals: true });

export const Player = mongoose.model<PlayerDocument>('Player', playerSchema);
