import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

// Helper function to extract token from cookies
const cookieExtractor = (req: Request): string | null => {
  let token = null;
  if (req && req.cookies) {
    token = req.cookies['refresh_token'];
  }
  return token;
};

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'refresh-token') {
  constructor(private configService: ConfigService) {
    super({
      // Use the custom extractor function
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.get('REFRESH_TOKEN_SECRET'),
      passReqToCallback: true, // Keep true to access the request object
    });
  }

  async validate(req: Request, payload: any) {
    // Extract the token from cookies again for returning it if needed
    const refreshToken = req.cookies?.refresh_token;
    // Ensure token exists, otherwise Passport might throw an error before validate is called
    // but double-checking here is safe.
    if (!refreshToken) {
      // This case should ideally be handled by Passport if cookieExtractor returns null,
      // but adding an explicit check can prevent potential issues.
      // Consider throwing UnauthorizedException if needed, though Passport should handle it.
      console.error('Refresh token not found in cookies during validation');
      return null; // Or throw an exception
    }
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      refreshToken // Return the extracted token
    };
  }
}
