# Icon assets

The retro desktop icon set still ships as base64 text so the repository remains binary-free. The build pipeline now decodes those payloads automatically:

```bash
npm run prepare:web
```

Running the command above creates PNG, ICO, and ICNS variants inside `dist/icons/`, which Electron Builder and Capacitor consume when generating installers. If you need to generate files manually (for example, to preview artwork), you can decode one of the base64 files yourself:

```bash
node -e "const fs=require('fs');const data=fs.readFileSync('icons/budget95-icon-512x512.base64.txt','utf8').trim();const base64=data.includes(',')?data.split(',').pop():data;fs.writeFileSync('icons/budget95-icon-512.png',Buffer.from(base64,'base64'));console.log('Saved icons/budget95-icon-512.png');"
```

From there you may use tooling such as ImageMagick or online converters to create alternative formats, but the automated `prepare:web` step already produces the assets required for packaging.
