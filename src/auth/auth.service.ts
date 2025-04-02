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

    // Return the formatted response
    return {
      status: 200,
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
        secret: this.configService.get('REFRESH_TOKEN_SECRET'),
      });

      // Find potential token records for the user that haven't expired
      const userTokens = await this.prisma.token.findMany({
        where: {
          userId: payload.sub,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!userTokens || userTokens.length === 0) {
        throw new UnauthorizedException('No valid refresh tokens found for user.');
      }

      // Find the matching token by comparing the hash
      let matchedTokenRecord = null;
      for (const tokenRecord of userTokens) {
        const isMatch = await bcrypt.compare(refreshToken, tokenRecord.token);
        if (isMatch) {
          matchedTokenRecord = tokenRecord;
          break;
        }
      }

      if (!matchedTokenRecord) {
        throw new UnauthorizedException('Invalid refresh token provided.');
      }

      // --- Token Rotation ---
      //Delete the used refresh token
      await this.prisma.token.delete({
        where: { id: matchedTokenRecord.id },
      });

      //Find user details (needed for generating new tokens)
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


      const newTokens = await this.generateTokens(user.id, user.username, user.role);

      return {
        status: 200,
        message: "Token berhasil diperbarui",
        data: {
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token, // Return the new refresh token
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

    const rtExpiresIn = this.configService.get('RT_EXPIRES_IN') || '7d';
    const daysToAdd = parseInt(rtExpiresIn.replace('d', ''), 10) || 7;
    const expiresAt = add(new Date(), { days: daysToAdd });

    // Hash the refresh token before saving
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10); 

    await this.prisma.token.create({
      data: {
        token: hashedRefreshToken, // Store the hash
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
