import { IsEnum, IsOptional } from 'class-validator';

export enum PeriodType {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class PerformanceFilterDto {
  @IsEnum(PeriodType)
  @IsOptional()
  period: PeriodType = PeriodType.MONTHLY; // Default ke bulanan
}
