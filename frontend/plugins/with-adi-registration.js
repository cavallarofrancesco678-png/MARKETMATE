/**
 * Expo Config Plugin: with-adi-registration
 *
 * Durante il prebuild Android, copia il file `adi-registration.properties`
 * (posto nella root del progetto) dentro la cartella `android/app/src/main/assets/`
 * dell'AAB/APK generato. Questo file contiene il token di verifica richiesto
 * da Google Play Console per il flusso "Verifica dello sviluppatore Android"
 * quando si registra un nome di pacchetto già usato da un'altra build.
 *
 * Riferimenti:
 * - Google Play Console → Android Developer Verification → "Firma e carica un APK"
 * - Doc snippet: il file deve contenere il token come testo semplice
 *
 * Senza questo plugin, Expo non sa includere il file negli asset Android raw,
 * e Google Play scarta l'APK con il messaggio:
 *   "L'APK caricato non ha il file token richiesto."
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withAdiRegistration(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const platformRoot = cfg.modRequest.platformProjectRoot;
      const sourceFile = path.join(projectRoot, 'adi-registration.properties');
      const destDir = path.join(platformRoot, 'app', 'src', 'main', 'assets');
      const destFile = path.join(destDir, 'adi-registration.properties');

      if (!fs.existsSync(sourceFile)) {
        console.warn(
          '[with-adi-registration] adi-registration.properties NOT FOUND in project root, skipping.'
        );
        return cfg;
      }

      // Crea la cartella assets se non esiste
      fs.mkdirSync(destDir, { recursive: true });

      // Copia il file
      fs.copyFileSync(sourceFile, destFile);
      console.log(
        `[with-adi-registration] Copied adi-registration.properties → ${destFile}`
      );

      return cfg;
    },
  ]);
};
