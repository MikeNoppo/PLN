import { Controller, Post, Body, UseGuards, Get, Res, HttpStatus } from '@nestjs/common';
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

    // Set cookies
    response.cookie('access_token', loginResult.tokens.access_token, {
      httpOnly: true,
      secure: this.authService['configService'].get('NODE_ENV') === 'production', // Access configService indirectly or inject it
      sameSite: 'strict',
      path: '/',
      // Consider setting expires based on AT_EXPIRES_IN from config
    });

    response.cookie('refresh_token', loginResult.tokens.refresh_token, {
      httpOnly: true,
      secure: this.authService['configService'].get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/auth/refresh', // Scope refresh token cookie to refresh path
      // Consider setting expires based on RT_EXPIRES_IN from config
    });

    // Return user data in the body (without tokens)
    return {
        status: HttpStatus.OK,
        message: "Login berhasil",
        data: {
            user_id: loginResult.user.userId,
            username: loginResult.user.username,
            role: loginResult.user.role,
        }
    };
  }

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  async refreshTokens(@User('refreshToken') refreshToken: string, @Res({ passthrough: true }) response: Response) {
    // Note: Assuming RefreshTokenGuard puts the validated token string into req.user.refreshToken
    // If not, adjust how refreshToken is obtained (e.g., from Body if guard doesn't modify request)
    const refreshResult = await this.authService.refreshToken(refreshToken);

     // Set cookies for new tokens
     response.cookie('access_token', refreshResult.data.access_token, {
      httpOnly: true,
      secure: this.authService['configService'].get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
    });

    response.cookie('refresh_token', refreshResult.data.refresh_token, {
      httpOnly: true,
      secure: this.authService['configService'].get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
    });

    // Return success message (tokens are in cookies now)
    return {
      status: HttpStatus.OK,
      message: "Token berhasil diperbarui",
      data: null // Or minimal confirmation if needed
    };
  }


  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@User() user: { userId: string; username: string }, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.logout(user.userId);
    // Clear cookies
    response.clearCookie('access_token', { path: '/' });
    response.clearCookie('refresh_token', { path: '/auth/refresh' });
    return result; // Return the original logout message { status: 200, message: "Logout berhasil", data: null }
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
