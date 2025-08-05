  import { Controller, Get } from '@nestjs/common';

  @Controller('app-update')
  export class AppUpdateController {

    @Get('latest')
    getLatestVersion(){
      return {
        version_name : '1.0.4',
        version_code: 4,
        release_notes: 'Update API call to new DNS',
        download_url: 'https://trackmel-pln.com/uploads/apps/app-release.apk',
      }
    }
  }
