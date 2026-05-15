import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActionValidation, User, UserRole, ValidationStatus, ThemeBudget } from '../common/domain';
import { DataStoreService } from '../store/store.service';

@Injectable()
export class ValidationsService {
  constructor(private readonly store: DataStoreService) {}

  createCycle(name: string, year: number, theme: ThemeBudget) {
    return this.store.createCycle(name, year, theme);
  }

  listCycles() {
    return [...this.store.cycles.values()]
      .map((cycle) => {
        const cycleValidations = [...this.store.validations.values()].filter((v) => v.cycleId === cycle.id);
        return {
          ...cycle,
          validationCount: cycleValidations.length,
          validationsByStatus: [
            ValidationStatus.Draft,
            ValidationStatus.Submitted,
            ValidationStatus.Returned,
            ValidationStatus.Approved,
          ].map((status) => ({
            status,
            count: cycleValidations.filter((v) => v.status === status).length,
          })),
        };
      })
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  }

  closeCycle(id: string) {
    const cycle = this.store.cycles.get(id);
    if (!cycle) throw new NotFoundException('Ciclo não encontrado.');
    if (cycle.status === 'ENCERRADO') throw new ForbiddenException('Ciclo já encerrado.');
    this.store.cycles.set(id, { ...cycle, status: 'ENCERRADO', closedAt: new Date().toISOString() });
    return this.listCycles().find((c) => c.id === id)!;
  }

  deleteCycle(id: string) {
    if (!this.store.cycles.has(id)) throw new NotFoundException('Ciclo não encontrado.');
    this.store.cycles.delete(id);
    const toDelete = [...this.store.validations.entries()]
      .filter(([, v]) => v.cycleId === id)
      .map(([key]) => key);
    for (const key of toDelete) {
      this.store.validations.delete(key);
    }
  }

  getCycle(id: string) {
    const cycle = this.store.cycles.get(id);
    if (!cycle) {
      return null;
    }
    return {
      ...cycle,
      validations: [...this.store.validations.values()].filter((validation) => validation.cycleId === id),
    };
  }

  listMine(user: User) {
    return this.store.listValidations(user).map((validation) => this.hydrateValidation(validation));
  }

  saveDraft(user: User, id: string, patch: Partial<ActionValidation>) {
    const current = this.store.getValidationOrThrow(id);
    this.ensureCanEdit(user, current);
    if (![ValidationStatus.Draft, ValidationStatus.Returned].includes(current.status)) {
      throw new ForbiddenException('Somente validações em rascunho ou devolvidas podem ser editadas.');
    }
    return this.hydrateValidation(this.store.updateValidation(id, { ...patch, status: current.status }));
  }

  submit(user: User, id: string) {
    const current = this.store.getValidationOrThrow(id);
    this.ensureCanEdit(user, current);
    if (![ValidationStatus.Draft, ValidationStatus.Returned].includes(current.status)) {
      throw new ForbiddenException('Esta validação não pode ser enviada neste status.');
    }
    return this.hydrateValidation(
      this.store.updateValidation(id, {
        status: ValidationStatus.Submitted,
        submittedAt: new Date().toISOString(),
      }),
    );
  }

  approve(id: string, reviewerComment?: string) {
    return this.hydrateValidation(
      this.store.updateValidation(id, {
        status: ValidationStatus.Approved,
        reviewerComment,
        reviewedAt: new Date().toISOString(),
      }),
    );
  }

  returnToSecretary(id: string, reviewerComment: string) {
    return this.hydrateValidation(
      this.store.updateValidation(id, {
        status: ValidationStatus.Returned,
        reviewerComment,
        reviewedAt: new Date().toISOString(),
      }),
    );
  }

  revertApproval(id: string) {
    const current = this.store.getValidationOrThrow(id);
    if (current.status !== ValidationStatus.Approved) {
      throw new ForbiddenException('Somente validações aprovadas podem ter a aprovação revertida.');
    }
    return this.hydrateValidation(
      this.store.updateValidation(id, {
        status: ValidationStatus.Submitted,
        reviewerComment: undefined,
        reviewedAt: undefined,
      }),
    );
  }

  private hydrateValidation(validation: ActionValidation) {
    return {
      ...validation,
      action: this.store.actions.get(validation.actionId),
      assignment: this.store.assignments.get(validation.assignmentId),
      cycle: this.store.cycles.get(validation.cycleId),
    };
  }

  private ensureCanEdit(user: User, validation: ActionValidation) {
    if (user.role !== UserRole.SecretariaRepresentante) {
      throw new ForbiddenException('Apenas representantes de secretarias preenchem validações.');
    }
    if (validation.organizationCode !== user.organizationCode) {
      throw new ForbiddenException('Esta validação pertence a outra secretaria.');
    }
    if (user.unitCode && validation.unitCode !== user.unitCode) {
      throw new ForbiddenException('Esta validação pertence a outra unidade.');
    }
  }
}
