import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetUsersQueryDto } from './dto/users.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getUsers(query: GetUsersQueryDto) {
    const { role, search } = query;

    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          role ? { role } : {},
          search
            ? {
                OR: [
                  { username: { contains: search, mode: 'insensitive' } },
                  { name: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {},
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
        lastOnline: true,
      },
    });

    return {
      status: 200,
      message: 'Berhasil mengambil data users',
      data: users,
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
        lastOnline: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      status: 200,
      message: 'Berhasil mengambil data user',
      data: user,
    };
  }

  async deleteUser(id: string, currentUserId: string) {
    // Prevent self-deletion
    if (id === currentUserId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    // Get user details
    const userToDelete = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        name: true,
        username: true,
      },
    });

    if (!userToDelete) {
      throw new NotFoundException('User not found');
    }

    // If trying to delete an admin, ensure it's not the last one
    if (userToDelete.role === UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: { role: UserRole.ADMIN },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last admin user');
      }
    }

    // Delete all tokens for this user to force logout
    await this.prisma.token.deleteMany({
      where: { userId: id },
    });

    // Finally delete the user
    await this.prisma.user.delete({
      where: { id },
    });

    return {
      status: 200,
      message: 'Berhasil menghapus user',
      data: null,
    };
  }

  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUserId: string,
  ) {
    // Prevent updating own role
    if (id === currentUserId && updateUserDto.role) {
      throw new BadRequestException('Cannot change your own role');
    }

    // Get user details first
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If changing role and user is admin, ensure it's not the last admin
    if (updateUserDto.role && user.role === UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: { role: UserRole.ADMIN },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot change role of the last admin');
      }
    }

    // Prepare update data
    const updateData: any = { ...updateUserDto };

    // If password is provided, hash it
    if (updateUserDto.password) {
      updateData.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
        lastOnline: true,
      },
    });

    return {
      status: 200,
      message: 'Berhasil mengubah data user',
      data: updatedUser,
    };
  }
}
