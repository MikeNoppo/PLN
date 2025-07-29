  import { Controller, Get } from '@nestjs/common';

  @Controller('app-update')
  export class AppUpdateController {

    @Get('latest')
    getLatestVersion(){
      return {
        version_name : '1.0.3',
        version_code: 3,
        release_notes: 'Updated upload image from gallery',
        download_url: 'http://103.59.95.96:3000/uploads/apps/app-release.apk',
      }
    }
  }
