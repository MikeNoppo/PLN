import { Controller, Post, Body, UseGuards, Get, Res, HttpStatus, UnauthorizedException } from '@nestjs/common'; 
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto'; 
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { User } from './decorators/user.decorator';
import { RolesGuard } from './guards/roles.guard';
import { UserRole } from '@prisma/client';
import { Roles } from './decorators/roles.decorators';
import { Throttle } from '@nestjs/throttler';
import { getDurationInMs } from '../utils/duration.utils'; 

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const loginResult = await this.authService.login(loginDto);

    const atExpiresIn = this.authService['configService']?.get('AT_EXPIRES_IN') || '1h'; 
    const rtExpiresIn = this.authService['configService']?.get('RT_EXPIRES_IN') || '7d'; 
    const nodeEnv = this.authService['configService']?.get('NODE_ENV');

    const atExpiresInMs = getDurationInMs(atExpiresIn, 3600000); 
    const rtExpiresInMs = getDurationInMs(rtExpiresIn, 7 * 24 * 3600000); 


    if (loginResult?.data?.token?.access_token) {
      response.cookie('access_token', loginResult.data.token.access_token, {
        httpOnly: true,
        secure: nodeEnv === 'production',
        sameSite: 'lax', // Or 'strict'
        path: '/',
        expires: new Date(Date.now() + atExpiresInMs)
      });
    } else {
      console.error('Access Token is missing, cannot set cookie.');
    }

    if (loginResult?.data?.token?.refresh_token) {
      response.cookie('refresh_token', loginResult.data.token.refresh_token, {
        httpOnly: true,
        secure: nodeEnv === 'production',
        sameSite: 'lax', // Or 'strict'
        path: '/', 
        expires: new Date(Date.now() + rtExpiresInMs)
      });
    } else {
      console.error('Refresh Token is missing, cannot set cookie.');
    }

    return {
        status: HttpStatus.OK, 
        message: "Login berhasil",
        data: {
            user_id: loginResult.data.user_id,
            username: loginResult.data.username,
            role: loginResult.data.role,
        }
    };
  }

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  async refreshTokens(@User('refreshToken') refreshToken: string, @Res({ passthrough: true }) response: Response) {
    if (!refreshToken) {
       // This case might happen if the guard allows request through but strategy returns null/undefined user
       // Or if the @User decorator fails.
       throw new UnauthorizedException('Refresh token not found in request'); 
    }
    const refreshResult = await this.authService.refreshToken(refreshToken);

    const nodeEnv = this.authService['configService']?.get('NODE_ENV');
    const atExpiresIn = this.authService['configService']?.get('AT_EXPIRES_IN') || '1h';
    const rtExpiresIn = this.authService['configService']?.get('RT_EXPIRES_IN') || '7d';

    const atExpiresInMs = getDurationInMs(atExpiresIn, 3600000);
    const rtExpiresInMs = getDurationInMs(rtExpiresIn, 7 * 24 * 3600000);

     response.cookie('access_token', refreshResult.data.access_token, {
      httpOnly: true,
      secure: nodeEnv === 'production',
      sameSite: 'lax', // Or 'strict'
      path: '/',
      expires: new Date(Date.now() + atExpiresInMs)
    });

    response.cookie('refresh_token', refreshResult.data.refresh_token, {
      httpOnly: true,
      secure: nodeEnv === 'production',
      sameSite: 'lax', // Or 'strict'
      path: '/', 
      expires: new Date(Date.now() + rtExpiresInMs)
    });

    return {
      status: HttpStatus.OK,
      message: "Token berhasil diperbarui",
      data: null
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@User() user: { userId: string; username: string }, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(user.userId);
    response.clearCookie('access_token', { path: '/' });
    response.clearCookie('refresh_token', { path: '/' }); 
    return {
        status: HttpStatus.OK,
        message: "Logout berhasil",
        data: null
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@User() user: { userId: string; username: string; role: string }) {
    return {
      userId: user.userId,
      username: user.username,
      role: user.role
    };
  }
}
