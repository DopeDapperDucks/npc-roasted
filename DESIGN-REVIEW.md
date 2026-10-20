# NPC Roasted design review — local first pass

Reviewed using the NPC design-reviewer guide; self-review of source, not an independent or screenshot review. Brand, Art, Design, Taste, Voice & Copy and Asset Index consulted. The Design Bible wins over the guide's generic two-font limit: the official system uses three font families.

Keep: charcoal #1a1a1a and white; official logo, unchanged character art and licensed local fonts; Sigmar headlines ending with a full stop; Inter body and mono labels; one primary white button; 54px fields and 44px controls; 16px phone padding; reduced-motion support.

Fixed during review: white logo on white export header (header now dark); decorative coral removed; NPC/PC share labels corrected; settings locked during generation; existing result retained during reroll; loading and export status announced; errors remain visible in the form.

Validation: git diff --check passed. Compared API route with imported source: unchanged. Verified all referenced local assets exist.

Blocked: Node/npm unavailable, so no Next.js build, TypeScript check, real roast request, or PNG export test. Chrome headless aborted (exit 134), so 375px and 1280px screenshots and visual review remain pending. Static HTML preview is illustrative and does not run the Next.js flow. No claim of runtime completion.

Next: render desktop and phone previews, test generated report, reroll and PNG export when Node and browser automation are available. No code pushed or deployed; no release approval recorded.
