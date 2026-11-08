import type { PlannedDay, TripData } from './model';

export type DayLogistics = Pick<
  PlannedDay['logistics'],
  'lodgingCandidate' | 'lodgingStatusText' | 'supplyNotes' | 'alternativeNotes'
>;

export function editDayLogistics(data: TripData, dayId: string, input: DayLogistics): TripData {
  const day = data.plannedDays.find(
    (item) => item.id === dayId && item.planId === data.trip.activePlanId,
  );
  if (!day) throw new Error('No encontramos la jornada en el plan activo.');
  const { lodgingCandidate, lodgingStatusText, supplyNotes, alternativeNotes } = input;
  const changes = { lodgingCandidate, lodgingStatusText, supplyNotes, alternativeNotes };
  if (Object.values(changes).some((value) => typeof value !== 'string')) {
    throw new Error('La logística de la jornada debe escribirse como texto.');
  }
  const updatedAt = new Date().toISOString();
  return {
    ...data,
    trip: { ...data.trip, updatedAt },
    plannedDays: data.plannedDays.map((item) =>
      item === day ? { ...day, updatedAt, logistics: { ...day.logistics, ...changes } } : item,
    ),
  };
}
