/**
 * tutorialLayoutStore — registry centrale per il tutorial.
 *
 * Su Android/iOS nativo non possiamo usare document.querySelector. Le pagine
 * registrano:
 *   1) i ref dei loro elementi-anchor (es. "sett-collab-card")
 *   2) un'helper di scroll per la propria ScrollView, che dato un anchorRef
 *      sposta la pagina così che l'anchor finisca a `targetScreenY` px dall'alto.
 *
 * Il TutorialOverlay legge questi ref per misurare con `measureInWindow` e
 * chiamare l'helper per scrollare prima di posizionare il fumetto.
 */
import { create } from 'zustand';
import React from 'react';
import { View } from 'react-native';

export type AnchorRef = React.RefObject<View | null>;
export type ScrollHelper = (anchorRef: AnchorRef, targetScreenY: number) => Promise<void> | void;

interface TutorialLayoutStore {
  anchorRefs: Record<string, AnchorRef>;
  scrollHelpers: Record<string, ScrollHelper>;
  setAnchor: (id: string, ref: AnchorRef) => void;
  removeAnchor: (id: string) => void;
  setScrollHelper: (route: string, fn: ScrollHelper) => void;
  removeScrollHelper: (route: string) => void;
}

export const useTutorialLayoutStore = create<TutorialLayoutStore>((set) => ({
  anchorRefs: {},
  scrollHelpers: {},
  setAnchor: (id, ref) =>
    set((s) => ({ anchorRefs: { ...s.anchorRefs, [id]: ref } })),
  removeAnchor: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.anchorRefs;
      return { anchorRefs: rest };
    }),
  setScrollHelper: (route, fn) =>
    set((s) => ({ scrollHelpers: { ...s.scrollHelpers, [route]: fn } })),
  removeScrollHelper: (route) =>
    set((s) => {
      const { [route]: _, ...rest } = s.scrollHelpers;
      return { scrollHelpers: rest };
    }),
}));

/* ───────────────────────────────────────────────────────────────────── */
/*  HOOK pubblici                                                         */
/* ───────────────────────────────────────────────────────────────────── */

/**
 * Registra un ref come anchor del tutorial. Spread the returned ref onto
 * a <View>:
 *
 *   const ref = useTutorialAnchor('sett-collab-card');
 *   <View ref={ref}>...</View>
 */
export function useTutorialAnchor(id: string): AnchorRef {
  const ref = React.useRef<View | null>(null);
  React.useEffect(() => {
    useTutorialLayoutStore.getState().setAnchor(id, ref);
    return () => useTutorialLayoutStore.getState().removeAnchor(id);
  }, [id]);
  return ref;
}

/**
 * Registra una funzione di scroll per la pagina corrente. La funzione riceve
 * un anchorRef e un targetScreenY, e deve scrollare la sua ScrollView così che
 * l'anchor finisca a quel pixel dall'alto dello schermo.
 *
 *   useTutorialScrollHelper('/home/settings', scrollViewRef, scrollYRef);
 */
export function useTutorialScrollHelper(
  route: string,
  scrollViewRef: React.RefObject<{ scrollTo: (opts: any) => void } | null>,
  scrollYRef: React.MutableRefObject<number>
) {
  React.useEffect(() => {
    const helper: ScrollHelper = (anchorRef, targetScreenY) =>
      new Promise<void>((resolve) => {
        const node = anchorRef?.current as any;
        if (!node || !node.measureInWindow) {
          resolve();
          return;
        }
        node.measureInWindow((_x: number, y: number) => {
          const delta = y - targetScreenY;
          const newY = Math.max(0, scrollYRef.current + delta);
          if (Math.abs(delta) < 8) {
            // già abbastanza in posizione
            resolve();
            return;
          }
          try {
            scrollViewRef.current?.scrollTo({ y: newY, animated: true });
          } catch {}
          // attendi animazione prima di risolvere
          setTimeout(() => resolve(), 350);
        });
      });
    useTutorialLayoutStore.getState().setScrollHelper(route, helper);
    return () => useTutorialLayoutStore.getState().removeScrollHelper(route);
  }, [route, scrollViewRef, scrollYRef]);
}
