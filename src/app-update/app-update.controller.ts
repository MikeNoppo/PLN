import { Controller, Get } from '@nestjs/common';

@Controller('app-update')
export class AppUpdateController {
  @Get('latest')
  getLatestVersion() {
    return {
      version_name: '1.0.7',
      version_code: 7,
      release_notes: 'Memperbaiki masalah laporan dengan status DIPROSES tidak muncul di halaman petugas penyambungan',
      download_url: 'https://trackmel-pln.com/uploads/apps/app-release.apk',
    };
  }
}
