import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import {
  AssignmentStatus,
  THEME_AXES,
  THEME_CLASSIFICATIONS,
  ThemeBudget,
  User,
  UserRole,
  ValidationStatus,
} from '../common/domain';
import { DataStoreService } from '../store/store.service';
import { BudgetService } from './budget.service';

class CreateAssignmentDto {
  @IsString()
  actionId!: string;

  @IsEnum(ThemeBudget)
  theme!: ThemeBudget;

  @IsString()
  axis!: string;

  @IsString()
  classification!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  weightingFactor?: number;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;
}

class UpdateAssignmentDto {
  @IsOptional()
  @IsString()
  axis?: string;

  @IsOptional()
  @IsString()
  classification?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  weightingFactor?: number;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class BudgetController {
  constructor(
    private readonly budget: BudgetService,
    private readonly store: DataStoreService,
  ) {}

  @Get('metadata')
  metadata() {
    return {
      themes: Object.values(ThemeBudget),
      axes: THEME_AXES,
      classifications: THEME_CLASSIFICATIONS,
      assignmentStatuses: Object.values(AssignmentStatus),
      validationStatuses: Object.values(ValidationStatus),
    };
  }

  @Get('organizations')
  organizations() {
    return this.budget.listOrganizations();
  }

  @Get('budget-actions')
  actions(
    @CurrentUser() user: User,
    @Query('year') year?: string,
    @Query('organizationCode') organizationCode?: string,
    @Query('unitCode') unitCode?: string,
    @Query('theme') theme?: ThemeBudget,
    @Query('axis') axis?: string,
    @Query('validationStatus') validationStatus?: ValidationStatus,
  ) {
    return this.budget.listActions(user, {
      year: year ? Number(year) : undefined,
      organizationCode,
      unitCode,
      theme,
      axis,
      validationStatus,
    });
  }

  @Get('thematic-assignments')
  assignments() {
    return this.budget.listAssignments();
  }

  @Post('thematic-assignments')
  @Roles(UserRole.SeplanAdmin)
  createAssignment(@CurrentUser() user: User, @Body() body: CreateAssignmentDto) {
    return this.store.createAssignment({
      ...body,
      status: body.status ?? AssignmentStatus.Ready,
      createdBy: user.id,
    });
  }

  @Patch('thematic-assignments/:id')
  @Roles(UserRole.SeplanAdmin)
  updateAssignment(@Param('id') id: string, @Body() body: UpdateAssignmentDto) {
    return this.store.updateAssignment(id, body);
  }

  @Delete('thematic-assignments/:id')
  @Roles(UserRole.SeplanAdmin)
  deleteAssignment(@Param('id') id: string) {
    this.store.deleteAssignment(id);
    return { ok: true };
  }

  @Get('reports/summary')
  summary(@CurrentUser() user: User) {
    return this.budget.getSummary(user);
  }
}
