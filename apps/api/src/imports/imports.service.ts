import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { QddPeriodType } from '../common/domain';
import { DataStoreService } from '../store/store.service';
import { ParsedQdd, parseQdd } from './qdd-parser';

@Injectable()
export class ImportsService {
  private readonly pending = new Map<string, ParsedQdd>();

  constructor(private readonly store: DataStoreService) {}

  preview(file: Express.Multer.File | undefined, periodType: QddPeriodType, referenceMonth: number) {
    if (!file) {
      throw new BadRequestException('Envie um arquivo QDD no campo file.');
    }
    const parsed = parseQdd(
      file.originalname,
      file.buffer,
      (prefix) => this.store.createId(prefix),
      { periodType, referenceMonth },
    );
    const previewId = this.store.createId('preview');
    this.pending.set(previewId, parsed);
    return {
      previewId,
      ...parsed.importRecord,
      sampleActions: parsed.sampleActions,
      organizationsCount: parsed.organizationsCount,
      unitsCount: parsed.unitsCount,
    };
  }

  confirm(previewId: string) {
    const parsed = this.pending.get(previewId);
    if (!parsed) {
      throw new NotFoundException('Prévia de importação não encontrada ou expirada.');
    }
    this.store.addImportedBudget(parsed.importRecord, parsed.actions);
    this.pending.delete(previewId);
    return {
      import: parsed.importRecord,
      organizationsCount: parsed.organizationsCount,
      unitsCount: parsed.unitsCount,
      actionsCount: parsed.actions.length,
    };
  }
}
