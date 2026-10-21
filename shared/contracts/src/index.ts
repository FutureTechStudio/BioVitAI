import { z } from 'zod';
export * from './profile-context.js';

// P0 review contracts only. Authentication and authorization are P1 services.
const id = z.string().uuid();
const version = z.string().regex(/^\d+\.\d+\.\d+$/);
export const EvidenceRefSchema = z
  .object({
    profileId: id,
    sourceId: id,
    revision: z.number().int().positive(),
    verification: z.enum(['verified', 'pending', 'superseded']),
    observedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

const common = {
  schemaVersion: z.literal('1.0.0'),
  traceId: id,
  locale: z.enum(['en', 'ar']),
  promptTemplateId: z.string().min(1),
  promptVersion: version,
  policyVersion: version,
  budget: z
    .object({
      maxInputTokens: z.number().int().positive(),
      maxOutputTokens: z.number().int().positive(),
      timeoutMs: z.number().int().positive(),
      maxCostMicrounits: z.number().int().nonnegative(),
    })
    .strict(),
};

const personal = {
  actorId: id,
  profileId: id,
  authorizationVersion: z.string().min(1),
  consentVersion: z.string().min(1),
  evidence: z.array(EvidenceRefSchema),
};

export const AIRequestSchema = z
  .discriminatedUnion('task', [
    z
      .object({
        ...common,
        ...personal,
        task: z.literal('explain_health_comparison'),
        safetyClass: z.literal('health_explanation'),
      })
      .strict(),
    z
      .object({
        ...common,
        ...personal,
        task: z.literal('coach_wellness'),
        safetyClass: z.literal('wellness'),
        approvedActionIds: z.array(id),
      })
      .strict(),
    // Moderation cannot carry private profile context or clinical evidence.
    z
      .object({
        ...common,
        task: z.literal('triage_community'),
        safetyClass: z.literal('moderation'),
        postId: id,
        contentTrust: z.literal('untrusted'),
      })
      .strict(),
  ])
  .superRefine((request, ctx) => {
    if (request.task === 'triage_community') return;
    request.evidence.forEach((ref, index) => {
      if (
        ref.profileId !== request.profileId ||
        ref.verification !== 'verified'
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['evidence', index],
          message:
            'Evidence must be verified and belong to the selected profile',
        });
      }
    });
  });

export type AIRequest = z.infer<typeof AIRequestSchema>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type GatewayResult<T> =
  | { status: 'ok'; data: T; traceId: string; policyVersion: string }
  | {
      status: 'unavailable' | 'rejected';
      code:
        | 'PROVIDER_UNAVAILABLE'
        | 'INVALID_OUTPUT'
        | 'POLICY_DENIED'
        | 'BUDGET_EXCEEDED';
      traceId: string;
    };

export interface AIGateway {
  generateStructured<T>(
    request: AIRequest,
    schema: z.ZodType<T>,
  ): Promise<GatewayResult<T>>;
}

// Provider adapters are implemented only under infrastructure/ai-gateway.
// Wire inputs are minimized by the gateway; never pass AIRequest directly to providers.
export interface ProviderAdapter {
  readonly providerId: string;
  generate(input: {
    prompt: string;
    maxOutputTokens: number;
    timeoutMs: number;
  }): Promise<unknown>;
}

export const ToolDefinitionSchema = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9_]*$/),
    version,
    owner: z.enum(['health', 'wellness', 'community']),
    authorizationPolicyId: z.string().min(1),
    profileScoped: z.boolean(),
    sensitivity: z.enum(['public', 'personal', 'health']),
    cachePolicy: z.enum(['none', 'profile_permission_versioned', 'public']),
    maxRows: z.number().int().positive(),
    timeoutMs: z.number().int().positive(),
    fixtureId: z.string().min(1),
    telemetrySchemaVersion: version,
    inputSchemaId: z.string().min(1),
    outputSchemaId: z.string().min(1),
    errorSchemaId: z.string().min(1),
    operation: z.enum(['read', 'write']),
    requiresConfirmation: z.boolean(),
  })
  .strict()
  .superRefine((tool, ctx) => {
    if (
      (tool.operation === 'write' && !tool.requiresConfirmation) ||
      (tool.sensitivity !== 'public' &&
        (!tool.profileScoped || tool.cachePolicy === 'public')) ||
      (tool.owner === 'community' && tool.sensitivity === 'health')
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Unsafe tool policy combination',
      });
    }
  });
