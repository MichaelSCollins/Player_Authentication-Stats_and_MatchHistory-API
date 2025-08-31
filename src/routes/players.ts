import { Router, Request, Response } from 'express';
import { query, param } from 'express-validator';
import { Player } from '../models/Player';
import { Match } from '../models/Match';
import { auth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all players with pagination and search
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim().escape(),
  query('rank').optional().isIn(['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master']),
  query('sort').optional().isIn(['username', 'rank', 'stats.gamesPlayed', 'stats.gamesWon', 'createdAt'])
], async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const rank = req.query.rank as string;
    const sort = req.query.sort as string || 'username';

    const skip = (page - 1) * limit;
    const filter: any = {};

    // Apply search filter
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }

    // Apply rank filter
    if (rank) {
      filter.rank = rank;
    }

    // Build sort object
    let sortObj: any = {};
    switch (sort) {
      case 'username':
        sortObj.username = 1;
        break;
      case 'rank':
        sortObj.rank = 1;
        break;
      case 'stats.gamesPlayed':
        sortObj['stats.gamesPlayed'] = -1;
        break;
      case 'stats.gamesWon':
        sortObj['stats.gamesWon'] = -1;
        break;
      case 'createdAt':
        sortObj.createdAt = -1;
        break;
      default:
        sortObj.username = 1;
    }

    const [players, total] = await Promise.all([
      Player.find(filter)
        .select('-password')
        .sort(sortObj)
        .skip(skip)
        .limit(limit),
      Player.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      message: 'Players retrieved successfully',
      data: players,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Players retrieval error:', error);
    res.status(500).json({ error: 'Server error retrieving players' });
  }
});

// Get leaderboard
router.get('/leaderboard', [
  query('type').optional().isIn(['wins', 'winRate', 'points', 'streak']),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string || 'wins';
    const limit = parseInt(req.query.limit as string) || 10;

    let sortObj: any = {};
    switch (type) {
      case 'wins':
        sortObj['stats.gamesWon'] = -1;
        break;
      case 'winRate':
        sortObj['stats.gamesPlayed'] = 1;
        break;
      case 'points':
        sortObj['stats.totalPoints'] = -1;
        break;
      case 'streak':
        sortObj['stats.bestWinStreak'] = -1;
        break;
      default:
        sortObj['stats.gamesWon'] = -1;
    }

    const players = await Player.find({ 'stats.gamesPlayed': { $gt: 0 } })
      .select('-password')
      .sort(sortObj)
      .limit(limit);

    // Calculate win rate for winRate leaderboard
    if (type === 'winRate') {
      players.sort((a, b) => {
        const aWinRate = a.getWinRate();
        const bWinRate = b.getWinRate();
        return bWinRate - aWinRate;
      });
    }

    res.json({
      message: 'Leaderboard retrieved successfully',
      data: {
        type,
        players: players.map(player => ({
          ...player.toObject(),
          winRate: player.getWinRate()
        }))
      }
    });
  } catch (error) {
    console.error('Leaderboard retrieval error:', error);
    res.status(500).json({ error: 'Server error retrieving leaderboard' });
  }
});

// Get player by ID
router.get('/:id', [
  param('id').isMongoId()
], async (req: Request, res: Response) => {
  try {
    const player = await Player.findById(req.params.id).select('-password');
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({
      message: 'Player retrieved successfully',
      data: { player }
    });
  } catch (error) {
    console.error('Player retrieval error:', error);
    res.status(500).json({ error: 'Server error retrieving player' });
  }
});

// Get player statistics
router.get('/:id/stats', [
  param('id').isMongoId()
], async (req: Request, res: Response) => {
  try {
    const player = await Player.findById(req.params.id).select('-password');
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get recent matches
    const recentMatches = await Match.find({
      'players.playerId': player._id
    })
    .sort({ 'metadata.startTime': -1 })
    .limit(10)
    .populate('players.playerId', 'username displayName');

    const stats = {
      ...player.stats,
      winRate: player.getWinRate(),
      recentMatches
    };

    res.json({
      message: 'Player statistics retrieved successfully',
      data: { stats }
    });
  } catch (error) {
    console.error('Player statistics error:', error);
    res.status(500).json({ error: 'Server error retrieving player statistics' });
  }
});

// Get player match history
router.get('/:id/matches', [
  param('id').isMongoId(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [matches, total] = await Promise.all([
      Match.find({
        'players.playerId': req.params.id
      })
      .sort({ 'metadata.startTime': -1 })
      .skip(skip)
      .limit(limit)
      .populate('players.playerId', 'username displayName'),
      Match.countDocuments({
        'players.playerId': req.params.id
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      message: 'Player match history retrieved successfully',
      data: matches,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Player match history error:', error);
    res.status(500).json({ error: 'Server error retrieving player match history' });
  }
});

// Update player rank (admin only)
router.put('/:id/rank', [
  param('id').isMongoId(),
  query('rank').isIn(['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master'])
], auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if current user is admin (you can add admin role logic here)
    if (req.player.rank !== 'Master') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const player = await Player.findByIdAndUpdate(
      req.params.id,
      { rank: req.query.rank },
      { new: true }
    ).select('-password');

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({
      message: 'Player rank updated successfully',
      data: { player }
    });
  } catch (error) {
    console.error('Player rank update error:', error);
    res.status(500).json({ error: 'Server error updating player rank' });
  }
});

// Get online players
router.get('/online/status', async (req: Request, res: Response) => {
  try {
    const onlinePlayers = await Player.find({ isOnline: true })
      .select('username displayName rank lastSeen')
      .sort({ lastSeen: -1 });

    res.json({
      message: 'Online players retrieved successfully',
      data: { onlinePlayers, count: onlinePlayers.length }
    });
  } catch (error) {
    console.error('Online players error:', error);
    res.status(500).json({ error: 'Server error retrieving online players' });
  }
});

export default router;
