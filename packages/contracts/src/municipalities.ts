import { MUNICIPALITY_DATA } from './municipalities-data.js';

/** The 27 federative units, by IBGE code (the first two digits of a municipality code). */
export const STATES = [
  { code: 12, uf: 'AC', name: 'Acre' },
  { code: 27, uf: 'AL', name: 'Alagoas' },
  { code: 13, uf: 'AM', name: 'Amazonas' },
  { code: 16, uf: 'AP', name: 'Amapá' },
  { code: 29, uf: 'BA', name: 'Bahia' },
  { code: 23, uf: 'CE', name: 'Ceará' },
  { code: 53, uf: 'DF', name: 'Distrito Federal' },
  { code: 32, uf: 'ES', name: 'Espírito Santo' },
  { code: 52, uf: 'GO', name: 'Goiás' },
  { code: 21, uf: 'MA', name: 'Maranhão' },
  { code: 31, uf: 'MG', name: 'Minas Gerais' },
  { code: 50, uf: 'MS', name: 'Mato Grosso do Sul' },
  { code: 51, uf: 'MT', name: 'Mato Grosso' },
  { code: 15, uf: 'PA', name: 'Pará' },
  { code: 25, uf: 'PB', name: 'Paraíba' },
  { code: 26, uf: 'PE', name: 'Pernambuco' },
  { code: 22, uf: 'PI', name: 'Piauí' },
  { code: 41, uf: 'PR', name: 'Paraná' },
  { code: 33, uf: 'RJ', name: 'Rio de Janeiro' },
  { code: 24, uf: 'RN', name: 'Rio Grande do Norte' },
  { code: 11, uf: 'RO', name: 'Rondônia' },
  { code: 14, uf: 'RR', name: 'Roraima' },
  { code: 43, uf: 'RS', name: 'Rio Grande do Sul' },
  { code: 42, uf: 'SC', name: 'Santa Catarina' },
  { code: 28, uf: 'SE', name: 'Sergipe' },
  { code: 35, uf: 'SP', name: 'São Paulo' },
  { code: 17, uf: 'TO', name: 'Tocantins' },
] as const;

export type Uf = (typeof STATES)[number]['uf'];

/** Where the company works most; the panel starts the municipality picker here. */
export const HOME_UF: Uf = 'BA';

export interface Municipality {
  /** IBGE code, 7 digits. */
  readonly code: number;
  readonly name: string;
  readonly uf: Uf;
}

const UF_BY_STATE_CODE = new Map<number, Uf>(STATES.map((s) => [s.code, s.uf]));

/** UF of an IBGE municipality code (its first two digits), if the state exists. */
export const ufOfMunicipalityCode = (code: number): Uf | undefined =>
  UF_BY_STATE_CODE.get(Math.trunc(code / 100_000));

/** Every municipality of Brazil, by UF and name. */
export const MUNICIPALITIES: readonly Municipality[] = MUNICIPALITY_DATA.map(([code, name]) => {
  const uf = ufOfMunicipalityCode(code);
  if (!uf) {
    throw new Error(`municipalities-data.ts: code ${String(code)} has no state`);
  }
  return { code, name, uf };
});

const BY_CODE = new Map(MUNICIPALITIES.map((m) => [m.code, m]));

export const isMunicipality = (code: number): boolean => BY_CODE.has(code);

export const municipalityByCode = (code: number): Municipality | undefined => BY_CODE.get(code);

export const municipalitiesOf = (uf: Uf): Municipality[] =>
  MUNICIPALITIES.filter((m) => m.uf === uf);

/** Most municipalities one survey can list. */
export const MAX_SURVEY_MUNICIPALITIES = 1000;
