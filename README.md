# milodo-app

Next.js (App Router) + TypeScript + Tailwind CSS + ESLint.

## Dev

```bash
npm install
npm run dev
```

## Production (Node 20.20.2)

Wichtig: Dieses Projekt nutzt `better-sqlite3` (native Addon). Daher **auf dem Server** mit der Server-Node-Version installieren (nicht `node_modules` vom lokalen Rechner kopieren).

```bash
# auf dem Server
git clone https://github.com/freddykamhol/milodoapp.git
cd milodoapp

# Node 20.20.2 aktivieren (nvm/volta/whatever) und dann:
npm ci

# Env setzen (Beispiel)
cp .env.example .env
# setze DATABASE_URL auf einen absoluten Pfad, z.B.:
# DATABASE_URL="file:/var/www/milodoapp/data/prod.db"

npm run db:migrate
npm run build
npm run start   # oder: npm run start:server
```

### Database bootstrap

```bash
# creates/updates schema and inserts demo seed data (demo user + demo appointments)
npm run db:bootstrap
```
