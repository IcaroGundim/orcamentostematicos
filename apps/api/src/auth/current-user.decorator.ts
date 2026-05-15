import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../common/domain';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): User => {
  return context.switchToHttp().getRequest<{ user: User }>().user;
});
