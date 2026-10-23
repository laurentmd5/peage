import { createApp } from './app.ts';
import { seedDatabase } from './infrastructure/persistence/SeedData.ts';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const PORT = process.env.PORT || 3001;

function startRTSPBridge() {
  const isWindows = process.platform === 'win32';
  const binDir = path.resolve(process.cwd(), 'bin');
  const exePath = path.join(binDir, isWindows ? 'go2rtc.exe' : 'go2rtc');
  const configPath = path.join(binDir, 'go2rtc.yaml');

  if (fs.existsSync(exePath) && fs.existsSync(configPath)) {
    try {
      const child = spawn(exePath, ['-config', configPath], {
        detached: false,
        stdio: 'ignore'
      });
      child.unref();
      console.log('[CAMERA STREAM] 🎥 Passerelle vidéo RTSP -> Web active (port 1984)');
    } catch (e: any) {
      console.log('[CAMERA STREAM] Note: Passerelle vidéo:', e.message);
    }
  }
}

async function bootstrap() {
  const { app, repos } = createApp();

  startRTSPBridge();

  console.log('==> Initialisation et alimentation de la base de démonstration...');
  await seedDatabase(
    repos.userRepo,
    repos.tariffRepo,
    repos.transactionRepo,
    repos.sessionRepo,
    repos.auditRepo
  );
  console.log('==> Données de démonstration prêtes (utilisateurs, tarifs, 28 transactions, audit).');

  app.listen(PORT, () => {
    console.log(`[PÉAGE EXPRESS] Serveur démarré avec succès sur le port ${PORT}`);
    console.log(`==> API disponible sur : http://localhost:${PORT}/api`);
  });
}

bootstrap().catch(err => {
  console.error('Erreur au démarrage du serveur de péage:', err);
  process.exit(1);
});
