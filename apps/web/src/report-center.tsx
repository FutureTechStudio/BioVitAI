'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { z } from 'zod';
import {
  IngestionSchema,
  ReportDetailSchema,
  REPORT_MAX_BYTES,
} from '../../../shared/contracts/src/reports';
import type {
  Ingestion,
  ReportDetail,
} from '../../../shared/contracts/src/reports';
import type { PublicProfile } from '../../../shared/contracts/src/web';
import { createProfileView } from '../../../shared/profile-context/src/index';
import { reportRequest, ApiError, friendlyError } from './api';
import { HealthIntelligence } from './health-intelligence';
import { ReportComparison } from './report-comparison';
import { Icon, StatusBadge } from './design-system';

function message(error: unknown) {
  if (error instanceof ApiError)
    return (
      (
        {
          REPORT_REVISION_CHANGED:
            'This report changed. Open it again before saving.',
          IDENTITY_CONFIRMATION_REQUIRED:
            'Confirm who this report belongs to before verifying results.',
          MIXED_IDENTITY_REQUIRES_REUPLOAD:
            'Conflicting names were detected. Keep this report quarantined and upload the correct report.',
          REPORT_SIZE_LIMIT: 'Choose a file smaller than 20 MiB.',
          UNSUPPORTED_MEDIA_TYPE:
            'Choose a PDF, PNG, JPEG, TIFF or WebP report.',
        } as Record<string, string>
      )[error.code] ?? friendlyError(error)
    );
  return friendlyError(error);
}
export function ReportCenter({
  profile,
  guard,
  mode = 'all',
}: {
  profile: PublicProfile;
  guard: ReturnType<typeof createProfileView>;
  mode?: 'all' | 'reports' | 'insights';
}) {
  const [reports, setReports] = useState<Ingestion[]>([]),
    [detail, setDetail] = useState<ReportDetail | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1),
    [image, setImage] = useState<string | null>(null);
  const selection = useRef(0),
    imageVersion = useRef(0),
    uploadKey = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    const ticket = guard.request();
    try {
      const data = z.object({ reports: z.array(IngestionSchema) }).parse(
        await reportRequest('/v1/health/reports', ticket.context, {
          signal: ticket.signal,
        }),
      );
      guard.publish(ticket, () => {
        setReports(data.reports);
        setLoading(false);
      });
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        ([401, 403, 404].includes(cause.status) ||
          cause.code === 'PROFILE_CONTEXT_CHANGED')
      )
        guard.clear();
      guard.publish(ticket, () => {
        setError(message(cause));
        setLoading(false);
      });
    }
  }, [guard]);
  useEffect(() => {
    void refresh();
    const requested = new URL(window.location.href).searchParams.get('report');
    if (z.uuid().safeParse(requested).success) void open(requested!);
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(
      () => {
        void refresh();
      },
      reports.some((r) => ['queued', 'processing'].includes(r.state))
        ? 2500
        : 10000,
    );
    return () => clearInterval(timer);
  }, [reports, refresh]);
  async function open(id: string) {
    const generation = ++selection.current,
      ticket = guard.request();
    setDetail(null);
    setError('');
    setPage(1);
    try {
      const data = ReportDetailSchema.parse(
        await reportRequest(`/v1/health/reports/${id}`, ticket.context, {
          signal: ticket.signal,
        }),
      );
      guard.publish(ticket, () => {
        if (generation === selection.current) setDetail(data);
      });
    } catch (cause) {
      guard.publish(ticket, () => setError(message(cause)));
    }
  }
  useEffect(() => {
    setImage(null);
    if (!detail?.pages.length) return;
    const generation = ++imageVersion.current,
      ticket = guard.request();
    let objectUrl: string | null = null;
    void reportRequest(
      `/v1/health/reports/${detail.report.id}/pages/${page}`,
      ticket.context,
      { signal: ticket.signal, binary: true },
    )
      .then((blob) => {
        if (!(blob instanceof Blob)) return;
        guard.publish(ticket, () => {
          if (generation === imageVersion.current) {
            objectUrl = URL.createObjectURL(blob);
            setImage(objectUrl);
          }
        });
      })
      .catch((cause) => guard.publish(ticket, () => setError(message(cause))));
    return () => {
      imageVersion.current++;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [detail, page, guard]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      file = new FormData(form).get('report');
    if (!(file instanceof File) || !file.size) return;
    if (file.size > REPORT_MAX_BYTES) {
      setError('Choose a file smaller than 20 MiB.');
      return;
    }
    const ticket = guard.request();
    setBusy(true);
    setError('');
    uploadKey.current ??= crypto.randomUUID();
    try {
      const data = z.object({ report: IngestionSchema }).parse(
        await reportRequest('/v1/health/reports/upload', ticket.context, {
          file,
          requestKey: uploadKey.current,
          signal: ticket.signal,
        }),
      );
      guard.publish(ticket, () => {
        uploadKey.current = null;
        form.reset();
      });
      await refresh();
      await open(data.report.id);
    } catch (cause) {
      guard.publish(ticket, () => setError(message(cause)));
    } finally {
      guard.publish(ticket, () => setBusy(false));
    }
  }
  async function action(kind: string, fields: Record<string, unknown> = {}) {
    if (!detail) return;
    const ticket = guard.request();
    setBusy(true);
    setError('');
    const id = detail.report.id;
    try {
      await reportRequest(`/v1/health/reports/${id}/${kind}`, ticket.context, {
        body: {
          context: ticket.context,
          expectedRevision: detail.report.revision,
          ...fields,
        },
        signal: ticket.signal,
      });
      await refresh();
      await open(id);
    } catch (cause) {
      guard.publish(ticket, () => setError(message(cause)));
    } finally {
      guard.publish(ticket, () => setBusy(false));
    }
  }
  return (
    <>
      {mode === 'reports' && (
        <>
          <div className="report-summary">
            <div>
              <span className="section-icon tone-teal">
                <Icon name="reports" />
              </span>
              <span>
                In your library
                <strong>
                  {reports.filter((r) => r.state !== 'cancelled').length}{' '}
                  reports
                </strong>
              </span>
            </div>
            <div>
              <span className="section-icon tone-green">
                <Icon name="check" />
              </span>
              <span>
                Source checked
                <strong>
                  {reports.filter((r) => r.state === 'verified').length}{' '}
                  verified
                </strong>
              </span>
            </div>
            <div>
              <span className="section-icon tone-amber">
                <Icon name="search" />
              </span>
              <span>
                A closer look
                <strong>
                  {
                    reports.filter((r) =>
                      ['review_needed', 'quarantined'].includes(r.state),
                    ).length
                  }{' '}
                  need review
                </strong>
              </span>
            </div>
          </div>
          <nav className="report-journey" aria-label="Report workflow">
            <a href="#upload">
              <b>01</b>
              <span>
                Add your original<small>Upload a PDF or image</small>
              </span>
            </a>
            <a href="#report-library">
              <b>02</b>
              <span>
                Review the details
                <small>Check identity and extracted values</small>
              </span>
            </a>
            <a href="#compare">
              <b>03</b>
              <span>
                Connect the evidence<small>Compare verified results</small>
              </span>
            </a>
          </nav>
        </>
      )}
      {mode !== 'reports' && (
        <HealthIntelligence
          key={
            'intelligence:' +
            reports.map((r) => `${r.id}:${r.revision}`).join(',')
          }
          guard={guard}
          onSource={(id) => void open(id)}
          revision={reports.map((r) => `${r.id}:${r.revision}`).join(',')}
        />
      )}
      {mode !== 'insights' && (
        <section className="card upload-card" id="upload">
          <span className="section-icon tone-blue">
            <Icon name="upload" size={26} />
          </span>
          <h2>Add a report</h2>
          <p className="muted">
            PDF or image · up to 20 MiB and 50 pages. Use synthetic reports in
            this local pilot.
          </p>
          <form onSubmit={upload} className="contact-form">
            <label>
              Report file
              <input
                type="file"
                name="report"
                required
                accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp"
                disabled={busy}
                onChange={() => {
                  uploadKey.current = null;
                }}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? 'Please wait…' : 'Upload report'}
            </button>
          </form>
        </section>
      )}
      <ReportComparison
        key={
          'comparison:' + reports.map((r) => `${r.id}:${r.revision}`).join(',')
        }
        guard={guard}
        reports={reports}
        onSource={(id) => void open(id)}
      />
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {mode === 'insights' ? null : loading ? (
        <p role="status">Loading reports…</p>
      ) : !reports.length ? (
        <section className="card empty">
          <span className="empty-symbol">▤</span>
          <h2>Your reports will live here.</h2>
          <p>Add a report to begin. Every result stays linked to its source.</p>
        </section>
      ) : (
        <section className="card report-library" id="report-library">
          <div className="section-title">
            <h2>Reports</h2>
            <span className="badge">{reports.length} source documents</span>
          </div>
          <ul>
            {reports.map((report) => (
              <li key={report.id}>
                <button
                  className="report-row"
                  onClick={() => void open(report.id)}
                >
                  <span className="report-file-icon">
                    <Icon name="reports" size={22} />
                  </span>
                  <span className="report-file-name">
                    <strong>{report.fileName}</strong>
                    <small>
                      {report.scanState === 'unavailable'
                        ? 'Scanner unavailable'
                        : report.stage.replaceAll('_', ' ')}
                    </small>
                  </span>
                  <StatusBadge
                    tone={
                      report.state === 'verified'
                        ? 'success'
                        : ['quarantined', 'failed'].includes(report.state)
                          ? 'error'
                          : report.state === 'review_needed'
                            ? 'warning'
                            : 'neutral'
                    }
                  >
                    {report.state.replaceAll('_', ' ')}
                  </StatusBadge>
                  <Icon name="chevron" size={17} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {detail && (
        <section className="card report-review">
          <div className="section-title">
            <h2>{detail.report.fileName}</h2>
            <button
              className="quiet"
              onClick={() => {
                selection.current++;
                setDetail(null);
              }}
            >
              Close ×
            </button>
          </div>
          <p className="notice" role="status">
            {detail.report.state.replaceAll('_', ' ')}
            {detail.report.errorCode
              ? ` · ${detail.report.errorCode.replaceAll('_', ' ').toLowerCase()}`
              : ''}
          </p>
          {detail.report.state === 'queued' ||
          detail.report.state === 'processing' ? (
            <p>
              Processing your report. Refresh its details after processing
              finishes.
            </p>
          ) : null}
          <div className="report-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void open(detail.report.id)}
            >
              Refresh report
            </button>
            {detail.report.state === 'failed' &&
              detail.report.scanState !== 'infected' && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void action('retry')}
                >
                  Retry processing
                </button>
              )}
            {detail.report.state !== 'cancelled' && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void action('cancel')}
              >
                {detail.report.state === 'verified'
                  ? 'Withdraw report'
                  : 'Cancel report'}
              </button>
            )}
          </div>
          {detail.identity && (
            <div className="identity-review">
              <h3>Report identity</h3>
              <p>
                {detail.identity.state} · {detail.identity.reason}
              </p>
              {detail.identity.state !== 'matched' &&
                detail.report.scanState === 'clean' && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void action('identity', {
                        confirmedSubject: true,
                        state: 'matched',
                        reason: String(data.get('reason')),
                      });
                    }}
                  >
                    <label>
                      <input
                        type="checkbox"
                        required
                        disabled={busy || detail.report.state === 'quarantined'}
                      />{' '}
                      I checked the source and confirm this report belongs to{' '}
                      {profile.displayName}.
                    </label>
                    <label>
                      Review reason
                      <input
                        name="reason"
                        minLength={5}
                        maxLength={1000}
                        required
                        disabled={busy || detail.report.state === 'quarantined'}
                      />
                    </label>
                    <button
                      className="primary"
                      disabled={busy || detail.report.state === 'quarantined'}
                    >
                      Confirm report identity
                    </button>
                  </form>
                )}
            </div>
          )}
          {!!detail.pages.length && (
            <div className="verification-layout">
              <div className="source-preview">
                <label>
                  Source page
                  <select
                    value={page}
                    onChange={(event) => setPage(Number(event.target.value))}
                  >
                    {detail.pages.map((p) => (
                      <option key={p.number} value={p.number}>
                        Page {p.number}
                      </option>
                    ))}
                  </select>
                </label>
                {image ? (
                  <div
                    style={{
                      position: 'relative',
                      lineHeight: 0,
                      marginTop: 15,
                    }}
                  >
                    <img
                      src={image}
                      style={{ marginTop: 0, border: 0 }}
                      alt={`Original report source page ${page} for ${profile.displayName}`}
                    />
                    {detail.candidates
                      .filter((c) => c.pageNumber === page)
                      .map((c) => (
                        <span
                          key={c.id}
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            pointerEvents: 'none',
                            border: '2px solid var(--bf-teal)',
                            left: `${Number(c.x0) * 100}%`,
                            top: `${Number(c.y0) * 100}%`,
                            width: `${(Number(c.x1) - Number(c.x0)) * 100}%`,
                            height: `${(Number(c.y1) - Number(c.y0)) * 100}%`,
                          }}
                        />
                      ))}
                  </div>
                ) : (
                  <p role="status">Loading source page…</p>
                )}
              </div>
              <div className="candidate-list">
                <h3>Check extracted results</h3>
                <p className="muted">
                  Extraction is not verification. Check each value against the
                  source before saving.
                </p>
                {!detail.candidates.length && (
                  <p>
                    No supported result rows were recognized. This report needs
                    further extraction review.
                  </p>
                )}
                <details>
                  <summary>
                    Add a result from an unrecognized source region
                  </summary>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const fields = new FormData(event.currentTarget);
                      void action('candidates', {
                        requestKey: crypto.randomUUID(),
                        rawFieldId: fields.get('source'),
                        reason: fields.get('reason'),
                      });
                    }}
                  >
                    <label>
                      Source text
                      <select
                        name="source"
                        required
                        disabled={busy || detail.identity?.state !== 'matched'}
                      >
                        {detail.rawFields.map((f) => (
                          <option key={f.id} value={f.id}>
                            Page {f.pageNumber}: {f.text.slice(0, 180)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Reason
                      <input
                        name="reason"
                        required
                        minLength={5}
                        maxLength={1000}
                        disabled={busy}
                      />
                    </label>
                    <button
                      disabled={busy || detail.identity?.state !== 'matched'}
                    >
                      Add for verification
                    </button>
                  </form>
                </details>
                {detail.candidates.map((candidate) => (
                  <CandidateReview
                    rawFields={detail.rawFields}
                    key={`${candidate.id}:${detail.report.revision}`}
                    candidate={candidate}
                    current={detail.observations.find(
                      (o) => o.id === candidate.observationId,
                    )}
                    canVerify={
                      detail.identity?.state === 'matched' &&
                      !busy &&
                      detail.report.state !== 'cancelled'
                    }
                    onPage={() => setPage(candidate.pageNumber)}
                    onSave={(fields) => void action('verify', fields)}
                  />
                ))}
              </div>
            </div>
          )}
          {!!detail.observations.length && (
            <div className="history">
              <h3>Verification history</h3>
              <ul>
                {detail.observations.map((o) => (
                  <li key={o.id}>
                    {o.name} {o.value} {o.unit} · revision {o.revision} ·{' '}
                    {o.verificationState}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {detail.report.state === 'verified' && (
            <form
              className="profile-form"
              onSubmit={(event) => {
                event.preventDefault();
                const fields = new FormData(event.currentTarget),
                  other = reports.find((r) => r.id === fields.get('related'));
                if (other)
                  void action('relationships', {
                    requestKey: crypto.randomUUID(),
                    relatedReportId: other.id,
                    relatedRevision: other.revision,
                    kind: fields.get('kind'),
                    reason: fields.get('reason'),
                  });
              }}
            >
              <h3>Declare a report relationship</h3>
              <label>
                Related verified report
                <select name="related" required disabled={busy}>
                  <option value="">Choose report</option>
                  {reports
                    .filter(
                      (r) =>
                        r.id !== detail.report.id && r.state === 'verified',
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.fileName}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Relationship
                <select name="kind" disabled={busy}>
                  <option value="rerun">Rerun</option>
                  <option value="amendment">Amendment</option>
                </select>
              </label>
              <label>
                Reason
                <input
                  name="reason"
                  required
                  minLength={5}
                  maxLength={1000}
                  disabled={busy}
                />
              </label>
              <button disabled={busy}>Record relationship</button>
              <p>
                Both sources stay distinct. This does not average or withdraw
                either result.
              </p>
            </form>
          )}
          {detail.relationships.length > 0 && (
            <ul>
              {detail.relationships.map((r) => (
                <li key={r.id}>
                  {r.kind}: {r.reason}{' '}
                  <button onClick={() => void open(r.relatedReportId)}>
                    Related source report
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
function CandidateReview({
  rawFields,
  candidate,
  current,
  canVerify,
  onPage,
  onSave,
}: {
  rawFields: ReportDetail['rawFields'];
  candidate: ReportDetail['candidates'][number];
  current: ReportDetail['observations'][number] | undefined;
  canVerify: boolean;
  onPage: () => void;
  onSave: (fields: Record<string, unknown>) => void;
}) {
  const original = candidate.parsed.value;
  const [kind, setKind] = useState(current?.valueKind ?? original.kind);
  const match = current?.value.match(
    /^(<=|>=|<|>|=)(-?(?:0|[1-9]\d*)(?:\.\d+)?)$/,
  );
  const value =
    (current?.valueKind ?? original.kind) === 'quantity' && match
      ? { kind: 'quantity' as const, comparator: match[1], amount: match[2] }
      : current?.valueKind === 'qualitative'
        ? { kind: 'qualitative' as const, text: current.value }
        : current?.valueKind === 'missing'
          ? { kind: 'missing' as const, reason: current.value }
          : original;
  return (
    <form
      className="candidate-review"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSave({
          candidateId: candidate.id,
          originalName: String(data.get('name')),
          unit: String(data.get('unit') ?? '').trim() || null,
          referenceText: String(data.get('referenceText') ?? '').trim() || null,
          referenceFieldId: String(
            data.get('referenceSource') ?? candidate.rawFieldId,
          ),
          value:
            kind === 'quantity'
              ? {
                  kind: 'quantity',
                  amount: String(data.get('amount')),
                  comparator: String(data.get('comparator')),
                }
              : kind === 'qualitative'
                ? { kind: 'qualitative', text: String(data.get('text')) }
                : { kind: 'missing', reason: String(data.get('text')) },
          reason: String(data.get('reason')),
          previousObservationId: candidate.observationId,
          metadata:
            data.get('metadata') === 'on'
              ? {
                  conceptSystem:
                    String(data.get('conceptSystem') ?? '').trim() || null,
                  conceptCode:
                    String(data.get('conceptCode') ?? '').trim() || null,
                  specimen: String(data.get('specimen') ?? '').trim() || null,
                  method: String(data.get('method') ?? '').trim() || null,
                  observedDate:
                    String(data.get('observedDate') ?? '').trim() || null,
                  sourceFieldId: candidate.rawFieldId,
                }
              : null,
        });
      }}
    >
      <button type="button" className="text-button" onClick={onPage}>
        View source · page {candidate.pageNumber}
      </button>
      <p className="raw-source">{candidate.rawText}</p>
      <label>
        Test name
        <input
          name="name"
          defaultValue={current?.name ?? candidate.parsed.originalName}
          required
          maxLength={300}
          disabled={!canVerify}
        />
      </label>
      <label>
        Result type
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as typeof kind)}
          disabled={!canVerify}
        >
          <option value="quantity">Numeric result</option>
          <option value="qualitative">Qualitative result</option>
          <option value="missing">Missing result</option>
        </select>
      </label>
      {kind === 'quantity' ? (
        <div className="profile-form">
          <label>
            Comparator
            <select
              name="comparator"
              defaultValue={value.kind === 'quantity' ? value.comparator : '='}
              disabled={!canVerify}
            >
              {['=', '<', '<=', '>', '>='].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Value
            <input
              name="amount"
              defaultValue={value.kind === 'quantity' ? value.amount : ''}
              pattern="-?(0|[1-9][0-9]*)(\.[0-9]+)?"
              required
              disabled={!canVerify}
            />
          </label>
        </div>
      ) : (
        <label>
          {kind === 'qualitative' ? 'Result text' : 'Missing result reason'}
          <input
            name="text"
            defaultValue={
              value.kind === 'qualitative'
                ? value.text
                : value.kind === 'missing'
                  ? value.reason
                  : ''
            }
            required
            maxLength={1000}
            disabled={!canVerify}
          />
        </label>
      )}
      <label>
        Unit
        <input
          name="unit"
          defaultValue={current?.unit ?? candidate.parsed.unit ?? ''}
          maxLength={100}
          disabled={!canVerify}
        />
      </label>
      <label>
        Verification or correction reason
        <input
          name="reason"
          required
          minLength={5}
          maxLength={1000}
          disabled={!canVerify}
        />
      </label>
      <label>
        Source reference interval or text (optional)
        <input
          name="referenceText"
          defaultValue={
            current
              ? (current.referenceText ?? '')
              : (candidate.parsed.referenceText ?? '')
          }
          maxLength={1000}
          disabled={!canVerify}
        />
      </label>
      <label>
        Reference interval source region
        <select
          name="referenceSource"
          defaultValue={current?.referenceFieldId ?? candidate.rawFieldId}
          disabled={!canVerify}
        >
          {rawFields.map((field) => (
            <option key={field.id} value={field.id}>
              Page {field.pageNumber}: {field.text.slice(0, 180)}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>Verified comparison context (optional)</summary>
        <p>
          Use the source to check these fields. Leave unknown context empty; it
          will be excluded from comparisons. No mapping or conversion is
          inferred.
        </p>
        <label>
          <input
            type="checkbox"
            name="metadata"
            defaultChecked={!!current?.metadata}
            disabled={!canVerify}
          />
          I checked the entered context against this source region
        </label>
        {(
          [
            'conceptSystem',
            'conceptCode',
            'specimen',
            'method',
            'observedDate',
          ] as const
        ).map((key) => (
          <label key={key}>
            {
              {
                conceptSystem: 'Concept coding system',
                conceptCode: 'Verified concept code',
                specimen: 'Specimen',
                method: 'Laboratory method',
                observedDate: 'Observation date',
              }[key]
            }
            <input
              name={key}
              type={key === 'observedDate' ? 'date' : 'text'}
              maxLength={
                key === 'conceptSystem' || key === 'conceptCode' ? 100 : 200
              }
              defaultValue={current?.metadata?.[key] ?? ''}
              disabled={!canVerify}
            />
          </label>
        ))}
      </details>
      <button className="primary" disabled={!canVerify}>
        {candidate.observationId ? 'Save corrected revision' : 'Verify result'}
      </button>
    </form>
  );
}
