# AI Orchestrator and Tool Calling

## Design
The LLM plans and communicates. Server-side services authorize, retrieve and calculate. The model is never the authority for identity, permissions, numeric truth or clinical rules.

## Request flow
1. Authenticate session; derive actor_id server-side.
2. Resolve selected_profile_id from authorized session/UI state.
3. Load conversation summary and lightweight health context manifest.
4. Choose allowed tool set based on grants and product feature flags.
5. Send user message, compact instructions, context and tool schemas to LLM.
6. Validate every proposed tool name and JSON arguments.
7. Replace/verify profile ID against server-side selected profile.
8. Recheck authorization immediately before execution.
9. Run tools with timeouts, output size limits and audit trail.
10. Return minimal tool result to model; allow bounded additional steps.
11. Validate final structured response and source IDs.
12. Render response; log privacy-safe performance metrics.

## Orchestration pseudocode

    async function answerChat(actor, session, message) {
      const profile = await resolveAuthorizedProfile(actor, session);
      const context = await getHealthContext(actor, profile.id);
      const history = await loadCompactHistory(session.id, profile.id);
      let messages = composeMessages(history, context, message);

      for (let step = 0; step < MAX_TOOL_STEPS; step++) {
        const decision = await model.respond({
          messages,
          tools: allowedReadTools(actor, profile)
        });

        if (decision.type === "final") {
          return validateAndGroundResponse(decision, actor, profile);
        }

        const calls = validateToolCalls(decision.calls);
        const results = await executeAuthorizedTools(calls, actor, profile);
        messages = appendToolResults(messages, results);
      }

      return safePartialAnswer("I couldn't complete every check.");
    }

## Controls
- Max tool steps, max parallel calls, per-tool timeouts and global deadline.
- Tool allowlist; strict schema validation; no arbitrary URLs, SQL or code execution.
- Parallelize independent reads, but respect report selection dependencies.
- Use idempotency and explicit confirmation for future write tools.
- Retries only for safe idempotent reads; circuit breakers for failing services.
- Detect prompt injection in retrieved text by treating it as data, not instructions.
- Keep the orchestrator stateless apart from persisted authorized session data.

## Example plan
User: "Compare my latest blood report with the previous one."

Tool plan:
get_health_context → find_reports(type=blood, verified=true, sort=observed_at desc) → compare_reports(latest_id, previous_comparable_id) → optionally get_biomarker_trends for context → render report_comparison + chart + source cards.

## Failure handling
No report: explain absence.
Unverified report: identify pending verification and offer verified alternative.
Incomparable tests: explain exclusion.
Revoked grant: stop and clear sensitive context.
Tool timeout: return partial sourced information only, clearly labeled.

## Security invariant
Never allow the model to pick an arbitrary profile outside the server's authorization boundary. Profile switches are explicit app events, not LLM guesses.
