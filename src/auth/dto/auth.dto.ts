import { IsNotEmpty, IsString, MinLength, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}

export class RefreshTokenDto {
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}