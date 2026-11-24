/** Minimal i18n seam: all new in-game strings are keys, not literals in systems. */
export type TranslationKey =
  | 'hud.wanted'
  | 'hud.busted'
  | 'notice.vehicleTheft'
  | 'notice.pedestrianImpact'
  | 'notice.busted'
  | 'notice.noVehicle'
  | 'notice.audioMuted'
  | 'notice.audioUnmuted'
  | 'controls.hint';

const SPANISH: Readonly<Record<TranslationKey, string>> = {
  'hud.wanted': 'Búsqueda',
  'hud.busted': 'DETENIDO',
  'notice.vehicleTheft': 'Vehículo requisado. La policía va detrás de ti.',
  'notice.pedestrianImpact': 'Has atropellado a un peatón. Huye.',
  'notice.busted': 'Detenido. Volviendo a Plaza Mayor…',
  'notice.noVehicle': 'No hay ningún vehículo cerca.',
  'notice.audioMuted': 'Audio silenciado (M para activar)',
  'notice.audioUnmuted': 'Audio activado',
  'controls.hint': 'WASD camina/conduce · E entra/sale · Espacio frena · H claxon · M audio',
};

export function t(key: TranslationKey): string {
  return SPANISH[key];
}
