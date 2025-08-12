import { Controller, Get } from '@nestjs/common';

@Controller('app-update')
export class AppUpdateController {
  @Get('latest')
  getLatestVersion() {
    return {
      version_name: '1.0.6',
      version_code: 6,
      release_notes: 'memperbaiki form input pulsa dan stand meter',
      download_url: 'https://trackmel-pln.com/uploads/apps/app-release.apk',
    };
  }
}
