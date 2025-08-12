import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { extractTokenFromRequest } from '../../utils/token.utils';
import { Logger } from '@nestjs/common';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'refresh-token',
) {
  private readonly logger = new Logger(RefreshTokenStrategy.name);

  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: extractTokenFromRequest,
      ignoreExpiration: false,
      secretOrKey: configService.get('REFRESH_TOKEN_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    // Use the same token extractor for consistency
    const refreshToken = extractTokenFromRequest(req);
    if (!refreshToken) {
      this.logger.error(
        'Refresh token not found in request during strategy validation',
      );
      return null;
    }
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      refreshToken,
    };
  }
}
