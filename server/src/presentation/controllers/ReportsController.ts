import { Router, Response } from 'express';
import { ReportsUseCase } from '../../application/use-cases/ReportsUseCase.ts';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/AuthMiddleware.ts';
import { PaymentMethod } from '../../domain/value-objects/PaymentMethod.ts';

export function createReportsRouter(reportsUseCase: ReportsUseCase): Router {
  const router = Router();

  router.get('/summary', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        startDate,
        endDate,
        cashierId,
        laneId,
        categoryCode,
        paymentMethod
      } = req.query;

      const now = new Date();
      const defaultStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const defaultEnd = now.toISOString().slice(0, 10);

      const report = await reportsUseCase.generate(
        {
          startDate: (startDate as string) || defaultStart,
          endDate: (endDate as string) || defaultEnd,
          cashierId: cashierId as string,
          laneId: laneId as string,
          categoryCode: categoryCode as string,
          paymentMethod: paymentMethod as PaymentMethod
        },
        req.user?.fullName || req.user?.username || 'Administrateur'
      );

      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/export-csv', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, cashierId, laneId } = req.query;
      const now = new Date();
      const defaultStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const defaultEnd = now.toISOString().slice(0, 10);

      const report = await reportsUseCase.generate({
        startDate: (startDate as string) || defaultStart,
        endDate: (endDate as string) || defaultEnd,
        cashierId: cashierId as string,
        laneId: laneId as string
      });

      let csv = 'Rapport d\'exploitation du Peage\n';
      csv += `Periode;Du ${report.period.start} au ${report.period.end}\n`;
      csv += `Total Vehicules;${report.totalVehicles}\n`;
      csv += `Recettes Totales (FCFA);${report.totalRevenue}\n`;
      csv += `Transactions Annulees;${report.totalCancelled}\n`;
      csv += `Ouvertures Manuelles;${report.totalManualOpenings}\n\n`;

      csv += 'Ventilation par Categorie\n';
      csv += 'Code;Libelle;Nombre;Montant (FCFA)\n';
      report.byCategory.forEach(c => {
        csv += `${c.code};"${c.label}";${c.count};${c.total}\n`;
      });

      csv += '\nVentilation par Mode de Paiement\n';
      csv += 'Mode;Nombre;Montant (FCFA)\n';
      report.byPaymentMethod.forEach(m => {
        csv += `"${m.label}";${m.count};${m.total}\n`;
      });

      csv += '\nVentilation par Caissier\n';
      csv += 'Caissier;Nombre;Montant (FCFA)\n';
      report.byCashier.forEach(c => {
        csv += `"${c.cashierName}";${c.count};${c.total}\n`;
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="rapport-peage-${report.period.start}-${report.period.end}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
