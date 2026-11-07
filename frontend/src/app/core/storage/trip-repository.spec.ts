import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB, DBSchema } from 'idb';
import { Backup, TripData } from '../domain/model';
import { validateBackup } from '../domain/validation';
import { LocalRestoreConflictError, TripRepository } from './trip-repository';

interface LegacyDatabase extends DBSchema {
  trips: { key: string; value: TripData };
}

const rawSeed: unknown = JSON.parse(readFileSync('public/seed.json', 'utf8'));
const seed: Backup = await validateBackup(rawSeed);

describe('TripRepository: revisión local y migración', () => {
  let repository: TripRepository;
  let databaseName: string;

  beforeEach(() => {
    databaseName = `remote-copies-${crypto.randomUUID()}`;
    repository = new TripRepository(databaseName);
  });

  afterEach(async () => {
    await repository.close();
  });

  it('migra la base v1 en su lugar sin cambiar los IDs ni los datos existentes', async () => {
    const legacy = await openDB<LegacyDatabase>(databaseName, 1, {
      upgrade(db) {
        db.createObjectStore('trips', { keyPath: 'trip.id' });
      },
    });
    await legacy.put('trips', structuredClone(seed.data));
    legacy.close();

    const snapshot = await repository.snapshot(seed.data.trip.id);
    expect(snapshot?.data).toEqual(seed.data);
    expect(snapshot?.backup.data.trip.id).toBe(seed.data.trip.id);
    expect(snapshot?.revision).toBe(0);
    expect(snapshot?.token).toMatch(/^[0-9a-f-]{36}$/i);
    expect((await repository.all()).map((trip) => trip.trip.id)).toEqual([seed.data.trip.id]);
  });

  it('actualiza el token dentro de cada transacción y serializa guardados concurrentes', async () => {
    await repository.importSeed(seed);
    const initial = await repository.snapshot(seed.data.trip.id);
    expect(initial).not.toBeNull();

    const note = {
      date: '2030-06-03',
      cyclingKm: null,
      text: 'Revisión local concurrente',
      stageIds: [],
    };
    await Promise.all([
      repository.saveNote(seed.data.trip.id, note),
      repository.saveNote(seed.data.trip.id, { ...note, text: 'Otra nota concurrente' }),
    ]);

    const current = await repository.snapshot(seed.data.trip.id);
    expect(current?.revision).toBe((initial?.revision ?? 0) + 2);
    expect(current?.token).not.toBe(initial?.token);
    expect(current?.data.diaryEntries).toHaveLength(2);
  });

  it('reimportar un viaje existente no cambia su revisión ni su token', async () => {
    await repository.importSeed(seed);
    const before = await repository.snapshot(seed.data.trip.id);
    await repository.importSeed(seed);
    const after = await repository.snapshot(seed.data.trip.id);
    expect(after?.revision).toBe(before?.revision);
    expect(after?.token).toBe(before?.token);
  });

  it('edita la logística y conserva el respaldo; rechaza una revisión anterior', async () => {
    const original = structuredClone(seed);
    const firstDay = original.data.plannedDays[0];
    Object.assign(firstDay.logistics, { extension: { preserve: true } });
    const initial = await repository.restoreCAS(original, null);
    const edits = { ...firstDay.logistics, lodgingStatusText: 'Confirmado' };
    await repository.saveDayLogistics(original.data.trip.id, firstDay.id, initial.token, edits);

    await expect(
      repository.saveDayLogistics(original.data.trip.id, firstDay.id, initial.token, {
        ...edits,
        lodgingStatusText: 'Sin reservar',
      }),
    ).rejects.toThrow('El cuaderno cambió');
    const saved = await repository.snapshot(original.data.trip.id);
    expect(saved?.revision).toBe(initial.revision + 1);
    expect(saved?.data.plannedDays[0].logistics).toMatchObject({
      lodgingStatusText: 'Confirmado',
      extension: { preserve: true },
    });
    expect(saved?.data.plannedDays.slice(1)).toEqual(original.data.plannedDays.slice(1));
    expect(saved?.data.sourceSnapshots).toEqual(original.data.sourceSnapshots);
    expect(saved?.data.diaryEntries).toEqual(original.data.diaryEntries);
    await expect(validateBackup(saved?.backup)).resolves.toEqual(saved?.backup);
  });

  it('restaura por compare-and-swap, archiva lo reemplazado y conserva extensiones raíz', async () => {
    const original = structuredClone(seed);
    original['customMetadata'] = { origin: 'importación', nested: { keep: true } };
    await repository.restore(original);
    const first = await repository.snapshot(seed.data.trip.id);
    expect(first).not.toBeNull();

    await repository.saveNote(seed.data.trip.id, {
      date: '2030-06-03',
      cyclingKm: 0,
      text: 'Edición local posterior',
      stageIds: [],
    });
    const changed = await repository.snapshot(seed.data.trip.id);
    const remote = structuredClone(seed);
    remote.exportedAt = '2031-01-01T00:00:00.000Z';
    remote['customMetadata'] = { origin: 'API', preserve: ['unknown', 'fields'] };

    await expect(repository.restoreCAS(remote, first?.token ?? null)).rejects.toBeInstanceOf(
      LocalRestoreConflictError,
    );
    expect((await repository.snapshot(seed.data.trip.id))?.data.diaryEntries).toHaveLength(1);

    const restored = await repository.restoreCAS(remote, changed?.token ?? null);
    const final = await repository.snapshot(seed.data.trip.id);
    expect(final?.token).toBe(restored.token);
    expect(final?.token).not.toBe(changed?.token);
    expect(final?.backup['customMetadata']).toEqual(remote['customMetadata']);
    expect(final?.data.diaryEntries).toHaveLength(0);

    const archives = await repository.listRestoreArchives(seed.data.trip.id);
    expect(archives).toHaveLength(1);
    expect(archives[0].backup.data.diaryEntries).toHaveLength(1);
    expect(archives[0].backup['customMetadata']).toEqual(original['customMetadata']);
  });
});
