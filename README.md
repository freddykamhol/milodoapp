# milodo-app

Next.js (App Router) + TypeScript + Tailwind CSS + ESLint.

## Dev

```bash
npm install
npm run dev
```

## Production (Node 20.x)

Wichtig: Dieses Projekt nutzt `better-sqlite3` (native Addon). Daher **auf dem Server** mit der Server-Node-Version installieren (nicht `node_modules` vom lokalen Rechner kopieren).

```bash
# auf dem Server
git clone https://github.com/freddykamhol/milodoapp.git
cd milodoapp

# Node 20.x aktivieren (nvm/volta/whatever) und dann:
npm ci

# Env setzen (Beispiel)
cp .env.example .env
# setze DATABASE_URL auf einen absoluten Pfad, z.B.:
# DATABASE_URL="file:/var/www/milodoapp/data/prod.db"
# optional: setze DATA_DIR für lokale Uploads/Blog-Assets, z.B.:
# DATA_DIR="/var/www/milodoapp/data"

npm run db:migrate
npm run build
npm run start   # oder: npm run start:server
```

Hinweis: Auf dem Server werden standardmäßig `devDependencies` übersprungen (siehe `.npmrc`), damit das Install in Hosting-Umgebungen ohne `exec`-Rechte in `node_modules/.bin` zuverlässig funktioniert. Lokal kannst du Dev-Dependencies mit `npm install --include=dev` installieren.

### Database bootstrap

```bash
# creates/updates schema and inserts demo seed data (demo user + demo appointments)
npm run db:bootstrap
```

If your local `dev.db` got out of sync with the migration files (e.g. because migrations were edited or the DB was updated via `push`),
`db:bootstrap` will move it aside to a timestamped `dev.db.bak-*` file and recreate it from the `./drizzle/*.sql` migrations.

## CSV Import (Members)

As `ADMIN` you can import internal users via `/members/import` (CSV upload). For each row the app generates a `username` + random password and emails the credentials. The password is **not** stored in plain text.

**Required CSV headers**
- `first_name`
- `last_name`
- `email`

**Optional CSV headers**
- `role` (`ADMIN` | `VERWALTUNG` | `PERSONAL`, default: `PERSONAL`)
- `qual_rd` (`SAN` | `RH` | `RS` | `RA` | `NFS`)
- `qual_ausb` (`AUSBILDER`)
- `einsatzort` (`AUSBILDUNG` | `RD` | `BEIDE`)
- `geb` (ISO date, e.g. `1990-12-31`)
- `telefon`
- `strasse`
- `hausnummer`
- `plz`
- `ort`
- `ort_ergaenzung`
- `locked` (`true/false`, default: `false`)
