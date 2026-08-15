---
name: models-validation
description: How to author Valibot model schemas + inferred types in `src/lib/models/*.model.ts` — the single source of truth for shape and validation. Load when creating or editing a `*.model.ts` file, declaring a reusable enum/picklist, inferring a type via `v.InferOutput`, or working around the `v.pipe(v.object, v.check)` non-object-schema caveat.
---

# Models — Valibot Schemas + Inferred Types

Each domain has a single file in `src/lib/models/` that owns both the Valibot validation schema and the TypeScript type inferred from it. This is the single source of truth for shape and validation.

```ts
// src/lib/models/profile.model.ts
import * as v from 'valibot';

// Enums declared once and reused (DB column, model schema, UI <Select>).
export const jobRoleValues = [
    'Product',
    'Design',
    'Sales',
    'Engineering',
    'Management'
] as const;
export const accessValues = ['owner', 'editor', 'reader'] as const;

export const profileSchema = v.object({
    id: v.string(),
    userId: v.string(),
    licenseId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    jobTitle: v.nullable(v.string()),
    jobRole: v.nullable(v.picklist(jobRoleValues)),
    access: v.picklist(accessValues),
    handle: v.nullable(v.string()),
    avatar: v.nullable(v.string()),
    locale: v.nullable(v.string()),
    updatedAt: v.number()
});

// Self-editable fields only — never `access` or `licenseId`.
export const updateProfileSchema = v.object({
    firstName: v.pipe(v.string(), v.minLength(1)),
    lastName: v.pipe(v.string(), v.minLength(1)),
    jobTitle: v.nullable(v.string()),
    jobRole: v.nullable(v.picklist(jobRoleValues)),
    handle: v.nullable(v.string()),
    avatar: v.nullable(v.string())
});

export type JobRole = (typeof jobRoleValues)[number];
export type Access = (typeof accessValues)[number];
export type Profile = v.InferOutput<typeof profileSchema>;
export type UpdateProfileInput = v.InferOutput<typeof updateProfileSchema>;
```

### Rules

- Every `*.model.ts` file must export a Valibot schema and a type inferred from it via `v.InferOutput`
- `models/` files must never import from `$lib/server/` — they are client-safe and may be imported anywhere
- All command and form arguments must use a schema from `models/` — never define inline schemas in remote functions
- The **model owns the client-facing type** (e.g. `Profile`). Stores and components import
  `Profile` from `$lib/models/profile.model` — **never** from `$lib/server/db/schema`
  (that Drizzle type is server-only). Remote functions map the Drizzle row → model type
  before returning it to the client.
- Declare reusable enums once as `… as const` + `v.picklist(...)` and share them across the
  DB column, the model schema, and any UI `<Select>`.
- The Drizzle schema (`server/db/schema.ts`) and the model schema serve different concerns — Drizzle owns persistence, Valibot owns validation. Keep them aligned when fields change.
- Cross-domain primitives shared by multiple models live in `shared.model.ts` (e.g. `editHistoryEntrySchema`) — import them rather than redeclaring per domain.
- A schema wrapped in `v.pipe(v.object(...), v.check(...))` is **not** a plain object schema — `v.omit`/`v.partial` don't work on it. Declare any derived (e.g. command/save) schema standalone and repeat the checks inline.
