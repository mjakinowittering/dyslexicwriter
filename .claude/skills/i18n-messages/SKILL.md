---
name: i18n-messages
description: Authoring Paraglide message keys in `messages/en.json` with copy whose length and register match the existing sibling strings. Load when adding or editing a UI string, naming a message key, or generating label/title/hint/error/description text. English is the only locale; recompile Paraglide after adding keys.
---

# Paraglide messages — length-matched authoring

All UI copy goes through Paraglide (see CLAUDE.md — never hardcode English in a
component or route, error text included). The value here is **not** translation:
the app ships English only, `locales: ["en"]`, no locale switcher and no second
file. It is keeping copy out of the markup, in one place, editable without
touching components.

This skill is the **how** for writing a _good_ message: one whose length and tone
match the strings already in the file, so the UI stays visually consistent.

Read the copy voice from CLAUDE.md first: the user is a writer, not an operator.
"Couldn't save — check the folder is still available", never "EIO: write failed".

## Key naming

Keys are `snake_case`, namespaced front-to-back:
`<domain>_<context>_<element>`.

There are nine domains and **you should be reusing one of them**, not inventing a
tenth. Grep the file for the prefix before you add a key:

| prefix         | covers                                                 |
| -------------- | ------------------------------------------------------ |
| `content_`     | the editor surface: formatting, read-aloud, the sheet  |
| `files_`       | the Files screen: the tree, naming, delete, the folder |
| `welcome_`     | first run, reopen, the preview                         |
| `editor_`      | the editor's own errors and chrome                     |
| `settings_`    | the settings panel                                     |
| `header_`      | the app header                                         |
| `footer_`      | the app footer                                         |
| `unsupported_` | the no-File-System-Access screen                       |
| `confirm_`     | shared dialog buttons                                  |

The **suffix** — the last segment — declares the string's _family_, and the
family sets the length register.

## The length rule

Before writing the value, find the **sibling family**: other keys sharing the
same suffix, ideally the same domain prefix too. Match their length and tone.
Measured off the current `en.json`:

| suffix         | n   | register                                | median chars | example                                                                 |
| -------------- | --- | --------------------------------------- | ------------ | ----------------------------------------------------------------------- |
| `_hint`        | 19  | tooltip: a noun phrase or short verb    | ~11          | `"Bullet list"`                                                         |
| `_error`       | 18  | one plain sentence, no apology, no code | ~39          | `"A folder called \"{name}\" already exists"`                           |
| `_title`       | 16  | short heading, no full stop             | ~16          | `"Nothing here yet"`                                                    |
| `_description` | 13  | one or two sentences, ends with a stop  | ~67          | `"This removes the empty folder from your disk, and cannot be undone."` |
| `_label`       | 5   | 1–2 words, an accessible name           | ~13          | `"Document text"`                                                       |
| `_menu`        | 3   | names the row it acts on                | ~20          | `"Actions for \"{name}\""`                                              |
| `_placeholder` | 2   | short hint, may be a question           | ~33          | `"What are we going to write today?"`                                   |

`_hint` is the biggest family by some distance — it is every toolbar tooltip — and
the shortest. A tooltip that runs to a sentence is wrong even if the English is
fine.

Rule of thumb: **stay within roughly ±50% of the sibling family's median.** A
`_label` that is a full sentence, or a `_description` that is two words, breaks
the layout the component was built around.

Where a key has an obvious partner — `files_folder_empty` /
`files_folder_no_writing`, `settings_read_error` / `settings_save_error` — derive
the pair from each other so they read as a set.

## Parameters

Interpolate with `{name}` (Paraglide message-format syntax), matching the
surrounding keys:

```json
"files_delete_title": "Delete \"{title}\"?",
"files_modified": "Edited {when}",
"content_format_heading": "Heading {level}"
```

A parameter carries a value the app already has. It is **not** a way to smuggle
English out of a component and into a message: building `"3 minutes"` in a util
and interpolating it defeats the point of the message file. Pass the parts and
let the key own the words.

## Workflow

1. `grep` `messages/en.json` for the domain prefix and the suffix family to see
   the siblings you are matching.
2. Match the naming pattern and the length register.
3. Add the key near its domain neighbours. English only — there is no other
   locale file to update.
4. Recompile before type-checking:
   `npx paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide`
5. Reference it as `m.<key>()` — never a raw string.
6. **A key nothing references is deleted**, in the same commit as whatever
   stopped using it.
