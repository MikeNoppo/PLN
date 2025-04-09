import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => { // data can be string or undefined
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // If data is provided (e.g., 'refreshToken'), return that specific property.
    // Otherwise, return the whole user object.
    return data ? user?.[data] : user;
  },
);
