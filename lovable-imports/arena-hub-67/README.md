# Arena Hub (67)

Lovable project: `1947f30e-0dd4-41d6-a288-7f467c1fb49e`

Login/loading prototype. This snapshot is specifically archived because it contains an OLD loading direction that must not be silently enabled.

Extracted behavior:
- split login with dark portal artwork and purple accents;
- hand-built portal/logo SVG;
- login transition using a vertical purple light beam;
- loading screen with pulsing logo, `Sincronizando...`, progress bar, percentage and `Preparando seu próximo lobby competitivo`;
- an obsolete `Lembrar ECA digital` checkbox.

Migration rules:
- DO NOT use its custom logo. Use `/brand/grindlobby-official.png`.
- DO NOT activate this loading screen automatically. The user explicitly rejected unrequested loading changes.
- DO NOT reintroduce ECA/CPF UI from this historical prototype.
- Login layout may be used only as a visual reference after adapting it to current auth/backend.

Generic shadcn and template files are intentionally omitted.
