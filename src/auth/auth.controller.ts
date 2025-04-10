import { Controller, Post, Body, UseGuards, Get, Res, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto'; 
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { User } from './decorators/user.decorator';
import { RolesGuard } from './guards/roles.guard';
import { UserRole } from '@prisma/client';
import { Roles } from './decorators/roles.decorators';
import { Throttle } from '@nestjs/throttler';
import { getCookieConfig, setAuthCookies } from '../utils/cookie.utils';

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

    const cookieConfig = getCookieConfig(this.authService['configService']);
    
    setAuthCookies(
      response,
      loginResult?.data?.token?.access_token,
      loginResult?.data?.token?.refresh_token,
      cookieConfig
    );

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

    const cookieConfig = getCookieConfig(this.authService['configService']);
    
    setAuthCookies(
      response,
      refreshResult?.data?.access_token,
      refreshResult?.data?.refresh_token,
      cookieConfig
    );

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

  // --- Mobile Endpoints --

  @Post('mobile/login')
  async mobileLogin(@Body() loginDto: LoginDto) {
    const loginResult = await this.authService.login(loginDto);
    return {
      status: HttpStatus.OK,
      message: "Login berhasil",
      data: {
        user_id: loginResult.data.user_id,
        username: loginResult.data.username,
        role: loginResult.data.role,
        access_token: loginResult.data.token.access_token,
        refresh_token: loginResult.data.token.refresh_token,
      }
    };
  }

  @Post('mobile/refresh')
  async mobileRefreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided in body');
    }
    const refreshResult = await this.authService.refreshToken(refreshToken);
    return {
      status: HttpStatus.OK,
      message: "Token berhasil diperbarui",
      data: {
        access_token: refreshResult.data.access_token,
        refresh_token: refreshResult.data.refresh_token,
      }
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('mobile/logout')
  async mobileLogout(@User() user: { userId: string; username: string }) {
    await this.authService.logout(user.userId);
    return {
        status: HttpStatus.OK,
        message: "Logout berhasil",
        data: null
    };
  }
}
