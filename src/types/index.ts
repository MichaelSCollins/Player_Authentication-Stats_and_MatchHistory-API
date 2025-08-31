import { Document, Types } from 'mongoose';

// Player Types
export interface IPlayer extends Document {
    username: string;
    email: string;
    password: string;
    displayName: string;
    avatar?: string;
    rank: PlayerRank;
    stats: PlayerStats;
    preferences: PlayerPreferences;
    isOnline: boolean;
    lastSeen: Date;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
    getWinRate(): number;
    updateStats(gameResult: GameResult, points: number): void;
}

export type PlayerRank = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | 'Master';

export interface PlayerStats {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    gamesDrawn: number;
    totalPoints: number;
    averagePoints: number;
    winStreak: number;
    currentStreak: number;
    bestWinStreak: number;
}

export interface PlayerPreferences {
    boardSize: 9 | 13 | 19;
    timeControl: TimeControl;
    handicap: boolean;
}

export type TimeControl = 'None' | 'Blitz' | 'Rapid' | 'Classical';

export type GameResult = 'win' | 'loss' | 'draw';

// Match Types
export interface IMatch extends Document {
    matchId: string;
    players: MatchPlayer[];
    gameSettings: GameSettings;
    gameState: GameState;
    moves: GameMove[];
    result?: MatchResult;
    metadata: MatchMetadata;
    createdAt: Date;
    updatedAt: Date;
    calculateDuration(): number;
    getBoardState(): BoardState;
    addMove(moveData: GameMove): void;
    endGame(endReason: EndReason, winnerId: Types.ObjectId, finalScores: FinalScores): void;
}

export interface MatchPlayer {
    playerId: Types.ObjectId;
    username: string;
    displayName: string;
    color: StoneColor;
    finalScore?: number;
    capturedStones?: number;
    territory?: number;
    komi: number;
}

export interface GameSettings {
    boardSize: 9 | 13 | 19;
    timeControl: TimeControl;
    handicap: number;
    komi: number;
}

export interface GameState {
    status: GameStatus;
    currentTurn: StoneColor;
    moveCount: number;
    lastMove?: LastMove;
    board: BoardCell[][];
    capturedStones: CapturedStones;
}

export type GameStatus = 'active' | 'completed' | 'abandoned' | 'resigned';

export type StoneColor = 'black' | 'white';

export interface LastMove {
    x: number;
    y: number;
    color: StoneColor;
    timestamp: Date;
}

export interface BoardCell {
    stone: StoneColor | null;
    liberties: number;
}

export interface CapturedStones {
    black: number;
    white: number;
}

export interface GameMove {
    playerId: Types.ObjectId;
    color: StoneColor;
    x: number;
    y: number;
    timestamp: Date;
    capturedStones: CapturedPosition[];
}

export interface CapturedPosition {
    x: number;
    y: number;
}

export interface MatchResult {
    winner: Types.ObjectId;
    winnerColor: StoneColor;
    finalScore: FinalScores;
    margin: number;
    endReason: EndReason;
}

export type EndReason = 'resignation' | 'timeout' | 'normal' | 'abandoned';

export interface FinalScores {
    black: number;
    white: number;
}

export interface MatchMetadata {
    startTime: Date;
    endTime?: Date;
    duration?: number;
    spectators: Types.ObjectId[];
}

export interface BoardState {
    board: BoardCell[][];
    currentTurn: StoneColor;
    moveCount: number;
    lastMove?: LastMove;
    capturedStones: CapturedStones;
}

// Game Types
export interface IGame extends Document {
    gameId: string;
    status: GameSessionStatus;
    players: GamePlayer[];
    gameSettings: GameSessionSettings;
    boardState: GameBoardState;
    gameRules: GameRules;
    metadata: GameMetadata;
    chat: ChatMessage[];
    updatedAt: Date;
    initializeBoard(): void;
    addPlayer(playerData: GamePlayerData): void;
    makeMove(playerId: Types.ObjectId, x: number, y: number, color: StoneColor): boolean;
    passTurn(playerId: Types.ObjectId, color: StoneColor): boolean;
    getGameState(): GameStateResponse;
    startGame(): void;
}

export type GameSessionStatus = 'waiting' | 'active' | 'paused' | 'completed' | 'abandoned';

export interface GamePlayer {
    playerId: Types.ObjectId;
    username: string;
    displayName: string;
    color: StoneColor;
    isReady: boolean;
    isConnected: boolean;
    lastSeen: Date;
    timeRemaining?: number;
    score: number;
    capturedStones: number;
}

export interface GameSessionSettings {
    boardSize: 9 | 13 | 19;
    timeControl: TimeControl;
    timeLimit?: number;
    handicap: number;
    komi: number;
    allowUndo: boolean;
    allowResign: boolean;
}

export interface GameBoardState {
    currentTurn: StoneColor;
    moveCount: number;
    lastMove?: LastMove;
    board: GameBoardCell[][];
    capturedStones: CapturedStones;
    moveHistory: GameMoveHistory[];
    consecutivePasses: number;
}

export interface GameBoardCell {
    stone: StoneColor | null;
    liberties: number;
    groupId?: string;
}

export interface GameMoveHistory {
    playerId: Types.ObjectId;
    color: StoneColor;
    x: number;
    y: number;
    timestamp: Date;
    capturedStones: CapturedPosition[];
    pass: boolean;
}

export interface GameRules {
    suicideAllowed: boolean;
    koRule: KoRule;
    scoringMethod: ScoringMethod;
}

export type KoRule = 'standard' | 'superko';
export type ScoringMethod = 'area' | 'territory';

export interface GameMetadata {
    createdBy: Types.ObjectId;
    createdAt: Date;
    startedAt?: Date;
    lastActivity: Date;
    spectators: Types.ObjectId[];
    maxSpectators: number;
}

export interface ChatMessage {
    playerId: Types.ObjectId;
    username: string;
    message: string;
    timestamp: Date;
    type: 'chat' | 'system';
}

export interface GamePlayerData {
    playerId: Types.ObjectId;
    username: string;
    displayName: string;
}

export interface GameStateResponse {
    gameId: string;
    status: GameSessionStatus;
    players: GamePlayerResponse[];
    gameSettings: GameSessionSettings;
    boardState: GameBoardStateResponse;
    metadata: GameMetadataResponse;
}

export interface GamePlayerResponse {
    playerId: Types.ObjectId;
    username: string;
    displayName: string;
    color: StoneColor;
    isReady: boolean;
    isConnected: boolean;
    timeRemaining?: number;
    score: number;
    capturedStones: number;
}

export interface GameBoardStateResponse {
    currentTurn: StoneColor;
    moveCount: number;
    lastMove?: LastMove;
    board: GameBoardCell[][];
    capturedStones: CapturedStones;
}

export interface GameMetadataResponse {
    createdAt: Date;
    startedAt?: Date;
    lastActivity: Date;
}

// Auth Types
export interface AuthRequest extends Request {
    player: IPlayer;
    token: string;
}

export interface JwtPayload {
    playerId: string;
    iat: number;
    exp: number;
}

// API Response Types
export interface ApiResponse<T = any> {
    message?: string;
    data?: T;
    error?: string;
    errors?: ValidationError[];
}

export interface PaginationResponse<T> {
    data: T[];
    pagination: PaginationInfo;
}

export interface PaginationInfo {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export interface ValidationError {
    field: string;
    message: string;
}

// Socket.IO Types
export interface SocketEvents {
    'join-game': (gameId: string) => void;
    'leave-game': (gameId: string) => void;
    'game-move': (data: GameMoveData) => void;
    'new-game-created': (data: NewGameData) => void;
    'player-joined': (data: PlayerJoinedData) => void;
    'player-ready': (data: PlayerReadyData) => void;
    'game-started': (data: GameStartedData) => void;
    'move-made': (data: MoveMadeData) => void;
    'turn-passed': (data: TurnPassedData) => void;
    'chat-message': (data: ChatMessageData) => void;
    'game-ended': (data: GameEndedData) => void;
    'game-deleted': (data: GameDeletedData) => void;
}

export interface GameMoveData {
    gameId: string;
    x: number;
    y: number;
    color: StoneColor;
}

export interface NewGameData {
    gameId: string;
    creator: string;
    settings: GameSessionSettings;
}

export interface PlayerJoinedData {
    gameId: string;
    player: {
        playerId: Types.ObjectId;
        username: string;
        displayName: string;
    };
}

export interface PlayerReadyData {
    gameId: string;
    playerId: Types.ObjectId;
    username: string;
}

export interface GameStartedData {
    gameId: string;
    gameState: GameStateResponse;
}

export interface MoveMadeData {
    gameId: string;
    move: {
        x: number;
        y: number;
        color: StoneColor;
        playerId: Types.ObjectId;
        username: string;
        timestamp: Date;
    };
    gameState: GameStateResponse;
}

export interface TurnPassedData {
    gameId: string;
    playerId: Types.ObjectId;
    username: string;
    color: StoneColor;
    gameState: GameStateResponse;
}

export interface ChatMessageData {
    gameId: string;
    message: {
        playerId: Types.ObjectId;
        username: string;
        message: string;
        timestamp: Date;
        type: 'chat' | 'system';
    };
}

export interface GameEndedData {
    gameId: string;
    reason: string;
    winner?: {
        playerId: Types.ObjectId;
        username: string;
        color: StoneColor;
    };
}

export interface GameDeletedData {
    gameId: string;
    reason: string;
}

// Express Request/Response Extensions
export interface AuthenticatedRequest extends Request {
    player: IPlayer;
    token: string;
}

export interface OptionalAuthRequest extends Request {
    player?: IPlayer;
    token?: string;
}
