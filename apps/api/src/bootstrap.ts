import type { RuntimeConfig } from '../../../infrastructure/config/runtime.js';
import { createPostgresPool } from '../../../infrastructure/db/postgres.js';
import { createApiServer } from '../../../infrastructure/http/server.js';
import { createStatusService } from './application/status.js';
import { createIdentityAuth } from '../../../modules/identity/src/infrastructure/auth.js';
import type { AuthConfig } from '../../../modules/identity/src/infrastructure/auth.js';
import { createLocalMailer } from '../../../modules/identity/src/infrastructure/local-mailer.js';
import { createIdentityService } from '../../../modules/identity/src/application/current-actor.js';
import { createProfileService } from '../../../modules/identity/src/application/profiles.js';
import {
  createProfileStore,
  createLocalInvitationDelivery,
  invitationTokens,
} from '../../../modules/identity/src/infrastructure/profiles.js';
import { createProfileController } from './controllers/profiles.js';
import path from 'node:path';
import { checkHealthSchema } from '../../../modules/health/src/infrastructure/schema.js';
import {
  createLocalPrivateFiles,
  createPrivateObjectSecurity,
} from '../../../infrastructure/storage/local-private.js';
import { createPrivateObjectMetadata } from '../../../infrastructure/storage/postgres.js';
import { createPrivateObjects } from '../../../modules/health/src/application/private-objects.js';
import { createPrivateObjectController } from './controllers/private-objects.js';
import { createDurableJobs } from '../../../infrastructure/jobs/postgres.js';
import { createReportService } from '../../../modules/health/src/application/reports.js';
import { createReportRepository } from '../../../modules/health/src/infrastructure/reports.js';
import { createReportController } from './controllers/reports.js';
import { createConversationController } from './controllers/conversations.js';
import { createConversationService } from '../../../modules/ai/src/application/conversations.js';
import {
  createConversationStore,
  createBudgetLedger,
} from '../../../infrastructure/ai-gateway/postgres.js';
import { createOpenAIHealthGateway } from '../../../infrastructure/ai-gateway/provider.js';
import { createJourneyRepository } from '../../../modules/health/src/infrastructure/journey.js';
import { createJourneyService } from '../../../modules/health/src/application/journey.js';
import { createJourneyController } from './controllers/journey.js';

export function createLocalApplication(
  runtime: RuntimeConfig,
  config: AuthConfig,
  mailboxDirectory: string,
  privateObjectsDirectory = path.resolve('.local/private-objects'),
) {
  const pool = createPostgresPool(runtime);
  const identity = createIdentityAuth(
    pool,
    config,
    createLocalMailer(mailboxDirectory),
  );
  const service = createIdentityService(identity.sessions);
  const profiles = createProfileStore(pool);
  const profileService = createProfileService(
    profiles,
    createLocalInvitationDelivery(path.join(mailboxDirectory, 'invitations')),
    invitationTokens,
  );
  const objectMetadata = createPrivateObjectMetadata(pool);
  const objectFiles = createLocalPrivateFiles(
    privateObjectsDirectory,
    config.secret,
  );
  const objects = createPrivateObjects(
    profileService,
    objectMetadata,
    objectFiles,
    createPrivateObjectSecurity(config.secret),
    config.origin,
  );
  const jobs = createDurableJobs(pool);
  const reports = createReportRepository(pool);
  const reportFiles = createLocalPrivateFiles(
    privateObjectsDirectory,
    config.secret,
    20 * 1024 * 1024,
  );
  const reportService = createReportService(
    profileService,
    reports,
    reportFiles,
    createPrivateObjectSecurity(config.secret),
  );
  const reportController = createReportController(reportService);
  const journey = createJourneyRepository(pool, config.secret);
  const journeyController = createJourneyController(
    createJourneyService(profileService, journey),
  );
  const conversationController = createConversationController(
    createConversationService(
      profileService,
      createConversationStore(pool, config.secret),
      createOpenAIHealthGateway(createBudgetLedger(pool)),
      reportService,
    ),
  );
  const server = createApiServer(
    createStatusService({
      check: async () => {
        await identity.ready();
        await profiles.ready();
        await checkHealthSchema(pool);
        await objectMetadata.ready();
        await jobs.ready();
        await reports.ready();
        await journey.ready();
      },
      close: () => pool.end(),
    }),
    {
      origin: config.origin,
      ...(config.webOrigin ? { webOrigin: config.webOrigin } : {}),
      handler: identity.handler,
      currentActor: service.currentActor,
      profiles: createProfileController(profileService),
      storage: createPrivateObjectController(objects),
      health: (request, actor) =>
        /\/v1\/health\/journey(?:\/|$)/.test(new URL(request.url).pathname)
          ? journeyController(request, actor)
          : /\/v1\/health\/(?:conversations|messages)(?:\/|$)/.test(
                new URL(request.url).pathname,
              )
            ? conversationController(request, actor)
            : reportController(request, actor),
    },
  );
  return { server, close: () => pool.end() };
}
