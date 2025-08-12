import { Request } from 'express';

/**
 * Extracts token from multiple sources in the request
 * @param req Express Request object
 * @returns The token string or null if not found
 */
export const extractTokenFromRequest = (req: Request): string | null => {
  // Check cookies first
  if (req && req.cookies && req.cookies['refresh_token']) {
    return req.cookies['refresh_token'];
  }

  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
    return authHeader.split(' ')[1];
  }

  // Check request body
  if (req && req.body && req.body.refreshToken) {
    return req.body.refreshToken;
  }

  return null;
};
