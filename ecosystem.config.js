// PM2 process config for InvoxAI — run from the repo root on the VPS.
//
// Why: the production apps run as `next start` (frozen builds). Started as loose
// `nohup` processes they linger as STALE builds after a deploy — which is what
// caused the "Something went wrong on every page" outages. PM2 makes restarts
// reliable and `pm2 reload` is zero-downtime.
//
// One-time setup:
//   npm install -g pm2
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup       # survive VPS reboots
//
// After that, deploy with ./deploy.sh (build + migrate + pm2 reload).
//
// Each app's own `start` script already pins its port (`next start -p <port>`):
//   web 3000 · app(seller) 3001 · admin 3002 · tenant 3003
const APPS = [
  ["invox-web", "@invoxai/web"],
  ["invox-app", "@invoxai/app"],
  ["invox-admin", "@invoxai/admin"],
  ["invox-tenant", "@invoxai/tenant"],
];

module.exports = {
  apps: APPS.map(([name, pkg]) => ({
    name,
    cwd: __dirname,
    // Run via a login shell so nvm/corepack PATH (pnpm) resolves under pm2.
    script: "bash",
    args: ["-lc", `pnpm --filter ${pkg} start`],
    autorestart: true,
    max_restarts: 10,
    env: { NODE_ENV: "production" },
  })),
};
