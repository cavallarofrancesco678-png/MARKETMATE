/**
 * ═══════════════════════════════════════════════════════════════════════
 *  useTeamSyncPolling — Hook che gestisce il polling 30s per Team Sync
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Comportamento:
 *  - All'aggancio (mount), aspetta 5s prima di iniziare il polling per
 *    evitare race condition durante l'unlock + mount della home.
 *  - Ogni 30s chiama `pullData()` dal `teamSyncStore`. Se ci sono dati
 *    nuovi nel cloud, applica `buildSyncMerge()` e li riversa in
 *    `useAppStore` con un `setState` atomico.
 *  - Il polling skippa automaticamente se ci sono modifiche locali
 *    recenti (anti-rollback window di 60s — gestita dentro
 *    `startTeamBackgroundPull` in teamSyncStore.ts).
 *  - Allo smontaggio cleanup completo del timer.
 *
 * Errori vengono swallowati con console.warn, mai propagati: un fail
 * di network non deve mai chiudere la home.
 */
import { useEffect } from 'react';
import {
  startTeamBackgroundPull,
  stopTeamBackgroundPull,
} from '../store/teamSyncStore';
import { useAppStore } from '../store/appStore';
import { buildSyncMerge } from '../utils/syncMerge';

const POLL_START_DELAY_MS = 5000;
const POLL_INTERVAL_MS = 30000;

export function useTeamSyncPolling(intervalMs: number = POLL_INTERVAL_MS) {
  useEffect(() => {
    // Callback chiamato dal poll quando arrivano dati cloud.
    const applyMerge = (cloudData: any) => {
      try {
        const local = useAppStore.getState() as any;
        const merge = buildSyncMerge(cloudData, local);
        if (Object.keys(merge).length > 0) {
          useAppStore.setState(merge as any);
        }
      } catch (e) {
        console.warn('[poll-merge] error', e);
      }
    };

    // Attesa iniziale: lascia che la home stabilizzi i suoi useEffect/UI.
    const startTimer = setTimeout(() => {
      try {
        startTeamBackgroundPull(applyMerge, intervalMs);
      } catch (e) {
        console.warn('[poll-start] error', e);
      }
    }, POLL_START_DELAY_MS);

    return () => {
      clearTimeout(startTimer);
      try {
        stopTeamBackgroundPull();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
