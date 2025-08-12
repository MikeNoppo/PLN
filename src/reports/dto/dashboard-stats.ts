export class MeterStatusStatsDto {
  rusak: number;
  optimal: number;
}

export class MeterTypeStatsDto {
  praBayar: number;
  pascaBayar: number;
}

export class DashboardStatsDto {
  meterStatus: MeterStatusStatsDto;
  meterTyper: MeterTypeStatsDto;
}
