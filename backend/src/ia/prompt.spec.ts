import {
  FragmentoRecuperado,
  anonimizar,
  construirMensajeUsuario,
  construirSistema,
  fuentesDe,
  sinInformacion,
  tituloConversacion,
} from './prompt.js';

const frag = (over: Partial<FragmentoRecuperado> = {}): FragmentoRecuperado => ({
  id: 1,
  archivo: '05-valores-op-rd.md',
  titulo: 'Valores OP/RD',
  seccion: 'Emitir una OP',
  contenido: 'Paso 1: ...',
  similitud: 0.8,
  ...over,
});

describe('anonimizar (Ley 29733)', () => {
  it('omite DNI, RUC, celular y correo', () => {
    expect(anonimizar('deuda del DNI 45678912 y RUC 20123456789')).toBe(
      'deuda del DNI [dato omitido] y RUC [dato omitido]',
    );
    expect(anonimizar('llamar al 987654321 o a juan.perez@mail.com')).toBe(
      'llamar al [dato omitido] o a [dato omitido]',
    );
  });

  it('conserva años, montos y códigos cortos', () => {
    const texto = '¿Cómo fracciono 1500.50 soles del 2026 con el código 004512?';
    expect(anonimizar(texto)).toBe(texto);
  });

  it('solo espacios → vacío', () => {
    expect(anonimizar('   ')).toBe('');
  });
});

describe('prompt', () => {
  it('el sistema incluye el rol y las reglas de no inventar y citar', () => {
    const s = construirSistema('CAJERO');
    expect(s).toContain('rol CAJERO');
    expect(s).toContain('No tengo información sobre eso');
    expect(s).toContain('el sistema muestra las fuentes aparte');
    expect(s).toMatch(/datos personales/);
  });

  it('el mensaje numera fuentes con guía y sección antes de la pregunta', () => {
    const m = construirMensajeUsuario('¿Cómo emito una OP?', [frag(), frag({ id: 2, seccion: 'Notificar' })]);
    expect(m).toMatch(/^FUENTES:\n\[1\] Guía: Valores OP\/RD › Sección: Emitir una OP\nPaso 1/);
    expect(m).toContain('[2] Guía: Valores OP/RD › Sección: Notificar');
    expect(m.endsWith('PREGUNTA: ¿Cómo emito una OP?')).toBe(true);
  });

  it('fuentes: solo las cercanas a la mejor y como máximo 3', () => {
    const f = [0.82, 0.76, 0.71, 0.8, 0.79, 0.78].map((s, i) => frag({ id: i, seccion: `S${i}`, similitud: s }));
    expect(fuentesDe(f).map((x) => x.seccion)).toEqual(['S0', 'S1', 'S3']);
  });

  it('detecta la respuesta de "no tengo información"', () => {
    expect(sinInformacion('No tengo información sobre eso. Consulta…')).toBe(true);
    expect(sinInformacion('Para extornar un recibo…')).toBe(false);
  });

  it('fuentes sin duplicar guía+sección, en orden de relevancia', () => {
    const fuentes = fuentesDe([frag(), frag({ id: 2 }), frag({ id: 3, archivo: '08-caja.md', titulo: 'Caja', seccion: 'Extorno' })]);
    expect(fuentes).toEqual([
      { archivo: '05-valores-op-rd.md', guia: 'Valores OP/RD', seccion: 'Emitir una OP' },
      { archivo: '08-caja.md', guia: 'Caja', seccion: 'Extorno' },
    ]);
  });

  it('título de conversación compacta espacios y corta a 80', () => {
    expect(tituloConversacion('  ¿cómo   cobro?\n ')).toBe('¿cómo cobro?');
    const largo = tituloConversacion('a'.repeat(200));
    expect(largo.length).toBe(80);
    expect(largo.endsWith('...')).toBe(true);
  });
});
