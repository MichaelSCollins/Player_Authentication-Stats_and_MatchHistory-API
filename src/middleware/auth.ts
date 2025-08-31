import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { Player } from '../models/Player';
import { IPlayer, JwtPayload } from '../types';

export interface AuthenticatedRequest extends Request {
    player: IPlayer;
    token: string;
}

export interface OptionalAuthRequest extends Request {
    player?: IPlayer;
    token?: string;
}

export const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            res.status(401).json({ error: 'Access denied. No token provided.' });
            return;
        }

        const decoded = jwt.verify(token, process.env['JWT_SECRET'] || 'fallback-secret') as JwtPayload;
        const player = await Player.findById(decoded.playerId).select('-password');

        if (!player) {
            res.status(401).json({ error: 'Invalid token.' });
            return;
        }

        (req as AuthenticatedRequest).player = player;
        (req as AuthenticatedRequest).token = token;
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({ error: 'Invalid token.' });
            return;
        }
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({ error: 'Token expired.' });
            return;
        }
        res.status(500).json({ error: 'Server error.' });
    }
};

export const optionalAuth = async (req: OptionalAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (token) {
            const decoded = jwt.verify(token, process.env['JWT_SECRET'] || 'fallback-secret') as JwtPayload;
            const player = await Player.findById(decoded.playerId).select('-password');
            if (player) {
                req.player = player;
                req.token = token;
            }
        }

        next();
    } catch (error) {
        // Continue without authentication for optional routes
        next();
    }
};
