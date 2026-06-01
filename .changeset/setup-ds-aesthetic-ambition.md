---
"@1agh/maude": minor
---

Aesthetic-ambition axis for `/design:setup-ds` — the bootstrap flow no longer collapses every new design system into a single-accent minimal default.

- New first-class `aesthetic_ambition` axis (`restrained → confident → expressive → maximalist`) threads the whole bootstrap pipeline. A design system can now consciously go colourful/expressive (Figma, Gumroad, Arc) or maximalist (Canva, Affinity, Memphis Config), not only quiet editorial.
- **Inferred, not a new picker.** `ux-research-agent` derives the ambition from brand character (Probe A lineage + Probe B Zrcadlo+Charakter + the vision-brief product description) as the *anchor* recommendation; the structural knobs (`accentStrategy`, shadow/decor, radii, type ratio) now derive from it instead of each independently falling back to `single`. It surfaces through the standard confidence gate — no extra forced question.
- **Absence of signal ≠ `restrained`.** When the brand character gives no clear aesthetic temperature, confidence is low (`<0.60`) and Stage 3 *asks* across the full scale (including a coordinated multi-colour palette via `palette_options[]`) rather than silently defaulting to minimal.
- New config field `aestheticAmbition` (`restrained | confident | expressive | maximalist`) sets the per-canvas default opt-out scope under the DS (`restrained`/`confident` → `palette`, `expressive` → `aesthetic`, `maximalist` → `full`), so `/design:new` + `/design:edit` no longer hardcode `palette`.
- Two new Q9 effect families — `chromatic-blocks` (colour-as-structure, Memphis/Canva) and `gradient-mesh` (aurora backdrops, Figma/Stripe-marketing) — and `signature-moment-critic` now judges a declared-maximalist DS on chromatic *coherence* rather than absolute surface/accent counts.

Backwards-compatible: a genuinely quiet brief still infers `restrained` and behaves exactly as before; existing design systems without the field are unaffected. Spec-only change to the design plugin (markdown + JSON Schema). See DDR-073.
