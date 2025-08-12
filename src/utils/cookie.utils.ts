import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Converts a duration string (e.g., '1h', '7d', '30m') to milliseconds.
 * @param duration The duration string.
 * @param defaultMs The default value in milliseconds if duration is invalid or missing.
 * @returns The duration in milliseconds.
 */
export const getDurationInMs = (
  duration: string | undefined | null,
  defaultMs: number,
): number => {
  if (!duration) return defaultMs;
  const value = parseInt(duration);
  if (isNaN(value)) return defaultMs; // Handle cases like "invalid"

  if (duration.includes('d')) return value * 24 * 3600000; // days to ms
  if (duration.includes('h')) return value * 3600000; // hours to ms
  if (duration.includes('m')) return value * 60000; // minutes to ms
  if (duration.includes('s')) return value * 1000; // seconds to ms (added for completeness)

  // If no unit, assume milliseconds or return default
  return value; // Or return defaultMs if unitless numbers are not desired
};

export interface CookieConfig {
  atExpiresIn: string;
  rtExpiresIn: string;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none' | boolean;
}

/**
 * Gets cookie configuration from environment variables
 * @param configService NestJS ConfigService instance
 * @returns CookieConfig object with cookie settings
 */
export const getCookieConfig = (configService: ConfigService): CookieConfig => {
  return {
    atExpiresIn: configService.get('AT_EXPIRES_IN') || '1h',
    rtExpiresIn: configService.get('RT_EXPIRES_IN') || '7d',
    secure: configService.get('COOKIE_SECURE') === 'true',
    sameSite: configService.get('COOKIE_SAME_SITE') || 'lax',
  };
};

/**
 * Sets httpOnly access and refresh token cookies on the response.
 * @param response The express Response object.
 * @param accessToken The access token string.
 * @param refreshToken The refresh token string.
 * @param config Cookie configuration options.
 */
export const setAuthCookies = (
  response: Response,
  accessToken: string | undefined,
  refreshToken: string | undefined,
  config: CookieConfig,
): void => {
  if (!accessToken || !refreshToken) {
    console.error('Missing access or refresh token, cannot set cookies.');
    return;
  }

  const atExpiresInMs = getDurationInMs(config.atExpiresIn, 3600000);
  const rtExpiresInMs = getDurationInMs(config.rtExpiresIn, 7 * 24 * 3600000);

  response.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: config.secure,
    sameSite: config.sameSite,
    path: '/',
    expires: new Date(Date.now() + atExpiresInMs),
  });

  response.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: config.secure,
    sameSite: config.sameSite,
    path: '/',
    expires: new Date(Date.now() + rtExpiresInMs),
  });
};
