---
name: i18n-messages
description: Authoring Paraglide message keys in `messages/en.json` with copy whose length and register match the existing sibling strings. Load when adding or editing a UI string, naming a message key, or generating label/title/error/body/description text. English is the source of truth; recompile Paraglide after adding keys.
---

# Paraglide Messages — length-matched authoring

All UI copy goes through Paraglide (see the i18n section of CLAUDE.md — never hardcode English
in a component or route). This skill is the **how** for writing a _good_ message: one whose
length and tone match the strings already in the file, so the UI stays visually consistent.

Messages live in `messages/en.json`. **English is the source of truth.** `messages/fr.json`
is allowed to lag — add new keys to `en.json` only; do not invent French copy unless asked.

## Key naming

Keys are snake*case, namespaced front-to-back: `<domain>*<context>\_<element>`.

```
register_email_label          onboarding_profile_title
login_submit                  select_license_description
accept_invite_invalid         product_new_title
```

Reuse the existing domain prefix (`register_`, `login_`, `onboarding_`, `select_license_`,
`select_product_`, `product_`, `connection_`, …) — grep the file for the prefix before
inventing a new one. The **suffix** (the last segment) declares the string's _family_, and the
family sets the length register.

## The length rule

Before writing the value, find the **sibling family** — other keys sharing the same suffix
(and ideally the same domain prefix) — and match their length and tone. Measured registers
from the current `en.json`:

| suffix         | register                         | median chars | example                                                        |
| -------------- | -------------------------------- | ------------ | -------------------------------------------------------------- |
| `_label`       | 1–2 words, no punctuation        | ~9           | `"Email address"`                                              |
| `_title`       | short heading, no full stop      | ~14          | `"Create your account"`                                        |
| `_submit`      | imperative verb phrase           | ~14          | `"Create account"`                                             |
| `_submitting`  | present-continuous of the submit | ~13          | `"Creating account..."`                                        |
| `_placeholder` | short hint                       | ~25          | `"Search licenses..."`                                         |
| `_description` | one plain sentence               | ~40          | `"Select the license you want to work under in this session."` |
| `_error`       | one apologetic sentence          | ~46          | `"Could not save your profile. Please try again."`             |
| `_body`        | 1–2 sentences                    | ~76          | `"We've sent a verification link to your email..."`            |

Rule of thumb: **stay within roughly ±50% of the sibling family's median length.** A `_label`
that runs to a full sentence, or an `_error` that's two words, is wrong even if the English is
fine — it breaks the visual rhythm and the layout the component was built around.

When adding a _paired_ key (e.g. a new `_submit` + `_submitting`, or `_title` + `_description`),
derive the pair from its partner so they read as a set — see `register_submit` /
`register_submitting` and `select_license_title` / `select_license_description`.

## Parameters

Interpolate with `{name}` (Paraglide message-format syntax), matching the surrounding keys:

```json
"accept_invite_body": "You've been invited to join {licenseName}.",
"select_license_last_accessed": "Last accessed {time}"
```

## Workflow

1. `grep` `messages/en.json` for the domain prefix and the suffix family to see siblings.
2. Match the naming pattern and the length register of those siblings.
3. Add the key to `messages/en.json` (keep it near its domain neighbours). English only.
4. Recompile before type-checking:
   `npx paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide`
5. Reference it in the component/route as `m.<key>()` — never a raw string.
