import { Injectable } from '@nestjs/common';
import { DataStoreService } from '../store/store.service';
import { ThemeBudget, User, ValidationStatus } from '../common/domain';

@Injectable()
export class BudgetService {
  constructor(private readonly store: DataStoreService) {}

  listOrganizations() {
    return this.store.listOrganizations();
  }

  listActions(
    user: User,
    filters: {
      year?: number;
      organizationCode?: string;
      unitCode?: string;
      theme?: ThemeBudget;
      axis?: string;
      validationStatus?: ValidationStatus;
    },
  ) {
    return this.store.listActions(user, filters).map((action) => ({
      ...action,
      assignments: action.assignmentIds
        .map((id) => this.store.assignments.get(id))
        .filter(Boolean),
      expenseLinesCount: action.expenseLines.length,
    }));
  }

  listAssignments() {
    return [...this.store.assignments.values()];
  }

  getSummary(user: User) {
    return this.store.getSummary(user);
  }
}
