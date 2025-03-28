import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { add } from 'date-fns';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }

  async register(registerDto: RegisterDto) {
    const { name, username, password, role } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      throw new ConflictException('User with this username already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = await this.prisma.user.create({
      data: {
        name,
        username,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });

    // Generate tokens for auto login after registration
    const tokens = await this.generateTokens(user.id, user.username, user.role);

    // Return the formatted response
    return {
      status: 200,
      message: "Berhasil Membuat Akun",
      data: {
        user_id: user.id,
        username: user.username,
        role: user.role,
        token: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token
        }
      }
    };
  }

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.username, user.role);

    // Update lastOnline
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastOnline: new Date() },
    });

    // Return the formatted response
    return {
      status: 200,
      message: "Login berhasil",
      data: {
        user_id: user.id,
        username: user.username,
        role: user.role,
        token: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token
        }
      }
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      // Verify token first
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('REFRESH_TOKEN_SECRET') || 'your-refresh-token-secret',
      });

      // Find token in database
      const tokenRecord = await this.prisma.token.findFirst({
        where: {
          token: refreshToken,
          userId: payload.sub,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!tokenRecord) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          username: true,
          role: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user.id, user.username, user.role);

      return {
        status: 200,
        message: "Token berhasil diperbarui",
        data: {
          access_token: accessToken
        }
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    // Delete all refresh tokens for the user
    await this.prisma.token.deleteMany({
      where: { userId },
    });

    return {
      status: 200,
      message: "Logout berhasil",
      data: null
    };
  }

  private async generateTokens(userId: string, username: string, role: UserRole) {
    // Generate access token
    const accessToken = this.generateAccessToken(userId, username, role);

    // Generate refresh token
    const refreshToken = this.jwtService.sign(
      { sub: userId, username, role },
      {
        secret: this.configService.get('REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get('RT_EXPIRES_IN'),
      },
    );

    // Calculate expiry date (7 days from now)
    const expiresAt = add(new Date(), { days: 7 });

    // Save refresh token to database
    await this.prisma.token.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private generateAccessToken(userId: string, username: string, role: UserRole) {
    return this.jwtService.sign(
      { sub: userId, username, role },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('AT_EXPIRES_IN'),
      }
    );
  }
}