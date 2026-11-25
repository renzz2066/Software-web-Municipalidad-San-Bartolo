import { EstadoGestionCobranza } from '@prisma/client';
import { ErrorCsv, leerPuntajesCsv, separarCsv } from './cobranza.csv.js';
import { concentracionTop, motivoGestionInvalida } from './cobranza.reglas.js';

const CABECERA =
  'anio,prioridad,tramo,CODCLI,grupo_pred,p_puntual,p_tardio,p_incobrable,deuda_anio,deuda_pendiente,deuda_esperada,accion';
const FILA1 = '2025,1,A,0003325,Incobrable,0.3,0.2865,0.4135,460199.04,660357.76,72685.13,"Gestión intensiva (llamada, visita, OP/RD)"';
const FILA2 = '2025,2,C,0004526,Tardío,0.2,0.7,0.1,500,0,19.1,Recordatorio por SMS';

const csv = (...filas: string[]) => '﻿' + [CABECERA, ...filas].join('\r\n') + '\r\n';

describe('separarCsv', () => {
  it('respeta comas dentro de comillas y comillas dobladas', () => {
    expect(separarCsv('a,"b, c","d ""e"""\n1,2,3')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '2', '3'],
    ]);
  });

  it('rechaza comillas sin cerrar', () => {
    expect(() => separarCsv('a,"b\n1,2')).toThrow(ErrorCsv);
  });
});

describe('leerPuntajesCsv — salida de 05_puntajes.py', () => {
  it('lee filas válidas (BOM, CRLF, acción con comas y grupo con tilde)', () => {
    const filas = leerPuntajesCsv(csv(FILA1, FILA2));
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({
      anio: 2025,
      prioridad: 1,
      tramo: 'A',
      codigoLegacy: '0003325',
      grupo: 'INCOBRABLE',
      accion: 'Gestión intensiva (llamada, visita, OP/RD)',
    });
    expect(filas[1].grupo).toBe('TARDIO');
  });

  it('exige todas las columnas', () => {
    expect(() => leerPuntajesCsv('anio,prioridad\n2025,1')).toThrow(/Faltan columnas: tramo/);
  });

  it('rechaza un archivo solo con cabecera', () => {
    expect(() => leerPuntajesCsv(CABECERA)).toThrow(/vacío/);
  });

  it.each([
    ['probabilidades que no suman 1', FILA2.replace('0.7,0.1', '0.7,0.3'), /no suman 1/],
    ['CODCLI que no es de 7 dígitos', FILA2.replace('0004526', '4526'), /7 dígitos/],
    ['tramo fuera de A/B/C', FILA2.replace(',C,', ',D,'), /tramo/],
    ['grupo desconocido', FILA2.replace('Tardío', 'Moroso'), /grupo desconocido/],
    ['número inválido', FILA2.replace('500,', 'abc,'), /no es un número/],
  ])('señala la fila con %s', (_caso, fila, mensaje) => {
    expect(() => leerPuntajesCsv(csv(FILA1, fila))).toThrow(mensaje);
    expect(() => leerPuntajesCsv(csv(FILA1, fila))).toThrow(/Fila 3/);
  });

  it('rechaza CODCLI o prioridad repetidos', () => {
    expect(() => leerPuntajesCsv(csv(FILA1, FILA1.replace(',1,A,', ',5,A,')))).toThrow(/repetido/);
    expect(() => leerPuntajesCsv(csv(FILA1, FILA2.replace(',2,C,', ',1,C,')))).toThrow(/repetida/);
  });

  it('rechaza un archivo con varios años', () => {
    expect(() => leerPuntajesCsv(csv(FILA1, FILA2.replace('2025,', '2024,')))).toThrow(/varios años/);
  });
});

describe('motivoGestionInvalida', () => {
  it('pide observación para compromiso y no ubicado', () => {
    expect(motivoGestionInvalida(EstadoGestionCobranza.COMPROMISO, '  ')).toMatch(/compromiso/);
    expect(motivoGestionInvalida(EstadoGestionCobranza.NO_UBICADO)).toMatch(/buscó/);
  });

  it('acepta el resto sin observación', () => {
    expect(motivoGestionInvalida(EstadoGestionCobranza.CONTACTADO)).toBeNull();
    expect(motivoGestionInvalida(EstadoGestionCobranza.COMPROMISO, '15/12, S/ 500')).toBeNull();
  });
});

describe('concentracionTop', () => {
  it('calcula la fracción de deuda del primer 20 %', () => {
    expect(concentracionTop([50, 20, 10, 10, 5, 5, 0, 0, 0, 0])).toBeCloseTo(0.7);
    expect(concentracionTop([])).toBe(0);
  });
});
