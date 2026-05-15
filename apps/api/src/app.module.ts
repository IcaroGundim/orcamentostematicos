import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BudgetModule } from './budget/budget.module';
import { ImportsModule } from './imports/imports.module';
import { StoreModule } from './store/store.module';
import { ValidationsModule } from './validations/validations.module';

@Module({
  imports: [StoreModule, AuthModule, BudgetModule, ImportsModule, ValidationsModule],
})
export class AppModule {}
