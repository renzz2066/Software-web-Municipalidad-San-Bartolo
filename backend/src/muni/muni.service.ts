import { Injectable } from '@nestjs/common';
import { contextoMuni, leerRegistro, type Muni, type Registro } from './muni.registro.js';

@Injectable()
export class MuniService {
  // Se lee al arrancar: si falta la URL de una muni activa, Nest no levanta y dice cuál.
  readonly registro: Registro = leerRegistro();

  // Fuera de una petición (arranque, scripts) se usa la muni por defecto.
  actual(): Muni {
    return contextoMuni.getStore() ?? this.registro.defecto;
  }
}
