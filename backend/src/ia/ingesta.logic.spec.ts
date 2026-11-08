import {
  MAX_FRAGMENTO,
  fragmentarMarkdown,
  hashContenido,
  planificarIngesta,
  textoParaEmbedding,
  vectorLiteral,
} from './ingesta.logic.js';

describe('fragmentarMarkdown', () => {
  it('toma el título del # y parte por ##', () => {
    const doc = fragmentarMarkdown('# Caja\n\nIntro breve.\n\n## Cobrar\nPaso 1.\n\n## Extornar\nPaso A.', 'caja.md');
    expect(doc.titulo).toBe('Caja');
    expect(doc.fragmentos.map((f) => f.seccion)).toEqual(['Introducción', 'Cobrar', 'Extornar']);
    expect(doc.fragmentos.map((f) => f.posicion)).toEqual([1, 2, 3]);
    expect(doc.fragmentos[1].contenido).toBe('Paso 1.');
  });

  it('sin # usa el nombre de archivo y omite secciones vacías', () => {
    const doc = fragmentarMarkdown('## Vacía\n\n## Llena\ntexto', '04-estado.md');
    expect(doc.titulo).toBe('04-estado');
    expect(doc.fragmentos).toEqual([{ seccion: 'Llena', posicion: 1, contenido: 'texto' }]);
  });

  it('archivo vacío → sin fragmentos', () => {
    expect(fragmentarMarkdown('', 'x.md').fragmentos).toEqual([]);
  });

  it('sección larga se divide por párrafos sin pasar el máximo', () => {
    const parrafo = 'palabra '.repeat(100).trim(); // ~800 car.
    const doc = fragmentarMarkdown(`# T\n## Larga\n${parrafo}\n\n${parrafo}\n\n${parrafo}`, 't.md');
    expect(doc.fragmentos.length).toBe(3);
    expect(doc.fragmentos.every((f) => f.seccion === 'Larga' && f.contenido.length <= MAX_FRAGMENTO)).toBe(true);
  });

  it('párrafo gigante sin saltos se corta duro', () => {
    const doc = fragmentarMarkdown(`## S\n${'x'.repeat(3000)}`, 's.md');
    expect(doc.fragmentos.map((f) => f.contenido.length)).toEqual([1200, 1200, 600]);
  });

  it('CRLF de Windows no cambia el resultado ni el hash', () => {
    const lf = '# T\n## A\nuno';
    expect(fragmentarMarkdown(lf.replace(/\n/g, '\r\n'), 't.md')).toEqual(fragmentarMarkdown(lf, 't.md'));
    expect(hashContenido(lf.replace(/\n/g, '\r\n'))).toBe(hashContenido(lf));
  });

  it('el texto a embeber lleva guía y sección', () => {
    expect(textoParaEmbedding('Caja', { seccion: 'Cobrar', posicion: 1, contenido: 'c' })).toBe('Caja › Cobrar\nc');
  });
});

describe('planificarIngesta', () => {
  it('procesa nuevos y cambiados, salta iguales y elimina los borrados', () => {
    const plan = planificarIngesta(
      [
        { archivo: 'a.md', hash: 'h1' },
        { archivo: 'b.md', hash: 'nuevo' },
        { archivo: 'c.md', hash: 'h3' },
      ],
      [
        { id: 1, archivo: 'a.md', hash: 'h1' },
        { id: 2, archivo: 'b.md', hash: 'viejo' },
        { id: 9, archivo: 'borrado.md', hash: 'h9' },
      ],
    );
    expect(plan).toEqual({
      procesar: ['b.md', 'c.md'],
      sinCambio: ['a.md'],
      eliminar: [{ id: 9, archivo: 'borrado.md' }],
    });
  });
});

describe('vectorLiteral', () => {
  it('formatea para ::vector y rechaza NaN/Infinity', () => {
    expect(vectorLiteral([0.1, -2, 3])).toBe('[0.1,-2,3]');
    expect(() => vectorLiteral([1, Number.NaN])).toThrow();
    expect(() => vectorLiteral([Infinity])).toThrow();
  });
});
