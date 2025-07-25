import { Controller, Get } from '@nestjs/common';

@Controller('app-update')
export class AppUpdateController {

  @Get('latest')
  getLatestVersion(){
    return {
      version_name : '1.0.1',
      version_code: 1,
      release_notes: 'Initial release',
      download_url: 'http://103.59.95.96:3000/uploads/app-release.apk',
    }
  }
}
