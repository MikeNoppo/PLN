import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Request } from 'express'; 

interface JwtPayload{
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => request?.cookies?.access_token,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request ,payload: JwtPayload){
    // find user
    const user = await this.prisma.user.findUnique({
      where : { id: payload.sub },
      select : {
        id: true,
        username: true,
        name: true, 
        role: true,
      },
    });

    if (!user){
      this.logger.warn(`JWT validation failed for user ${payload.username} not found`);
      throw new UnauthorizedException('invalid token or user not found');
    }

    return{
      id : user.id,
      username : user.username,
      name: user.name,
      role : user.role,
    };
  }
}
