/**
 * Expo Config Plugin: with-forced-package-name
 *
 * Forza il package Android definitivo a `it.tvscavallaro.marketmate`.
 * Il sistema EAS/Emergent a volte usa un package interno generato automaticamente
 * (es. `app.emergent.marketmatehub14905701f`) ignorando `android.package` in app.json.
 * Questo plugin interviene DOPO il prebuild e riscrive:
 *  - `AndroidManifest.xml` attributo `package`
 *  - `android/app/build.gradle` campo `applicationId`
 *  - `android/app/build.gradle` campo `namespace`
 *
 * Così il AAB finale ha sempre il package corretto per il Play Store:
 *   it.tvscavallaro.marketmate
 */
const { withAndroidManifest, withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TARGET_PACKAGE = 'it.tvscavallaro.marketmate';

module.exports = function withForcedPackageName(config) {
  // 1. Forza l'attributo `package` nel root di AndroidManifest.xml
  config = withAndroidManifest(config, (cfg) => {
    try {
      if (cfg.modResults && cfg.modResults.manifest && cfg.modResults.manifest.$) {
        const old = cfg.modResults.manifest.$.package;
        cfg.modResults.manifest.$.package = TARGET_PACKAGE;
        console.log(`[forced-package] AndroidManifest: ${old} → ${TARGET_PACKAGE}`);
      }
    } catch (e) {
      console.warn('[forced-package] manifest patch failed:', e);
    }
    return cfg;
  });

  // 2. Riscrivi applicationId e namespace in android/app/build.gradle
  config = withAppBuildGradle(config, (cfg) => {
    try {
      let content = cfg.modResults.contents;
      // applicationId
      content = content.replace(
        /applicationId\s+['"][^'"]+['"]/g,
        `applicationId '${TARGET_PACKAGE}'`
      );
      // namespace (introdotto da AGP 7+)
      content = content.replace(
        /namespace\s+['"][^'"]+['"]/g,
        `namespace '${TARGET_PACKAGE}'`
      );
      cfg.modResults.contents = content;
      console.log(`[forced-package] build.gradle → ${TARGET_PACKAGE}`);
    } catch (e) {
      console.warn('[forced-package] gradle patch failed:', e);
    }
    return cfg;
  });

  // 3. Safety net: rinomina eventuali riferimenti residui nel res/values/strings.xml
  //    o altri file .xml che contengono il vecchio package (es. provider authority).
  //    Questo gira DOPO tutti gli altri plugin.
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      try {
        const platformRoot = cfg.modRequest.platformProjectRoot;
        // Scansiona strings.xml e manifest alternativi per pattern noti
        const filesToCheck = [
          path.join(platformRoot, 'app', 'src', 'main', 'AndroidManifest.xml'),
          path.join(platformRoot, 'app', 'src', 'debug', 'AndroidManifest.xml'),
          path.join(platformRoot, 'app', 'src', 'main', 'res', 'values', 'strings.xml'),
        ];
        for (const fp of filesToCheck) {
          if (!fs.existsSync(fp)) continue;
          let s = fs.readFileSync(fp, 'utf8');
          const before = s;
          // Riscrivi gli applicationId storici lasciati qua e là
          s = s.replace(/app\.emergent\.marketmatehub[a-z0-9]*/g, TARGET_PACKAGE);
          s = s.replace(/app\.emergent\.[a-z0-9]+/g, TARGET_PACKAGE);
          if (s !== before) {
            fs.writeFileSync(fp, s);
            console.log(`[forced-package] scrubbed residue package in ${path.basename(fp)}`);
          }
        }

        // ═══ SANITY CHECK FINALE (blindatura) ═══
        // Se anche dopo tutti i patch il package non corrisponde, FALLISCE il build.
        // Così non ci ritroveremo mai AAB con il package sbagliato senza saperlo.
        const manifestPath = path.join(platformRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
        const gradlePath = path.join(platformRoot, 'app', 'build.gradle');
        if (fs.existsSync(manifestPath)) {
          const m = fs.readFileSync(manifestPath, 'utf8');
          if (!m.includes(`package="${TARGET_PACKAGE}"`) && !m.includes(`package='${TARGET_PACKAGE}'`)) {
            // NB: in AGP 7+ l'attributo package può essere assente dal manifest
            // (è nel namespace di build.gradle). Va bene.
            console.log('[forced-package] Note: manifest non contiene attributo package (OK per AGP7+)');
          }
        }
        if (fs.existsSync(gradlePath)) {
          const g = fs.readFileSync(gradlePath, 'utf8');
          const hasApp = g.includes(`applicationId '${TARGET_PACKAGE}'`) || g.includes(`applicationId "${TARGET_PACKAGE}"`);
          const hasNs = g.includes(`namespace '${TARGET_PACKAGE}'`) || g.includes(`namespace "${TARGET_PACKAGE}"`);
          if (!hasApp) {
            throw new Error(
              `[forced-package] BLOCCO BUILD: applicationId in build.gradle NON è '${TARGET_PACKAGE}'. ` +
              `Questo significa che il package è stato sovrascritto da altro plugin/prebuild. ` +
              `Il plugin with-forced-package-name deve essere l'ULTIMO in app.json plugins[].`
            );
          }
          if (!hasNs) {
            console.warn('[forced-package] Warning: namespace non trovato in build.gradle (forse AGP < 7)');
          }
          console.log(`[forced-package] ✅ SANITY CHECK PASSATO: package = ${TARGET_PACKAGE}`);
        }
      } catch (e) {
        // Se è un errore lanciato da noi, propagalo (blocca build)
        if (e instanceof Error && e.message.includes('BLOCCO BUILD')) throw e;
        console.warn('[forced-package] safety scrub failed:', e);
      }
      return cfg;
    },
  ]);

  return config;
};
