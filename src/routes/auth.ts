import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Player } from '../models/Player';
import { auth, AuthenticatedRequest } from '../middleware/auth';
import { IPlayer, JwtPayload } from '../types';

const router = Router();
const process = {
    env: {
        JWT_SECRET: 'secret',
        PORT: 3000
    }
}
// Register new player
router.post('/register', [
    body('username'),//.isLength({ min: 3, max: 20 }).trim().escape(),
    body('email'), // .isEmail().normalizeEmail(),
    body('password'), //.isLength({ min: 6 }),
    body('displayName') //.isLength({ min: 1, max: 30 }).trim().escape()
], async (req: Request, res: Response) => {
    try {
        console.log(JSON.stringify(req.body, null, 2));
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password, displayName } = req.body;

        // Check if user already exists
        const existingUser = await Player.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Create new player
        const player = new Player({
            username,
            email,
            password,
            displayName
        });

        await player.save();

        // Generate JWT token
        const token = jwt.sign(
            { playerId: player._id } as JwtPayload,
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        // Remove password from response
        const playerResponse = player.toObject();

        res.status(201).json({
            message: 'Player registered successfully',
            data: { player: playerResponse, token }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login player
router.post('/login', [
    body('username').notEmpty().trim().escape(),
    body('password').notEmpty()
], async (req: Request, res: Response) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        // Find player by username or email
        const player = await Player.findOne({
            $or: [{ username }, { email: username }]
        });

        if (!player) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isPasswordValid = await player.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last seen and online status
        player.isOnline = true;
        player.lastSeen = new Date();
        await player.save();

        // Generate JWT token
        const token = jwt.sign(
            { playerId: player._id } as JwtPayload,
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        // Remove password from response
        const playerResponse = player.toObject();

        res.json({
            message: 'Login successful',
            data: { player: playerResponse, token }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Get current player profile
router.get('/me', auth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const player = authReq.player;
        const playerResponse = player.toObject();
        delete playerResponse.password;

        res.json({
            message: 'Profile retrieved successfully',
            data: { player: playerResponse }
        });
    } catch (error) {
        console.error('Profile retrieval error:', error);
        res.status(500).json({ error: 'Server error retrieving profile' });
    }
});

// Update player profile
router.put('/profile', auth, [
    body('displayName').optional().isLength({ min: 1, max: 30 }).trim().escape(),
    body('avatar').optional().isURL(),
    body('preferences.boardSize').optional().isIn([9, 13, 19]),
    body('preferences.timeControl').optional().isIn(['None', 'Blitz', 'Rapid', 'Classical']),
    body('preferences.handicap').optional().isBoolean()
], async (req: Request, res: Response) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const updates = req.body;
        const authReq = req as AuthenticatedRequest;
        const player = authReq.player;

        // Update allowed fields
        if (updates.displayName) player.displayName = updates.displayName;
        if (updates.avatar) player.avatar = updates.avatar;
        if (updates.preferences) {
            if (updates.preferences.boardSize) player.preferences.boardSize = updates.preferences.boardSize;
            if (updates.preferences.timeControl) player.preferences.timeControl = updates.preferences.timeControl;
            if (updates.preferences.handicap !== undefined) player.preferences.handicap = updates.preferences.handicap;
        }

        await player.save();

        const playerResponse = player.toObject();
        delete playerResponse.password;

        res.json({
            message: 'Profile updated successfully',
            data: { player: playerResponse }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Server error updating profile' });
    }
});

// Change password
router.post('/change-password', auth, [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 })
], async (req: Request, res: Response) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { currentPassword, newPassword } = req.body;
        const authReq = req as AuthenticatedRequest;
        const player = authReq.player;

        // Verify current password
        const isCurrentPasswordValid = await player.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Update password
        player.password = newPassword;
        await player.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Server error changing password' });
    }
});

// Logout player
router.post('/logout', auth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const player = authReq.player;
        player.isOnline = false;
        player.lastSeen = new Date();
        await player.save();

        res.json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Server error during logout' });
    }
});

// Refresh JWT token
router.post('/refresh', auth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const player = authReq.player;

        // Generate new token
        const token = jwt.sign(
            { playerId: player._id } as JwtPayload,
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Token refreshed successfully',
            data: { token }
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Server error refreshing token' });
    }
});

export default router;
