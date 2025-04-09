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
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.get('REFRESH_TOKEN_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {

    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      console.error('Refresh token not found in cookies during strategy validation');
      return null; 
    }
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      refreshToken 
    };
  }
}
