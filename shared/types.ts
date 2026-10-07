/** Kontrakter mellem serveren, siderne og de andre apps (forsiden bruger `/api/dates` og `/api/home/dates`). */

/** En adresse fra Vestfors søgning (`/Adresse/AddressByName`). */
export interface VestforAddress {
  Id: string;
  FuldtVejnavn: string;
  Postnr?: string;
}

/** Den gemte adresse (`data/saved-address.json`) og hjemmeadressen i `/api/home`. */
export interface SavedAddress {
  id: string;
  navn?: string;
  postnr?: string;
}

/** En tømmedato fra Vestfor (`/Adresse/ToemmeDates`); `start` er fx "2025-04-22T00:00:00". */
export interface WasteDate {
  start: string;
  title: string;
  [key: string]: unknown;
}

/** `/api/dates` og `/api/home/dates`: datoerne med affaldstypens ikon. */
export interface WasteDateWithIcon extends WasteDate {
  icon: string;
}
