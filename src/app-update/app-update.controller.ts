  import { Controller, Get } from '@nestjs/common';

  @Controller('app-update')
  export class AppUpdateController {

    @Get('latest')
    getLatestVersion(){
      return {
        version_name : '1.0.3',
        version_code: 3,
        release_notes: 'Menambahkan fitur unggah foto petugas pada laporan Yantek dan Penyambungan',
        download_url: 'https://trackmel-pln.com/uploads/apps/app-release.apk',
      }
    }
  }
