  import { Controller, Get } from '@nestjs/common';

  @Controller('app-update')
  export class AppUpdateController {

    @Get('latest')
    getLatestVersion(){
      return {
        version_name : '1.0.2',
        version_code: 2,
        release_notes: 'Updated coook',
        download_url: 'http://103.59.95.96:3000/uploads/apps/app-release.apk',
      }
    }
  }
