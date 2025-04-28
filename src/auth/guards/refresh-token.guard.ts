import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable, from } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { mergeMap } from 'rxjs/operators';
import { extractTokenFromRequest } from '../../utils/token.utils';

@Injectable()
export class RefreshTokenGuard extends AuthGuard('refresh-token') {
    private readonly logger = new Logger(RefreshTokenGuard.name);

    constructor(
        private prisma: PrismaService
    ) {
        super();
    }

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        this.logger.debug('RefreshTokenGuard: Validating refresh token');

        const result$ = super.canActivate(context);

        if (typeof result$ === 'boolean') {
            return this.handleActivationResult(result$, context);
        }

        if (result$ instanceof Promise) {
            return result$.then(result => this.handleActivationResult(result, context));
        }

        return result$.pipe(
            mergeMap(result => from(this.handleActivationResult(result, context)))
        );
    }

    private async handleActivationResult(result: boolean, context: ExecutionContext): Promise<boolean> {
        if (result) {
            const request = context.switchToHttp().getRequest();
            const user = request.user;

            if (user) {
                try {
                    await this.validateTokenInDatabase(user, context);
                    return true;
                } catch (error) {
                    this.logger.error(`Token validation failed: ${error.message}`);
                    return false;
                }
            }
        }
        return result;
    }

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        if (err || !user) {
            const request = context.switchToHttp().getRequest();
            const token = extractTokenFromRequest(request);

            if (!token) {
                this.logger.warn('RefreshTokenGuard: No refresh token provided in request');
                throw new UnauthorizedException('Refresh token not provided');
            }

            if (info instanceof Error) {
                this.logger.error(`RefreshTokenGuard: ${info.message}`);
                throw new UnauthorizedException(`Invalid refresh token: ${info.message}`);
            }

            if (err) {
                this.logger.error(`RefreshTokenGuard: ${err.message}`);
                throw new UnauthorizedException(`Authentication error: ${err.message}`);
            }

            this.logger.warn('RefreshTokenGuard: User validation failed');
            throw new UnauthorizedException('Invalid refresh token');
        }

        return user;
    }

    private async validateTokenInDatabase(user: any, context: ExecutionContext): Promise<void> {
        const request = context.switchToHttp().getRequest();
        const refreshToken = extractTokenFromRequest(request);

        if (!refreshToken) {
            this.logger.warn('Token validation failed: Token not found in request');
            throw new UnauthorizedException('Refresh token not found in request');
        }

        const tokenRecord = await this.prisma.token.findFirst({
            where: {
                userId: user.userId,
                token: refreshToken,
                expiresAt: {
                    gt: new Date()
                }
            }
        });

        if (!tokenRecord) {
            this.logger.warn(`Token validation failed: No valid token found for user ${user.userId}`);
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
        
        this.logger.debug(`Token validation successful for user ${user.userId}`);
    }
}