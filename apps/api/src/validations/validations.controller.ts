import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { ThemeBudget, User, UserRole } from '../common/domain';
import { ValidationsService } from './validations.service';

class DeliveryDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  description!: string;

  @IsNumber()
  quantity!: number;

  @IsString()
  unit!: string;

  @IsString()
  municipality!: string;

  @IsString()
  beneficiaries!: string;
}

class EvidenceDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  label!: string;

  @IsString()
  url!: string;
}

class SaveDraftDto {
  @IsOptional()
  @IsString()
  executionStatus?: string;

  @IsOptional()
  @IsString()
  realizedDescription?: string;

  @IsOptional()
  @IsNumber()
  informedExecutedValue?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryDto)
  deliveries?: DeliveryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenceDto)
  evidences?: EvidenceDto[];

  @IsOptional()
  @IsString()
  observations?: string;
}

class CreateCycleDto {
  @IsString()
  name!: string;

  @IsNumber()
  year!: number;

  @IsEnum(ThemeBudget)
  theme!: ThemeBudget;
}

class ReviewDto {
  @IsOptional()
  @IsString()
  reviewerComment?: string;
}

class ReturnDto {
  @IsString()
  reviewerComment!: string;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class ValidationsController {
  constructor(private readonly validations: ValidationsService) {}

  @Post('validation-cycles')
  @Roles(UserRole.SeplanAdmin)
  createCycle(@Body() body: CreateCycleDto) {
    return this.validations.createCycle(body.name, body.year, body.theme);
  }

  @Get('validation-cycles')
  listCycles() {
    return this.validations.listCycles();
  }

  @Post('validation-cycles/:id/close')
  @Roles(UserRole.SeplanAdmin)
  closeCycle(@Param('id') id: string) {
    return this.validations.closeCycle(id);
  }

  @Delete('validation-cycles/:id')
  @Roles(UserRole.SeplanAdmin)
  deleteCycle(@Param('id') id: string) {
    this.validations.deleteCycle(id);
    return { ok: true };
  }

  @Get('validation-cycles/:id')
  getCycle(@Param('id') id: string) {
    const cycle = this.validations.getCycle(id);
    if (!cycle) {
      throw new NotFoundException('Ciclo de validação não encontrado.');
    }
    return cycle;
  }

  @Get('validations/my')
  listMine(@CurrentUser() user: User) {
    return this.validations.listMine(user);
  }

  @Patch('validations/:id/draft')
  @Roles(UserRole.SecretariaRepresentante)
  saveDraft(@CurrentUser() user: User, @Param('id') id: string, @Body() body: SaveDraftDto) {
    return this.validations.saveDraft(user, id, {
      ...body,
      deliveries: body.deliveries?.map((delivery) => ({ id: delivery.id ?? randomUUID(), ...delivery })),
      evidences: body.evidences?.map((evidence) => ({ id: evidence.id ?? randomUUID(), ...evidence })),
    });
  }

  @Post('validations/:id/submit')
  @Roles(UserRole.SecretariaRepresentante)
  submit(@CurrentUser() user: User, @Param('id') id: string) {
    return this.validations.submit(user, id);
  }

  @Post('validations/:id/approve')
  @Roles(UserRole.SeplanAdmin)
  approve(@Param('id') id: string, @Body() body: ReviewDto) {
    return this.validations.approve(id, body.reviewerComment);
  }

  @Post('validations/:id/return')
  @Roles(UserRole.SeplanAdmin)
  return(@Param('id') id: string, @Body() body: ReturnDto) {
    return this.validations.returnToSecretary(id, body.reviewerComment);
  }

  @Post('validations/:id/revert')
  @Roles(UserRole.SeplanAdmin)
  revert(@Param('id') id: string) {
    return this.validations.revertApproval(id);
  }
}
