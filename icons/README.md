# Icon assets

The retro desktop icon set ships as base64 text so the repository remains binary-free. Decode the file you need before packaging:

```bash
node -e "const fs=require('fs');const path='icons/budget95-icon-512x512.base64.txt';const data=fs.readFileSync(path,'utf8').trim();const buf=Buffer.from(data,'base64');fs.writeFileSync('icons/budget95-icon-512.png',buf);console.log('Wrote icons/budget95-icon-512.png');"
```

On Windows you can then turn the PNG into an `.ico` with free tools such as [IcoMoon](https://icomoon.io/app) or [convertico.com](https://convertico.com/). On macOS/Linux, `magick budget95-icon-512.png budget95-icon.ico` works if you have ImageMagick installed.

The Electron packaging step reads the base64 file directly, so decoding is only necessary if you need a standalone PNG/ICO.
