import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { Game } from '../models/Game';
import { Player } from '../models/Player';
import { auth, AuthenticatedRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';

const router = Router();

// Create a new game
router.post('/', [
  body('boardSize').isIn([9, 13, 19]),
  body('timeControl').isIn(['None', 'Blitz', 'Rapid', 'Classical']),
  body('timeLimit').optional().isInt({ min: 1, max: 180 }),
  body('handicap').optional().isInt({ min: 0, max: 9 }),
  body('komi').optional().isFloat({ min: 0, max: 20 }),
  body('allowUndo').optional().isBoolean(),
  body('allowResign').optional().isBoolean()
], auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      boardSize,
      timeControl,
      timeLimit,
      handicap = 0,
      komi = 6.5,
      allowUndo = false,
      allowResign = true
    } = req.body;

    const game = new Game({
      gameId: uuidv4(),
      status: 'waiting',
      players: [],
      gameSettings: {
        boardSize,
        timeControl,
        timeLimit,
        handicap,
        komi,
        allowUndo,
        allowResign
      },
      gameRules: {
        suicideAllowed: false,
        koRule: 'standard',
        scoringMethod: 'territory'
      },
      metadata: {
        createdBy: req.player._id,
        createdAt: new Date(),
        lastActivity: new Date(),
        spectators: [],
        maxSpectators: 10
      }
    });

    // Add creator as first player
    game.addPlayer({
      playerId: req.player._id,
      username: req.player.username,
      displayName: req.player.displayName
    });

    await game.save();

    // Emit socket event for new game
    const io = req.app.get('io');
    if (io) {
      io.emit('new-game-created', {
        gameId: game.gameId,
        creator: req.player.username,
        settings: game.gameSettings
      });
    }

    res.status(201).json({
      message: 'Game created successfully',
      data: { game: game.getGameState() }
    });
  } catch (error) {
    console.error('Game creation error:', error);
    res.status(500).json({ error: 'Server error creating game' });
  }
});

// Get available games
router.get('/', [
  query('status').optional().isIn(['waiting', 'active', 'paused']),
  query('boardSize').optional().isIn([9, 13, 19]),
  query('timeControl').optional().isIn(['None', 'Blitz', 'Rapid', 'Classical']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const boardSize = parseInt(req.query.boardSize as string);
    const timeControl = req.query.timeControl as string;

    const skip = (page - 1) * limit;
    const filter: any = {};

    if (status) filter.status = status;
    if (boardSize) filter['gameSettings.boardSize'] = boardSize;
    if (timeControl) filter['gameSettings.timeControl'] = timeControl;

    const [games, total] = await Promise.all([
      Game.find(filter)
        .sort({ 'metadata.lastActivity': -1 })
        .skip(skip)
        .limit(limit)
        .populate('players.playerId', 'username displayName rank'),
      Game.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      message: 'Games retrieved successfully',
      data: games.map(game => game.getGameState()),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Games retrieval error:', error);
    res.status(500).json({ error: 'Server error retrieving games' });
  }
});

// Get game by ID
router.get('/:gameId', [
  param('gameId').notEmpty()
], async (req: Request, res: Response) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId })
      .populate('players.playerId', 'username displayName rank');

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({
      message: 'Game retrieved successfully',
      data: { game: game.getGameState() }
    });
  } catch (error) {
    console.error('Game retrieval error:', error);
    res.status(500).json({ error: 'Server error retrieving game' });
  }
});

// Join a game
router.post('/:gameId/join', [
  param('gameId').notEmpty()
], auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'waiting') {
      return res.status(400).json({ error: 'Game is not accepting players' });
    }

    if (game.players.length >= 2) {
      return res.status(400).json({ error: 'Game is full' });
    }

    // Check if player is already in the game
    const isAlreadyInGame = game.players.some(
      player => player.playerId.toString() === req.player._id.toString()
    );

    if (isAlreadyInGame) {
      return res.status(400).json({ error: 'You are already in this game' });
    }

    // Add player to game
    game.addPlayer({
      playerId: req.player._id,
      username: req.player.username,
      displayName: req.player.displayName
    });

    await game.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`game-${game.gameId}`).emit('player-joined', {
        gameId: game.gameId,
        player: {
          playerId: req.player._id,
          username: req.player.username,
          displayName: req.player.displayName
        }
      });
    }

    res.json({
      message: 'Joined game successfully',
      data: { game: game.getGameState() }
    });
  } catch (error) {
    console.error('Game join error:', error);
    res.status(500).json({ error: 'Server error joining game' });
  }
});

// Set player ready status
router.post('/:gameId/ready', [
  param('gameId').notEmpty()
], auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const player = game.players.find(
      p => p.playerId.toString() === req.player._id.toString()
    );

    if (!player) {
      return res.status(403).json({ error: 'You are not part of this game' });
    }

    player.isReady = true;
    await game.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`game-${game.gameId}`).emit('player-ready', {
        gameId: game.gameId,
        playerId: req.player._id,
        username: req.player.username
      });
    }

    // Check if both players are ready
    if (game.players.length === 2 && game.players.every(p => p.isReady)) {
      game.startGame();
      await game.save();

      if (io) {
        io.to(`game-${game.gameId}`).emit('game-started', {
          gameId: game.gameId,
          gameState: game.getGameState()
        });
      }
    }

    res.json({
      message: 'Player ready status updated',
      data: { game: game.getGameState() }
    });
  } catch (error) {
    console.error('Player ready error:', error);
    res.status(500).json({ error: 'Server error updating player ready status' });
  }
});

// Make a move
router.post('/:gameId/move', [
  param('gameId').notEmpty(),
  body('x').isInt({ min: 0 }),
  body('y').isInt({ min: 0 })
], auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { x, y } = req.body;
    const game = await Game.findOne({ gameId: req.params.gameId });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active' });
    }

    const player = game.players.find(
      p => p.playerId.toString() === req.player._id.toString()
    );

    if (!player) {
      return res.status(403).json({ error: 'You are not part of this game' });
    }

    // Make the move
    const moveSuccess = game.makeMove(req.player._id, x, y, player.color);
    
    if (!moveSuccess) {
      return res.status(400).json({ error: 'Invalid move' });
    }

    await game.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`game-${game.gameId}`).emit('move-made', {
        gameId: game.gameId,
        move: {
          x,
          y,
          color: player.color,
          playerId: req.player._id,
          username: req.player.username,
          timestamp: new Date()
        },
        gameState: game.getGameState()
      });
    }

    res.json({
      message: 'Move made successfully',
      data: { game: game.getGameState() }
    });
  } catch (error) {
    console.error('Move error:', error);
    res.status(500).json({ error: 'Server error making move' });
  }
});

// Pass turn
router.post('/:gameId/pass', [
  param('gameId').notEmpty()
], auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active' });
    }

    const player = game.players.find(
      p => p.playerId.toString() === req.player._id.toString()
    );

    if (!player) {
      return res.status(403).json({ error: 'You are not part of this game' });
    }

    // Pass turn
    const passSuccess = game.passTurn(req.player._id, player.color);
    
    if (!passSuccess) {
      return res.status(400).json({ error: 'Cannot pass turn' });
    }

    await game.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`game-${game.gameId}`).emit('turn-passed', {
        gameId: game.gameId,
        playerId: req.player._id,
        username: req.player.username,
        color: player.color,
        gameState: game.getGameState()
      });
    }

    res.json({
      message: 'Turn passed successfully',
      data: { game: game.getGameState() }
    });
  } catch (error) {
    console.error('Pass turn error:', error);
    res.status(500).json({ error: 'Server error passing turn' });
  }
});

// Send chat message
router.post('/:gameId/chat', [
  param('gameId').notEmpty(),
  body('message').isLength({ min: 1, max: 500 }).trim().escape()
], auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message } = req.body;
    const game = await Game.findOne({ gameId: req.params.gameId });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const player = game.players.find(
      p => p.playerId.toString() === req.player._id.toString()
    );

    if (!player) {
      return res.status(403).json({ error: 'You are not part of this game' });
    }

    // Add chat message
    game.chat.push({
      playerId: req.player._id,
      username: req.player.username,
      message,
      timestamp: new Date(),
      type: 'chat'
    });

    await game.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`game-${game.gameId}`).emit('chat-message', {
        gameId: game.gameId,
        message: {
          playerId: req.player._id,
          username: req.player.username,
          message,
          timestamp: new Date(),
          type: 'chat'
        }
      });
    }

    res.json({
      message: 'Chat message sent successfully',
      data: { message: game.chat[game.chat.length - 1] }
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Server error sending chat message' });
  }
});

// Resign from game
router.post('/:gameId/resign', [
  param('gameId').notEmpty()
], auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active' });
    }

    const player = game.players.find(
      p => p.playerId.toString() === req.player._id.toString()
    );

    if (!player) {
      return res.status(403).json({ error: 'You are not part of this game' });
    }

    // End game due to resignation
    game.status = 'completed';
    game.metadata.lastActivity = new Date();

    // Find winner (other player)
    const winner = game.players.find(
      p => p.playerId.toString() !== req.player._id.toString()
    );

    await game.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`game-${game.gameId}`).emit('game-ended', {
        gameId: game.gameId,
        reason: 'resignation',
        winner: winner ? {
          playerId: winner.playerId,
          username: winner.username,
          color: winner.color
        } : undefined
      });
    }

    res.json({
      message: 'Game resigned successfully',
      data: { game: game.getGameState() }
    });
  } catch (error) {
    console.error('Resign error:', error);
    res.status(500).json({ error: 'Server error resigning from game' });
  }
});

// Delete/abandon game
router.delete('/:gameId', [
  param('gameId').notEmpty()
], auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if player is creator or admin
    const isCreator = game.metadata.createdBy.toString() === req.player._id.toString();
    const isAdmin = req.player.rank === 'Master';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await Game.findByIdAndDelete(game._id);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`game-${game.gameId}`).emit('game-deleted', {
        gameId: game.gameId,
        reason: 'deleted by creator'
      });
    }

    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Game deletion error:', error);
    res.status(500).json({ error: 'Server error deleting game' });
  }
});

export default router;
