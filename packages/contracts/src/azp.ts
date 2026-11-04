import { z } from 'zod';

import { Id, IsoDateTime } from './common.js';
import { Sha256Hex } from './interview.js';

/**
 * Manifest of an .azp package: interviews exported to a file when a device
 * never reaches the internet (spec 006). The package holds `interviews.jsonl`
 * (one Interview per line, same contract) and `media/`. Encryption of the
 * package is defined in F1, in its own ADR.
 */

// Relative path inside the package: no "..", no leading "/", no backslashes.
const PackagePath = z
  .string()
  .max(200)
  .regex(/^(?!\/)(?!.*\.\.)[A-Za-z0-9._/-]+$/);

export const AzpManifest = z.strictObject({
  format: z.literal('azp'),
  formatVersion: z.literal(1),
  organizationId: Id,
  deviceId: Id,
  createdAt: IsoDateTime,
  counts: z.strictObject({
    interviews: z.int().min(0),
    media: z.int().min(0),
  }),
  files: z
    .array(
      z.strictObject({
        path: PackagePath,
        sizeBytes: z.int().min(0),
        sha256: Sha256Hex,
      }),
    )
    .min(1),
});
export type AzpManifest = z.infer<typeof AzpManifest>;
