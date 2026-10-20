# My Server

A personal file server with a web interface. Upload software and files, then browse, download, rename and delete them from any device.

## Run it
1. Install Node.js 18+ from https://nodejs.org
2. In this folder run:
   ```
   npm install
   PASSWORD=choose-a-strong-password npm start      (Mac/Linux)
   set PASSWORD=Aryankhan@1122 && npm start   (Windows cmd)
   ```
3. Open http://localhost:3000. Files are saved in the `storage` folder (change with `STORAGE_DIR`).

## Access it from anywhere
Pick one:
- **VPS (best, always on):** copy this folder to a cheap Linux VPS, run with `pm2 start server.js`, and put Caddy or Nginx in front for free HTTPS.
- **Cloudflare Tunnel (free, no port opening):** `cloudflared tunnel --url http://localhost:3000` gives you a public https link to your home PC.
- **Tailscale (private):** install on the server and your devices, then open `http://server-name:3000` from anywhere. Nothing is exposed publicly.

## Security
- Always use a long password, and use HTTPS when exposed to the internet (the password is sent on login).
- Paths are locked inside the storage folder, and login attempts are rate-limited.
