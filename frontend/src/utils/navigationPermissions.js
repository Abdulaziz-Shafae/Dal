import { validCoordinates } from './navigationCalculations.js';

export function navigationRequirements(view, navigation, sensor) {
  if (!['map', 'compass'].includes(view)) return { location: false, sensor: false };
  return {
    location: !(navigation.consent && navigation.enabled && navigation.gps.status === 'ready' && validCoordinates(navigation.gps.point)),
    sensor: view === 'compass' && !(sensor.enabled && sensor.status === 'ready' && Number.isFinite(sensor.heading))
  };
}
