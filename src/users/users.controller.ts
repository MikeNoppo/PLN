import { Controller, Get, Delete, Query, Param, UseGuards,} from '@nestjs/common';
import { UsersService } from './users.service';
import { GetUsersQueryDto } from './dto/users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { UserRole } from '@prisma/client';
import { User } from '../auth/decorators/user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getUsers(@Query() query: GetUsersQueryDto) {
    return this.usersService.getUsers(query);
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.usersService.getUser(id);
  }

  @Delete(':id')
  deleteUser(@Param('id') id: string, @User('userId') currentUserId: string) {
    return this.usersService.deleteUser(id, currentUserId);
  }
}
