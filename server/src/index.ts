import { createApp } from './app.ts';
import { seedDatabase } from './infrastructure/persistence/SeedData.ts';

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  const { app, repos } = createApp();

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
