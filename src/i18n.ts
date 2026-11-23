/** Minimal i18n seam: all new in-game strings are keys, not literals in systems. */
export type TranslationKey =
  | 'hud.wanted'
  | 'hud.busted'
  | 'notice.vehicleTheft'
  | 'notice.pedestrianImpact'
  | 'notice.busted'
  | 'notice.noVehicle'
  | 'controls.hint';

const SPANISH: Readonly<Record<TranslationKey, string>> = {
  'hud.wanted': 'Búsqueda',
  'hud.busted': 'DETENIDO',
  'notice.vehicleTheft': 'Vehículo requisado. La policía va detrás de ti.',
  'notice.pedestrianImpact': 'Has atropellado a un peatón. Huye.',
  'notice.busted': 'Detenido. Volviendo a Plaza Mayor…',
  'notice.noVehicle': 'No hay ningún vehículo cerca.',
  'controls.hint': 'WASD camina · Mayús corre · E roba/sale · clic captura el ratón',
};

export function t(key: TranslationKey): string {
  return SPANISH[key];
}
