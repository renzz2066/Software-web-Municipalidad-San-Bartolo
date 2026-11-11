import { aPublica, cargarRegistro, hostsPermitidos, resolverMuni } from './muni.registro.js';

const JSON_MUNIS = {
  defecto: 'sanbartolo',
  munis: [
    { slug: 'sanbartolo', nombre: 'Muni SB', hosts: ['sanbartolo.localhost'], colores: {} },
    {
      slug: 'demo',
      nombre: 'Muni Demo',
      hosts: ['demo.localhost'],
      colores: { mar: '#123456', 'mar-profundo': 'red; background:url(x)', 'no-token': '#000000' },
    },
  ],
};

const ENV = {
  MUNIS: 'sanbartolo,demo',
  DATABASE_URL__SANBARTOLO: 'postgresql://sb',
  DATABASE_URL__DEMO: 'postgresql://demo',
  FRONTEND_URL: 'http://localhost:5173',
};

describe('cargarRegistro', () => {
  it('sin MUNIS solo activa la muni por defecto y acepta DATABASE_URL (flujo de una sola muni)', () => {
    const r = cargarRegistro(JSON_MUNIS, { DATABASE_URL: 'postgresql://legacy' });

    expect([...r.porSlug.keys()]).toEqual(['sanbartolo']);
    expect(r.defecto.databaseUrl).toBe('postgresql://legacy');
  });

  it('falla al arrancar si una muni activa no tiene su URL, diciendo cuál', () => {
    expect(() => cargarRegistro(JSON_MUNIS, { ...ENV, DATABASE_URL__DEMO: undefined })).toThrow(
      'Falta DATABASE_URL__DEMO para la municipalidad "demo"',
    );
  });

  it('una muni no por defecto NO hereda DATABASE_URL', () => {
    expect(() =>
      cargarRegistro(JSON_MUNIS, { MUNIS: 'sanbartolo,demo', DATABASE_URL: 'postgresql://legacy' }),
    ).toThrow('DATABASE_URL__DEMO');
  });

  it('falla si MUNIS nombra una muni que no está en el JSON', () => {
    expect(() => cargarRegistro(JSON_MUNIS, { ...ENV, MUNIS: 'sanbartolo,xyz' })).toThrow('"xyz"');
  });

  it('solo deja pasar colores hex de tokens conocidos', () => {
    const r = cargarRegistro(JSON_MUNIS, ENV);

    expect(r.porSlug.get('demo')!.colores).toEqual({ mar: '#123456' });
  });

  it('la vista pública no expone la URL de la base ni los hosts', () => {
    const publica = aPublica(cargarRegistro(JSON_MUNIS, ENV).porSlug.get('demo')!);

    expect(JSON.stringify(publica)).not.toContain('postgresql');
    expect(publica).not.toHaveProperty('hosts');
  });
});

describe('resolverMuni', () => {
  const r = cargarRegistro(JSON_MUNIS, ENV);

  it.each([
    ['sanbartolo.localhost', 'sanbartolo'],
    ['demo.localhost', 'demo'],
    ['DEMO.localhost', 'demo'],
    ['localhost', 'sanbartolo'],
    [undefined, 'sanbartolo'],
    ['', 'sanbartolo'],
  ])('%s → %s', (cabecera, esperado) => {
    expect(resolverMuni(r, cabecera)?.slug).toBe(esperado);
  });

  it.each(['xyz.localhost', 'evil.com', 'demo.localhost.evil.com', 'http://[::bad'])(
    'host desconocido %s → null (nunca la muni por defecto)',
    (cabecera) => {
      expect(resolverMuni(r, cabecera)).toBeNull();
    },
  );

  it('CORS permite solo hosts de munis activas y FRONTEND_URL', () => {
    expect([...hostsPermitidos(r)].sort()).toEqual(['demo.localhost', 'localhost', 'sanbartolo.localhost']);
  });
});
