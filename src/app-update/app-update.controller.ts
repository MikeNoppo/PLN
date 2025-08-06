  import { Controller, Get } from '@nestjs/common';

  @Controller('app-update')
  export class AppUpdateController {

    @Get('latest')
    getLatestVersion(){
      return {
        version_name : '1.0.5',
        version_code: 5,
        release_notes: 'Memperbaiki Masalah google Maps, dan upl, menambahkan pemilihan sumber foto di kedua petugas Yantek dan petugas penyambungan.',
        download_url: 'https://trackmel-pln.com/uploads/apps/app-release.apk',
      }
    }
  }
