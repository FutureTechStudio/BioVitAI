import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { postgresFixture } from '../helpers/postgres.mjs';
import { migrateDatabase } from '../../dist/infrastructure/db/migrations.js';
import { checkHealthSchema } from '../../dist/modules/health/src/infrastructure/schema.js';

test(
  'canonical health schema and isolation on real PostgreSQL',
  { timeout: 120000 },
  async (t) => {
    const fixture = await postgresFixture();
    t.after(() => fixture.close());
    const pool = fixture.pool;
    async function insert(table, values, connection = pool) {
      assert.match(table, /^\w+$/);
      const columns = Object.keys(values);
      for (const col of columns) assert.match(col, /^\w+$/);
      return (
        await connection.query(
          `INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
          Object.values(values),
        )
      ).rows[0];
    }
    const actor = randomUUID(),
      profileA = randomUUID(),
      profileB = randomUUID();
    await t.test(
      'additive migration preserves existing profiles and is idempotent',
      async () => {
        const prior = path.join(fixture.directory, 'prior-health-migrations');
        await fs.mkdir(prior);
        for (const file of [
          '0001_identity.sql',
          '0002_profile_access.sql',
          '0003_managed_profile_context.sql',
        ])
          await fs.copyFile(
            path.resolve('infrastructure/db/migrations', file),
            path.join(prior, file),
          );
        await migrateDatabase(pool, prior);
        await pool.query(
          'INSERT INTO identity_user(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,now(),now())',
          [actor, 'Synthetic health manager', 'health-manager@example.test'],
        );
        await pool.query(
          "INSERT INTO identity_profile(id,owner_id,display_name,kind) VALUES($1,$3,'Synthetic self','self'),($2,$3,'Synthetic relative','family')",
          [profileA, profileB, actor],
        );
        await migrateDatabase(
          pool,
          path.resolve('infrastructure/db/migrations'),
        );
        await migrateDatabase(
          pool,
          path.resolve('infrastructure/db/migrations'),
        );
        await checkHealthSchema(pool);
        assert.equal(
          (await pool.query('SELECT count(*) FROM identity_profile')).rows[0]
            .count,
          '2',
        );
        assert.equal(
          (await pool.query('SELECT count(*) FROM biovitai_migrations')).rows[0]
            .count,
          '11',
        );
        assert.equal(
          (await pool.query('SELECT count(*) FROM health_rule_versions'))
            .rows[0].count,
          '0',
        );
      },
    );
    async function bundle(profileId) {
      const doc = await insert('health_source_documents', {
        profile_id: profileId,
        storage_object_id: randomUUID(),
        content_sha256: 'a'.repeat(64),
        media_type: 'application/pdf',
        byte_length: '1024',
        page_count: 2,
        uploaded_by: actor,
      });
      const report = await insert('health_diagnostic_reports', {
        profile_id: profileId,
        document_id: doc.id,
        facility_name: 'Synthetic facility',
        issued_precision: 'date',
        issued_date: '2026-10-19',
      });
      const page = await insert('health_report_pages', {
        profile_id: profileId,
        document_id: doc.id,
        page_number: 1,
      });
      async function field(rawText) {
        return insert('health_raw_fields', {
          profile_id: profileId,
          document_id: doc.id,
          report_id: report.id,
          page_id: page.id,
          raw_text: rawText,
          x0: '0.1',
          y0: '0.2',
          x1: '0.4',
          y1: '0.3',
          extractor_name: 'synthetic fixture',
          extractor_version: '1',
          confidence: '0.95',
        });
      }
      const name = await field('Synthetic marker'),
        value = await field('<5'),
        unit = await field('mg/L'),
        specimenField = await field('Serum'),
        method = await field('Synthetic method'),
        time = await field('19 October 2026'),
        range = await field('0 - 10');
      const specimen = await insert('health_specimens', {
        profile_id: profileId,
        report_id: report.id,
        original_text: 'Serum',
        field_id: specimenField.id,
        collected_precision: 'date',
        collected_date: '2026-10-19',
        collected_time_field_id: time.id,
      });
      const base = {
        profile_id: profileId,
        report_id: report.id,
        original_name: 'Synthetic marker',
        original_value: '<5',
        original_unit: 'mg/L',
        name_field_id: name.id,
        value_field_id: value.id,
        unit_field_id: unit.id,
        reference_field_id: range.id,
        method_field_id: method.id,
        observed_time_field_id: time.id,
        value_kind: 'quantity',
        numeric_value: '5',
        comparator: '<',
        reference_low: '0',
        reference_high: '10',
        reference_text: '0 - 10',
        specimen_id: specimen.id,
        method: 'Synthetic method',
        observed_precision: 'date',
        observed_date: '2026-10-19',
        recorded_by: actor,
      };
      const source = await insert('health_source_observations', base);
      return {
        profileId,
        doc,
        report,
        page,
        field,
        name,
        value,
        unit,
        specimen,
        base,
        source,
      };
    }
    const a = await bundle(profileA),
      b = await bundle(profileB);
    const state = async (id) =>
      (
        await pool.query(
          'SELECT verification_state FROM health_effective_source_observations WHERE id=$1',
          [id],
        )
      ).rows[0].verification_state;
    async function identity(data, state) {
      return insert('health_report_identity_actions', {
        profile_id: data.profileId,
        report_id: data.report.id,
        actor_id: actor,
        state,
        reason: 'Synthetic identity review',
      });
    }
    async function verify(data, sourceId, state = 'verified') {
      return insert('health_verification_actions', {
        profile_id: data.profileId,
        report_id: data.report.id,
        observation_id: sourceId,
        actor_id: actor,
        state,
        reason: 'Synthetic verification action',
      });
    }
    await t.test(
      'raw values, comparator, specimen, method and date precision round-trip without invention',
      async () => {
        assert.equal(a.source.original_value, '<5');
        assert.equal(a.source.numeric_value, '5');
        assert.equal(a.source.comparator, '<');
        assert.equal(a.source.method, 'Synthetic method');
        assert.equal(a.source.specimen_id, a.specimen.id);
        assert.equal(a.source.observed_at, null);
        assert.equal(a.source.observed_date, '2026-10-19');
        assert.equal(a.source.resulted_at, null);
        assert.equal(a.source.resulted_precision, 'unknown');
        assert.equal(a.source.canonical_value, null);
        assert.equal(a.source.normalization_rule_id, null);
        const raw = (
          await pool.query(
            'SELECT raw_text FROM health_raw_fields WHERE id=$1',
            [a.source.value_field_id],
          )
        ).rows[0];
        assert.equal(raw.raw_text, '<5');
        const precise = await insert('health_source_observations', {
          ...a.base,
          numeric_value: '12345678901234567890.12345678901234567890',
          comparator: '=',
        });
        assert.equal(
          precise.numeric_value,
          '12345678901234567890.12345678901234567890',
        );
        const unknown = await insert('health_source_observations', {
          ...a.base,
          observed_precision: 'unknown',
          observed_date: null,
          observed_time_field_id: null,
        });
        assert.equal(unknown.observed_at, null);
        const qualitative = await insert('health_source_observations', {
          ...a.base,
          value_kind: 'qualitative',
          numeric_value: null,
          comparator: null,
          qualitative_value: 'Negative',
        });
        assert.equal(qualitative.numeric_value, null);
        const missing = await insert('health_source_observations', {
          ...a.base,
          value_kind: 'missing',
          numeric_value: null,
          comparator: null,
          missing_reason: 'Not performed',
        });
        assert.equal(missing.numeric_value, null);
      },
    );
    await t.test(
      'database rejects cross-profile/report/page links and invalid values or source geometry',
      async () => {
        await assert.rejects(
          insert('health_source_observations', {
            ...a.base,
            value_field_id: b.value.id,
          }),
          { code: '23503' },
        );
        await assert.rejects(
          insert('health_source_observations', {
            ...a.base,
            report_id: b.report.id,
          }),
          { code: '23503' },
        );
        await assert.rejects(
          insert('health_source_observations', {
            ...a.base,
            specimen_id: b.specimen.id,
          }),
          { code: '23503' },
        );
        await assert.rejects(
          insert('health_raw_fields', {
            profile_id: profileA,
            document_id: a.doc.id,
            report_id: a.report.id,
            page_id: b.page.id,
            raw_text: 'Synthetic',
            x0: '0',
            y0: '0',
            x1: '1',
            y1: '1',
            extractor_name: 'fixture',
            extractor_version: '1',
          }),
          { code: '23503' },
        );
        await assert.rejects(
          insert('health_report_pages', {
            profile_id: profileA,
            document_id: a.doc.id,
            page_number: 3,
          }),
          { code: '23514' },
        );
        for (const numeric_value of ['NaN', 'Infinity', '-Infinity'])
          await assert.rejects(
            insert('health_source_observations', { ...a.base, numeric_value }),
            { code: '23514' },
          );
        await assert.rejects(
          insert('health_source_observations', {
            ...a.base,
            reference_low: '11',
            reference_high: '10',
          }),
          { code: '23514' },
        );
        await assert.rejects(
          insert('health_source_observations', {
            ...a.base,
            value_kind: 'missing',
            missing_reason: 'Not performed',
          }),
          { code: '23514' },
        );
        await assert.rejects(
          insert('health_source_observations', {
            ...a.base,
            observed_date: null,
          }),
          { code: '23514' },
        );
        const fields = { ...a.value };
        delete fields.id;
        delete fields.created_at;
        await assert.rejects(
          insert('health_raw_fields', { ...fields, x0: '0.8', x1: '0.1' }),
          { code: '23514' },
        );
        await assert.rejects(
          insert('health_raw_fields', { ...fields, confidence: '1.01' }),
          { code: '23514' },
        );
        const sameProfileOther = await bundle(profileA);
        await assert.rejects(
          insert('health_source_observations', {
            ...a.base,
            value_field_id: sameProfileOther.value.id,
          }),
          { code: '23503' },
        );
      },
    );
    await t.test(
      'identity quarantine and append-only verification govern effective state',
      async () => {
        assert.equal(await state(a.source.id), 'identity_pending');
        await assert.rejects(verify(a, a.source.id), { code: '23514' });
        await identity(a, 'quarantined');
        assert.equal(await state(a.source.id), 'quarantined');
        await assert.rejects(verify(a, a.source.id), { code: '23514' });
        await identity(a, 'matched');
        assert.equal(await state(a.source.id), 'unverified');
        await verify(a, a.source.id);
        assert.equal(await state(a.source.id), 'verified');
        const explicit = await insert('health_report_identity_actions', {
          sequence: '1',
          profile_id: profileA,
          report_id: a.report.id,
          actor_id: actor,
          state: 'matched',
          reason: 'Synthetic ordering test',
        });
        assert.notEqual(explicit.sequence, '1');
        assert.equal(await state(a.source.id), 'needs_review');
        await verify(a, a.source.id);
        await identity(a, 'matched');
        assert.equal(await state(a.source.id), 'needs_review');
        await verify(a, a.source.id);
        assert.equal(await state(a.source.id), 'verified');
        await verify(a, a.source.id, 'needs_review');
        assert.equal(await state(a.source.id), 'needs_review');
        await verify(a, a.source.id);
        assert.equal(await state(a.source.id), 'verified');
      },
    );
    let group, decision, aggregate;
    const rules = {};
    await t.test(
      'grouping calculates nothing; derivation needs reviewed rule and sealed verified lineage',
      async () => {
        group = await insert('health_observation_groups', {
          profile_id: profileA,
          kind: 'rerun',
          label: 'Synthetic separate results',
        });
        await insert('health_group_members', {
          profile_id: profileA,
          group_id: group.id,
          observation_id: a.source.id,
        });
        assert.equal(
          (
            await pool.query(
              'SELECT count(*) FROM health_aggregated_observations',
            )
          ).rows[0].count,
          '0',
        );
        await assert.rejects(
          insert('health_group_members', {
            profile_id: profileA,
            group_id: group.id,
            observation_id: b.source.id,
          }),
          { code: '23503' },
        );
        rules.proposed = await insert('health_rule_versions', {
          code: 'SYNTHETIC_ONLY',
          version: 'draft',
          purpose: 'aggregation',
          definition: { fixture: true },
          rationale: 'Test fixture; not a clinical rule',
        });
        await assert.rejects(
          insert('health_rule_versions', {
            code: 'SYNTHETIC_INVALID',
            version: '1',
            purpose: 'aggregation',
            status: 'approved',
            definition: { fixture: true },
            rationale: 'Test',
            reviewed_at: new Date(),
          }),
          { code: '23514' },
        );
        decision = await insert('health_aggregation_decisions', {
          profile_id: profileA,
          group_id: group.id,
          rule_id: rules.proposed.id,
          kind: 'select',
          reason: 'Synthetic selection, not a calculation',
        });
        await insert('health_aggregation_inputs', {
          profile_id: profileA,
          group_id: group.id,
          decision_id: decision.id,
          observation_id: a.source.id,
          included: true,
          reason: 'Synthetic chosen source',
        });
        const output = {
          profile_id: profileA,
          decision_id: decision.id,
          value_kind: 'quantity',
          numeric_value: '5',
          comparator: '<',
          unit: 'mg/L',
        };
        await assert.rejects(insert('health_aggregated_observations', output), {
          code: '23514',
        });
        rules.approved = await insert('health_rule_versions', {
          code: 'SYNTHETIC_ONLY',
          version: 'fixture-1',
          purpose: 'aggregation',
          status: 'approved',
          definition: { fixture: true, operation: 'copy' },
          rationale: 'Synthetic identity-copy fixture, never deployed',
          reviewed_by: 'Synthetic fixture actor',
          reviewed_at: new Date(),
        });
        decision = await insert('health_aggregation_decisions', {
          profile_id: profileA,
          group_id: group.id,
          rule_id: rules.approved.id,
          kind: 'select',
          reason: 'Synthetic copy preserves comparator',
        });
        await assert.rejects(
          insert('health_aggregated_observations', {
            ...output,
            decision_id: decision.id,
          }),
          { code: '23514' },
        );
        await insert('health_aggregation_inputs', {
          profile_id: profileA,
          group_id: group.id,
          decision_id: decision.id,
          observation_id: a.source.id,
          included: true,
          reason: 'Synthetic included source',
        });
        aggregate = await insert('health_aggregated_observations', {
          ...output,
          decision_id: decision.id,
        });
        assert.equal(aggregate.comparator, '<');
        assert.equal(
          (
            await pool.query(
              'SELECT lineage_state FROM health_effective_aggregated_observations WHERE id=$1',
              [aggregate.id],
            )
          ).rows[0].lineage_state,
          'current',
        );
        const extra = await insert('health_source_observations', {
          ...a.base,
          comparator: '=',
          numeric_value: '4.4',
        });
        await insert('health_group_members', {
          profile_id: profileA,
          group_id: group.id,
          observation_id: extra.id,
        });
        await assert.rejects(
          insert('health_aggregation_inputs', {
            profile_id: profileA,
            group_id: group.id,
            decision_id: decision.id,
            observation_id: extra.id,
            included: false,
            reason: 'Late source cannot alter published lineage',
          }),
          { code: '23514' },
        );
        const noCalc = await insert('health_aggregation_decisions', {
          profile_id: profileA,
          group_id: group.id,
          kind: 'no_calculation',
          reason: 'Needs reviewed protocol',
        });
        await assert.rejects(
          insert('health_aggregated_observations', {
            ...output,
            decision_id: noCalc.id,
          }),
          { code: '23514' },
        );
      },
    );
    await t.test(
      'corrections append history, require sequential revision and invalidate dependent views',
      async () => {
        const corrected = await insert('health_source_observations', {
          ...a.base,
          revision: 2,
          previous_observation_id: a.source.id,
          correction_reason: 'Synthetic human correction',
          numeric_value: '4.4',
          comparator: '=',
        });
        assert.equal(await state(a.source.id), 'superseded');
        assert.equal(await state(corrected.id), 'unverified');
        assert.equal(
          (
            await pool.query(
              'SELECT original_value FROM health_source_observations WHERE id=$1',
              [a.source.id],
            )
          ).rows[0].original_value,
          '<5',
        );
        assert.equal(
          (
            await pool.query(
              'SELECT lineage_state FROM health_effective_aggregated_observations WHERE id=$1',
              [aggregate.id],
            )
          ).rows[0].lineage_state,
          'stale',
        );
        await assert.rejects(
          insert('health_source_observations', {
            ...a.base,
            revision: 4,
            previous_observation_id: corrected.id,
            correction_reason: 'Skip revision',
          }),
          { code: '23514' },
        );
        await assert.rejects(
          insert('health_source_observations', {
            ...a.base,
            revision: 2,
            previous_observation_id: b.source.id,
            correction_reason: 'Cross-profile correction',
          }),
          { code: '23514' },
        );
        await verify(a, corrected.id);
        assert.equal(await state(corrected.id), 'verified');
        await identity(a, 'quarantined');
        assert.equal(await state(corrected.id), 'quarantined');
      },
    );
    await t.test(
      'correction and derivation races serialize before source eligibility is checked',
      async () => {
        const c = await bundle(profileA);
        await identity(c, 'matched');
        await verify(c, c.source.id);
        const localGroup = await insert('health_observation_groups', {
          profile_id: profileA,
          kind: 'repeat',
          label: 'Synthetic race fixture',
        });
        await insert('health_group_members', {
          profile_id: profileA,
          group_id: localGroup.id,
          observation_id: c.source.id,
        });
        const localDecision = await insert('health_aggregation_decisions', {
          profile_id: profileA,
          group_id: localGroup.id,
          rule_id: rules.approved.id,
          kind: 'select',
          reason: 'Synthetic concurrent copy',
        });
        await insert('health_aggregation_inputs', {
          profile_id: profileA,
          group_id: localGroup.id,
          decision_id: localDecision.id,
          observation_id: c.source.id,
          included: true,
          reason: 'Synthetic input',
        });
        const writer = await pool.connect();
        try {
          await writer.query('BEGIN');
          await insert(
            'health_source_observations',
            {
              ...c.base,
              revision: 2,
              previous_observation_id: c.source.id,
              correction_reason: 'Synthetic concurrent correction',
              numeric_value: '4.4',
              comparator: '=',
            },
            writer,
          );
          const publish = assert.rejects(
            insert('health_aggregated_observations', {
              profile_id: profileA,
              decision_id: localDecision.id,
              value_kind: 'quantity',
              numeric_value: '5',
              comparator: '<',
              unit: 'mg/L',
            }),
            { code: '23514' },
          );
          const probe = await pool.query(
            'SELECT pg_try_advisory_xact_lock(hashtextextended($1,184226010)) AS acquired',
            [profileA],
          );
          assert.equal(probe.rows[0].acquired, false);
          await writer.query('COMMIT');
          await publish;
          assert.equal(
            (
              await pool.query(
                'SELECT count(*) FROM health_aggregated_observations WHERE decision_id=$1',
                [localDecision.id],
              )
            ).rows[0].count,
            '0',
          );
        } finally {
          await writer.query('ROLLBACK');
          writer.release();
        }
      },
    );
    await t.test(
      'normalization cannot use a proposed or wrong-purpose rule',
      async () => {
        await assert.rejects(
          insert('health_source_observations', {
            ...a.base,
            canonical_value: '5',
            canonical_unit: 'mg/L',
            normalization_rule_id: rules.proposed.id,
          }),
          { code: '23514' },
        );
        await assert.rejects(
          insert('health_source_observations', {
            ...a.base,
            canonical_value: '5',
            canonical_unit: 'mg/L',
            normalization_rule_id: rules.approved.id,
          }),
          { code: '23514' },
        );
      },
    );
    await t.test(
      'original documents, raw fields, source/derived observations and audit are immutable',
      async () => {
        for (const sql of [
          "UPDATE health_raw_fields SET raw_text='changed' WHERE id=$1",
          'DELETE FROM health_raw_fields WHERE id=$1',
        ])
          await assert.rejects(pool.query(sql, [a.value.id]), {
            code: '55000',
          });
        await assert.rejects(
          pool.query(
            'UPDATE health_source_observations SET numeric_value=0 WHERE id=$1',
            [a.source.id],
          ),
          { code: '55000' },
        );
        await assert.rejects(
          pool.query(
            'UPDATE health_source_documents SET content_sha256=$2 WHERE id=$1',
            [a.doc.id, 'b'.repeat(64)],
          ),
          { code: '55000' },
        );
        await assert.rejects(
          pool.query('DELETE FROM health_aggregated_observations WHERE id=$1', [
            aggregate.id,
          ]),
          { code: '55000' },
        );
        await assert.rejects(
          pool.query(
            "UPDATE health_verification_actions SET state='verified' WHERE profile_id=$1",
            [profileA],
          ),
          { code: '55000' },
        );
        await assert.rejects(
          pool.query('TRUNCATE health_verification_actions'),
          { code: '55000' },
        );
      },
    );
    await t.test(
      'non-owner database role and invoker views enforce profile isolation with transaction-local context',
      async () => {
        await pool.query(
          'CREATE ROLE biovitai_health_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT',
        );
        const tables = (
          await pool.query(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'health_%'",
          )
        ).rows.map((row) => row.tablename);
        for (const table of tables) {
          assert.match(table, /^health_[a-z_]+$/);
          await pool.query(
            `GRANT SELECT${table === 'health_rule_versions' ? '' : ',INSERT'} ON ${table} TO biovitai_health_runtime`,
          );
        }
        await pool.query(
          'GRANT SELECT ON health_effective_source_observations,health_effective_aggregated_observations TO biovitai_health_runtime',
        );
        await pool.query(
          'GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO biovitai_health_runtime',
        );
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SET LOCAL ROLE biovitai_health_runtime');
          assert.equal(
            (
              await client.query(
                'SELECT count(*) FROM health_source_observations',
              )
            ).rows[0].count,
            '0',
          );
          await client.query(
            "SELECT set_config('biovitai.profile_id',$1,true)",
            [profileA],
          );
          const rows = (
            await client.query(
              'SELECT profile_id FROM health_effective_source_observations',
            )
          ).rows;
          assert.ok(rows.length > 0);
          assert.ok(rows.every((row) => row.profile_id === profileA));
          assert.equal(
            (
              await client.query(
                'SELECT count(*) FROM health_source_observations WHERE id=$1',
                [b.source.id],
              )
            ).rows[0].count,
            '0',
          );
          const derived = (
            await client.query(
              'SELECT profile_id FROM health_effective_aggregated_observations',
            )
          ).rows;
          assert.ok(derived.every((row) => row.profile_id === profileA));
          await assert.rejects(
            client.query(
              'INSERT INTO health_observation_groups(profile_id,kind,label) VALUES($1,$2,$3)',
              [profileB, 'panel', 'Forbidden cross-profile write'],
            ),
            { code: '42501' },
          );
          await client.query('ROLLBACK');
          await client.query('BEGIN');
          await client.query('SET LOCAL ROLE biovitai_health_runtime');
          assert.equal(
            (
              await client.query(
                'SELECT count(*) FROM health_source_observations',
              )
            ).rows[0].count,
            '0',
          );
          await client.query(
            "SELECT set_config('biovitai.profile_id',$1,true)",
            [profileB],
          );
          assert.deepEqual(
            (
              await client.query(
                'SELECT profile_id FROM health_effective_source_observations',
              )
            ).rows.map((row) => row.profile_id),
            [profileB],
          );
          await client.query('ROLLBACK');
        } finally {
          await client.query('ROLLBACK');
          client.release();
        }
      },
    );
  },
);
