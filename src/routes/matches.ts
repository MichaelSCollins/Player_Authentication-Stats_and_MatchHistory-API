import { Router, Request, Response } from 'express';
import { query, param, body } from 'express-validator';
import { Match } from '../models/Match';
import { Player } from '../models/Player';
import { auth, AuthenticatedRequest } from '../middleware/auth';
import { Types } from 'mongoose';

const router = Router();

// Get all matches with filtering and pagination
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['active', 'completed', 'abandoned', 'resigned']),
  query('playerId').optional().isMongoId(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const playerId = req.query.playerId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const skip = (page - 1) * limit;
    const filter: any = {};

    // Apply filters
    if (status) filter['gameState.status'] = status;
    if (playerId) filter['players.playerId'] = new Types.ObjectId(playerId);
    if (startDate || endDate) {
      filter['metadata.startTime'] = {};
      if (startDate) filter['metadata.startTime'].$gte = new Date(startDate);
      if (endDate) filter['metadata.startTime'].$lte = new Date(endDate);
    }

    const [matches, total] = await Promise.all([
      Match.find(filter)
        .sort({ 'metadata.startTime': -1 })
        .skip(skip)
        .limit(limit)
        .populate('players.playerId', 'username displayName'),
      Match.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      message: 'Matches retrieved successfully',
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
    console.error('Matches retrieval error:', error);
    res.status(500).json({ error: 'Server error retrieving matches' });
  }
});

// Get match by ID
router.get('/:id', [
  param('id').isMongoId()
], async (req: Request, res: Response) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('players.playerId', 'username displayName rank');

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({
      message: 'Match retrieved successfully',
      data: { match }
    });
  } catch (error) {
    console.error('Match retrieval error:', error);
    res.status(500).json({ error: 'Server error retrieving match' });
  }
});

// Get match moves history
router.get('/:id/moves', [
  param('id').isMongoId()
], async (req: Request, res: Response) => {
  try {
    const match = await Match.findById(req.params.id).select('moves gameState.board gameState.currentTurn');

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({
      message: 'Match moves retrieved successfully',
      data: {
        moves: match.moves,
        currentBoard: match.gameState.board,
        currentTurn: match.gameState.currentTurn
      }
    });
  } catch (error) {
    console.error('Match moves error:', error);
    res.status(500).json({ error: 'Server error retrieving match moves' });
  }
});

// End a match
router.post('/:id/end', [
  param('id').isMongoId(),
  body('winnerId').isMongoId(),
  body('endReason').isIn(['resignation', 'timeout', 'normal', 'abandoned']),
  body('finalScores.black').isNumeric(),
  body('finalScores.white').isNumeric()
], auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Check if current player is part of the match
    const isPlayerInMatch = match.players.some(
      player => player.playerId.toString() === req.player._id.toString()
    );
    
    if (!isPlayerInMatch) {
      return res.status(403).json({ error: 'You are not part of this match' });
    }

    const { winnerId, endReason, finalScores } = req.body;

    // End the game
    match.endGame(endReason, new Types.ObjectId(winnerId), finalScores);
    await match.save();

    // Update player stats
    const winner = await Player.findById(winnerId);
    const loser = await Player.findById(
      match.players.find(p => p.playerId.toString() !== winnerId)?.playerId
    );

    if (winner) {
      winner.updateStats('win', finalScores[winner.color] || 0);
      await winner.save();
    }

    if (loser) {
      loser.updateStats('loss', finalScores[loser.color] || 0);
      await loser.save();
    }

    res.json({
      message: 'Match ended successfully',
      data: { match }
    });
  } catch (error) {
    console.error('Match end error:', error);
    res.status(500).json({ error: 'Server error ending match' });
  }
});

// Get overall match statistics
router.get('/statistics/overview', async (req: Request, res: Response) => {
  try {
    const [totalMatches, completedMatches, activeMatches] = await Promise.all([
      Match.countDocuments(),
      Match.countDocuments({ 'gameState.status': 'completed' }),
      Match.countDocuments({ 'gameState.status': 'active' })
    ]);

    const avgDuration = await Match.aggregate([
      { $match: { 'metadata.duration': { $exists: true } } },
      { $group: { _id: null, avgDuration: { $avg: '$metadata.duration' } } }
    ]);

    res.json({
      message: 'Match statistics retrieved successfully',
      data: {
        totalMatches,
        completedMatches,
        activeMatches,
        averageDuration: avgDuration[0]?.avgDuration || 0
      }
    });
  } catch (error) {
    console.error('Match statistics error:', error);
    res.status(500).json({ error: 'Server error retrieving match statistics' });
  }
});

// Get player match statistics
router.get('/statistics/player/:playerId', [
  param('playerId').isMongoId()
], async (req: Request, res: Response) => {
  try {
    const playerId = new Types.ObjectId(req.params.playerId);

    const [totalMatches, wins, losses, draws] = await Promise.all([
      Match.countDocuments({ 'players.playerId': playerId }),
      Match.countDocuments({ 
        'players.playerId': playerId, 
        'result.winner': playerId 
      }),
      Match.countDocuments({ 
        'players.playerId': playerId, 
        'result.winner': { $ne: playerId },
        'gameState.status': 'completed'
      }),
      Match.countDocuments({ 
        'players.playerId': playerId, 
        'gameState.status': 'completed',
        $and: [
          { 'result.winner': { $ne: playerId } },
          { 'result.winner': { $exists: false } }
        ]
      })
    ]);

    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

    res.json({
      message: 'Player match statistics retrieved successfully',
      data: {
        totalMatches,
        wins,
        losses,
        draws,
        winRate: Math.round(winRate * 100) / 100
      }
    });
  } catch (error) {
    console.error('Player match statistics error:', error);
    res.status(500).json({ error: 'Server error retrieving player match statistics' });
  }
});

// Delete a match (admin only)
router.delete('/:id', [
  param('id').isMongoId()
], auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if current user is admin
    if (req.player.rank !== 'Master') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const match = await Match.findByIdAndDelete(req.params.id);
    
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ message: 'Match deleted successfully' });
  } catch (error) {
    console.error('Match deletion error:', error);
    res.status(500).json({ error: 'Server error deleting match' });
  }
});

export default router;
