import { Global, Module } from '@nestjs/common';
import { DataStoreService } from './store.service';

@Global()
@Module({
  providers: [DataStoreService],
  exports: [DataStoreService],
})
export class StoreModule {}
