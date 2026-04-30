import { Module }       from '@nestjs/common'
import { BullModule }  from '@nestjs/bullmq'
import { QUEUE }       from './constants/queues'
import { JobsService } from './jobs.service'
import { SyncProcessor }          from './processors/sync.processor'
import { NotificationsProcessor } from './processors/notifications.processor'
import { MaintenanceProcessor }   from './processors/maintenance.processor'

// BillingProcessor lives in BillingModule to avoid circular dependency
// (BillingModule imports JobsModule for JobsService; JobsModule must not import BillingModule)
import { SyncModule }  from '@modules/sync/sync.module'
import { AuthModule }  from '@modules/auth/auth.module'

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE.SYNC },
      { name: QUEUE.BILLING },
      { name: QUEUE.NOTIFICATIONS },
      { name: QUEUE.MAINTENANCE },
    ),
    SyncModule,
    AuthModule,   // provides TokenService (for MaintenanceProcessor)
  ],
  providers: [
    JobsService,
    SyncProcessor,
    NotificationsProcessor,
    MaintenanceProcessor,
  ],
  exports: [JobsService],
})
export class JobsModule {}
