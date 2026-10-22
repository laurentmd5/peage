import { describe, it, expect } from 'vitest';
import { ReconciliationService } from '../../../server/src/domain/services/ReconciliationService.ts';

describe('ReconciliationService Domain Service', () => {
  const service = new ReconciliationService();

  it('should detect perfectly balanced cash', () => {
    const res = service.reconcile(20000, 45000, 65000);
    expect(res.status).toBe('BALANCED');
    expect(res.discrepancy).toBe(0);
    expect(res.message).toContain('parfaitement équilibrée');
  });

  it('should detect cash deficit', () => {
    const res = service.reconcile(20000, 45000, 64000);
    expect(res.status).toBe('DEFICIT');
    expect(res.discrepancy).toBe(-1000);
    expect(res.message).toContain('Déficit de caisse');
    expect(res.message).toContain('1000 FCFA');
  });

  it('should detect cash surplus', () => {
    const res = service.reconcile(20000, 45000, 65500);
    expect(res.status).toBe('SURPLUS');
    expect(res.discrepancy).toBe(500);
    expect(res.message).toContain('Excédent de caisse');
    expect(res.message).toContain('500 FCFA');
  });
});
