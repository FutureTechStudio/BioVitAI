import { createLocalReportProcessor } from '../dist/infrastructure/reports/local-processor.js';
import { Buffer } from 'node:buffer';
const processor = createLocalReportProcessor();
console.log(
  JSON.stringify({
    event: 'scanner.clean_probe',
    result: await processor.scan(
      Buffer.from('BiovitAI synthetic scanner availability probe'),
    ),
  }),
);
if (process.argv.includes('--eicar')) {
  const probe = [
    'X5O!P%@AP[4',
    '\\PZX54(P^)7CC)7}$',
    'EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
  ].join('');
  const result = await processor.scan(Buffer.from(probe));
  if (result !== 'infected')
    throw new Error('Scanner detection rehearsal failed');
  console.log(
    JSON.stringify({ event: 'scanner.harmless_test_signature', result }),
  );
}
