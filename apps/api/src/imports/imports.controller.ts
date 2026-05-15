import { Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString, Max, Min } from 'class-validator';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '../auth/auth.guard';
import { QddPeriodType, UserRole } from '../common/domain';
import { DataStoreService } from '../store/store.service';
import { ImportsService } from './imports.service';

class PreviewImportDto {
  @IsEnum(QddPeriodType)
  periodType!: QddPeriodType;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(12)
  referenceMonth!: number;
}

class ConfirmImportDto {
  @IsString()
  previewId!: string;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('imports/qdd')
export class ImportsController {
  constructor(
    private readonly imports: ImportsService,
    private readonly store: DataStoreService,
  ) {}

  @Get()
  @Roles(UserRole.SeplanAdmin)
  listImports() {
    return this.store.listImports();
  }

  @Get(':importId/actions')
  @Roles(UserRole.SeplanAdmin)
  getImportActions(@Param('importId') importId: string) {
    return this.store.getImportActions(importId);
  }

  @Post('preview')
  @Roles(UserRole.SeplanAdmin)
  @UseInterceptors(FileInterceptor('file'))
  preview(@UploadedFile() file: Express.Multer.File | undefined, @Body() body: PreviewImportDto) {
    return this.imports.preview(file, body.periodType, body.referenceMonth);
  }

  @Post('confirm')
  @Roles(UserRole.SeplanAdmin)
  confirm(@Body() body: ConfirmImportDto) {
    return this.imports.confirm(body.previewId);
  }
}
