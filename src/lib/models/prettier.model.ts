import * as v from 'valibot';

// Markdown formatting, applied to the derived markdown on its way to disk. Bounds
// are shared by the model, the stored `config.json` shape and the formatter itself,
// so a stored width can never be one Prettier would refuse.
//
// The floor is 20 rather than 1 because of what a narrower measure does to the
// output, not because of taste: below roughly twenty columns Prettier can no longer
// fit a table delimiter row or an indented list marker and gives up on wrapping
// them, so the file stops being tidier than the unformatted one. The ceiling is a
// sanity bound on a hand-edited value.
export const PRINT_WIDTH_MIN = 20;
export const PRINT_WIDTH_MAX = 200;
export const PRINT_WIDTH_DEFAULT = 80;

// Prettier's own three values, kept whole rather than reduced to a boolean so the
// stored setting means exactly what the option means:
//   always   — wrap prose at `printWidth` (what this app ships)
//   never    — unwrap each paragraph on to a single line
//   preserve — leave existing line breaks alone; `printWidth` then affects only
//              tables, list markers and thematic breaks, never prose
export const proseWrapValues = ['always', 'never', 'preserve'] as const;

export const prettierPreferencesSchema = v.object({
    printWidth: v.pipe(
        v.number(),
        v.integer(),
        v.minValue(PRINT_WIDTH_MIN),
        v.maxValue(PRINT_WIDTH_MAX)
    ),
    proseWrap: v.picklist(proseWrapValues)
});

export type PrettierPreferences = v.InferOutput<
    typeof prettierPreferencesSchema
>;
