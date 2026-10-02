# Publicar en Cloudflare Pages (privado)

1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → elegí `happytogethergroup/portfolio`.
2. Rama de producción: `claude/baby-nutrition-app-ntl7h8` (o la que uses al mergear).
3. Configuración de build: **Framework: None**, **Build command: vacío**, **Build output directory: `bebe-nutricion`**.
4. Deploy → te da `https://<nombre>.pages.dev`. Abrilo en el celular → "Agregar a pantalla de inicio".
5. Privacidad: **Zero Trust → Access → Applications → Add → Self-hosted**, dominio `<nombre>.pages.dev`, política **Allow → Emails** (tu email y el de la mamá). Pide un código por mail antes de abrir.
   (Para proteger también las previews: `*.<nombre>.pages.dev`.)

`_headers` agrega cabeceras de seguridad y evita cachear `sw.js`; `robots.txt` pide que no lo indexen.
