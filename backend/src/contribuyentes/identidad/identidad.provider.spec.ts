import { IdentidadError, IdentidadProvider } from './identidad.provider.js';

const respuesta = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const ok = (data: Record<string, unknown>) => ({ success: true, code: 'found', retryable: false, data });

describe('IdentidadProvider', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const proveedor = (apiKey = 'k') => new IdentidadProvider({ apiKey, baseUrl: 'https://api.test', timeoutMs: 1000 });
  const errorDe = (p: Promise<unknown>) => p.catch((e) => e);

  it('sin key → SIN_KEY sin llamar a la red', async () => {
    const e = await errorDe(new IdentidadProvider({}).consultar('DNI', '12345678'));
    expect(e).toBeInstanceOf(IdentidadError);
    expect(e.motivo).toBe('SIN_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DNI encontrado → devuelve el nombre completo', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(200, ok({ numero: '12345678', nombre_completo: 'PEREZ RAMOS JUAN' })));
    await expect(proveedor().consultar('DNI', '12345678')).resolves.toEqual({
      nombreCompleto: 'PEREZ RAMOS JUAN',
      estado: null,
      condicion: null,
      direccionExterna: null,
      ubigeo: null,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.test/dni');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer k');
  });

  it('DNI sin nombre_completo → arma el nombre con apellidos y nombres', async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(200, ok({ apellido_paterno: 'QUISPE', apellido_materno: 'LOPEZ', nombres: 'ANA MARIA' })),
    );
    const r = await proveedor().consultar('DNI', '87654321');
    expect(r.nombreCompleto).toBe('QUISPE LOPEZ ANA MARIA');
  });

  it('RUC → razón social, estado, condición y dirección como texto', async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(
        200,
        ok({
          ruc: '20131312955',
          nombre_o_razon_social: 'MUNICIPALIDAD DE SAN BARTOLO',
          estado: 'ACTIVO',
          condicion: 'HABIDO',
          direccion: 'AV. LOS ROSALES 123',
          departamento: 'LIMA',
        }),
      ),
    );
    await expect(proveedor().consultar('RUC', '20131312955')).resolves.toEqual({
      nombreCompleto: 'MUNICIPALIDAD DE SAN BARTOLO',
      estado: 'ACTIVO',
      condicion: 'HABIDO',
      direccionExterna: 'AV. LOS ROSALES 123',
      ubigeo: null,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.test/ruc');
  });

  it('RUC → prefiere direccion_completa y lee ubigeo_sunat (6 dígitos)', async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(
        200,
        ok({
          ruc: '20131312955',
          nombre_o_razon_social: 'MUNICIPALIDAD DE SAN BARTOLO',
          estado: 'ACTIVO',
          condicion: 'HABIDO',
          direccion: 'AV. LOS ROSALES 123',
          direccion_completa: 'AV. LOS ROSALES 123, SAN BARTOLO - LIMA - LIMA',
          ubigeo: ['15', '1501', '150129'],
          ubigeo_sunat: '150129',
        }),
      ),
    );
    const r = await proveedor().consultar('RUC', '20131312955');
    expect(r.direccionExterna).toBe('AV. LOS ROSALES 123, SAN BARTOLO - LIMA - LIMA');
    // El array ubigeo no sirve: el que va al formulario es ubigeo_sunat.
    expect(r.ubigeo).toBe('150129');
  });

  it('RUC → ubigeo_sunat que no son 6 dígitos se descarta', async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(
        200,
        ok({
          nombre_o_razon_social: 'ACME S.A.C.',
          estado: 'ACTIVO',
          condicion: 'HABIDO',
          ubigeo_sunat: '1501',
        }),
      ),
    );
    expect((await proveedor().consultar('RUC', '20123456786')).ubigeo).toBeNull();
  });

  it('404 document_not_found → NO_ENCONTRADO', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(404, { success: false, code: 'document_not_found', message: 'no' }));
    const e = await errorDe(proveedor().consultar('DNI', '00000000'));
    expect(e.motivo).toBe('NO_ENCONTRADO');
  });

  it('429 quota_exceeded → CUPO', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(429, { success: false, code: 'quota_exceeded' }));
    expect((await errorDe(proveedor().consultar('DNI', '12345678'))).motivo).toBe('CUPO');
  });

  it('503 upstream_unavailable → REINTENTAR', async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(503, { success: false, code: 'upstream_unavailable', retryable: true, message: 'caído' }),
    );
    expect((await errorDe(proveedor().consultar('DNI', '12345678'))).motivo).toBe('REINTENTAR');
  });

  it('401 token rechazado → SIN_KEY (la clave no sirve)', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(401, { message: 'unauthorized' }));
    expect((await errorDe(proveedor('mala').consultar('DNI', '12345678'))).motivo).toBe('SIN_KEY');
  });

  it('400 invalid_input → FORMATO', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(400, { success: false, code: 'invalid_input' }));
    expect((await errorDe(proveedor().consultar('DNI', '12345678'))).motivo).toBe('FORMATO');
  });

  it('sin red (timeout) → REINTENTAR', async () => {
    fetchMock.mockRejectedValueOnce(new Error('The operation was aborted due to timeout'));
    expect((await errorDe(proveedor().consultar('DNI', '12345678'))).motivo).toBe('REINTENTAR');
  });

  it('respuesta 200 sin nombre → PROVEEDOR', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(200, ok({ numero: '12345678' })));
    expect((await errorDe(proveedor().consultar('DNI', '12345678'))).motivo).toBe('PROVEEDOR');
  });
});
