import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BudgetModule } from './budget/budget.module';
import { ImportsModule } from './imports/imports.module';
import { StoreModule } from './store/store.module';
import { ValidationsModule } from './validations/validations.module';
import { AppController } from './app.controller';

@Module({
  imports: [PrismaModule, StoreModule, AuthModule, BudgetModule, ImportsModule, ValidationsModule],
  controllers: [AppController],
})
export class AppModule {}
