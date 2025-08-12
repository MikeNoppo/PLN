import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportIdService {
  private async generateLaporanId(
    type: 'YT' | 'PS',
    prismaClient: Prisma.TransactionClient | PrismaService,
  ): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `${type}${year}${month}`;
    const startRange = prefix + '0000';
    const endRange = prefix + '9999';

    const tableName = type === 'YT' ? 'LaporanYantek' : 'LaporanPenyambungan';

    const query = Prisma.sql`
      SELECT id
      FROM ${Prisma.raw(`"${tableName}"`)}
      WHERE id >= ${startRange}
        AND id <= ${endRange}
      ORDER BY id DESC
      LIMIT 1`;

    const lastReport = await prismaClient.$queryRaw<Array<{ id: string }>>(query);

    let sequence = 1;
    if (lastReport.length > 0) {
      const lastSequence = parseInt(lastReport[0].id.slice(-4));
      sequence = lastSequence + 1;
    }

    if (sequence > 9999) {
      throw new Error(`Sequence limit exceeded for ${prefix}`);
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  async getNextId(
    type: 'YT' | 'PS',
    prismaClient: Prisma.TransactionClient | PrismaService,
  ): Promise<string> {
    const newId = await this.generateLaporanId(type, prismaClient);
    return newId;
  }
}
