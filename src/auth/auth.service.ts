import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { add } from 'date-fns';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
      throw new ConflictException('Akun dengan nama ini sudah terdaftar');
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

    // Return the formatted response
    return {
      status: 201,
      message: "Berhasil Membuat Akun",
      data: {
        user_id: user.id,
        username: user.username,
        role: user.role,
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
      throw new UnauthorizedException('Tidak ada akun dengan username ini');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Password salah');
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
        fullname: user.name,
        role: user.role,
        token: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token
        }
      }
    };
  }
  async refreshToken(refreshToken: string) {
    
    if (!refreshToken) {
      this.logger.warn('Refresh token not provided in request');
      throw new UnauthorizedException('Refresh token not found in request');
    }

    try {
      // Verify token first
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('REFRESH_TOKEN_SECRET'),
      });

      // Find user token that haven't expired
      const userTokens = await this.prisma.token.findMany({
        where: {
          userId: payload.sub,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!userTokens || userTokens.length === 0) {
        this.logger.warn(`No valid refresh tokens found for user ${payload.sub}`);
        throw new UnauthorizedException('No valid refresh tokens found for user.');
      }

      let matchedTokenRecord = null;
      for (const tokenRecord of userTokens) {
        if (tokenRecord.token === refreshToken) {
          matchedTokenRecord = tokenRecord;
          break;
        }
      }

      if (!matchedTokenRecord) {
        this.logger.warn(`Refresh token does not match any stored tokens for user ${payload.sub}`);
        throw new UnauthorizedException('Invalid refresh token provided.');
      }

      // Fetch user info before transaction
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          username: true,
          role: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User associated with token not found.');
      }

      // --- Token Rotation (atomic) ---
      const refreshTokenValue = this.jwtService.sign(
        { sub: user.id, username: user.username, role: user.role },
        {
          secret: this.configService.get('REFRESH_TOKEN_SECRET'),
          expiresIn: this.configService.get('RT_EXPIRES_IN'),
        }
      );
      const rtExpiresIn = this.configService.get('RT_EXPIRES_IN') || '7d';
      const daysToAdd = parseInt(rtExpiresIn.replace('d', ''), 10) || 7;
      const expiresAt = add(new Date(), { days: daysToAdd });

      await this.prisma.$transaction(async (tx) => {
        // First check if the token still exists before attempting to delete
        const tokenStillExists = await tx.token.findUnique({
          where: { id: matchedTokenRecord.id },
        });
        
        // Only attempt to delete if the token still exists
        if (tokenStillExists) {
          await tx.token.delete({
            where: { id: matchedTokenRecord.id },
          });
        }
        
        // Create new token regardless
        await tx.token.create({
          data: {
            token: refreshTokenValue,
            userId: user.id,
            expiresAt,
          },
        });
      });

      const newTokens = await this.generateTokens(user.id, user.username, user.role);

      return {
        status: 200,
        message: "Token berhasil diperbarui",
        data: {
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
        }
      };
    } catch (error) {
      // Log the specific error for better debugging
      console.error('Error during refreshToken:', error);
      if (error instanceof UnauthorizedException) {
        throw error; // Re-throw known unauthorized errors
      }
      // Throw a generic error for unexpected issues (like JWT verification failure)
      throw new UnauthorizedException('Invalid refresh token'); // Mask detailed error message
    }
  }

  async logout(userId: string) {
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
    const accessToken = this.generateAccessToken(userId, username, role);

    const refreshToken = this.jwtService.sign(
      { sub: userId, username, role },
      {
        secret: this.configService.get('REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get('RT_EXPIRES_IN'),
      },
    );

    const rtExpiresIn = this.configService.get('RT_EXPIRES_IN') || '7d';
    const daysToAdd = parseInt(rtExpiresIn.replace('d', ''), 10) || 7;
    const expiresAt = add(new Date(), { days: daysToAdd });

    await this.prisma.$transaction(async (tx) => {
      // Delete existing tokens for the user
      await tx.token.deleteMany({
        where: { userId },
      });

      // Create the new refresh token record
      await tx.token.create({
        data: {
          token: refreshToken,
          userId,
          expiresAt,
        },
      });
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
