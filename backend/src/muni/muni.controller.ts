import { Controller, Get } from '@nestjs/common';
import { aPublica } from './muni.registro.js';
import { MuniService } from './muni.service.js';

@Controller('muni')
export class MuniController {
  constructor(private readonly munis: MuniService) {}

  // Público: el login lo necesita antes de haber sesión. Nunca expone hosts ni la URL de la base.
  @Get('config')
  config() {
    return aPublica(this.munis.actual());
  }
}
