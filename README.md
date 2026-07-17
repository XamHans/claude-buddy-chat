# claude-buddy-chat

Presence + Chat zwischen mehreren Freunden, über ein privates [Convex](https://convex.dev) Cloud-Projekt (kein öffentlicher Relay, kein Self-Hosting). Haupt-Interface ist eine Terminal-UI (Ink), unabhängig von Claude Code — dazu ein passiver Status-Line-Blick und ein optionaler `/buddy-chat`-Skill in Claude Code selbst.

## Für den Owner: einen Freund einladen

```
node scripts/buddy-invite.js <name> <raum>
```

Mintet einen frischen Token für `<name>` in Raum `<raum>` (gegen die echte Convex-Deployment, per `ADMIN_KEY` aus `.env.local` — dieser Key wird nie an Freunde weitergegeben). Das Skript druckt den Token, den du dann out-of-band (Chat/E-Mail) an den Freund weitergibst.

## Für den Freund: Setup (ein Kommando)

```
npx github:XamHans/claude-buddy-chat <dein-name> <token>
```

Den `<token>` bekommst du von der Person, die dich einlädt. Ohne Argumente fragt das Skript interaktiv danach. Der zugehörige Raum wird automatisch aus dem Token ermittelt.

Das Kommando:
- schreibt `~/.claude/buddy-chat/config.json` (Convex-URL, dein Name, dein Token/Raum)
- installiert `~/.claude/buddy-chat/presence.sh` + `statusline.sh` und verdrahtet die `SessionStart`/`SessionEnd`-Hooks in `~/.claude/settings.json`, damit dein Online-Status automatisch gesetzt wird
- installiert die Terminal-UI unter `~/.claude/buddy-chat/tui/` (inkl. `npm install` für Ink/React/Convex)
- installiert den `/buddy-chat`-Skill unter `~/.claude/skills/buddy-chat/SKILL.md`
- ergänzt einen `buddy`-Shell-Alias in `~/.zshrc`/`~/.bashrc`
- legt vor jeder Änderung an `settings.json` ein `.bak`-Backup an und lässt bestehende Einstellungen unangetastet (merged nur rein, überschreibt nichts)
- ist idempotent — mehrfaches Ausführen erzeugt keine doppelten Hooks/Alias-Zeilen

## Benutzung

Terminal neu laden (oder neues Fenster öffnen), dann:

```
buddy
```

öffnet die Chat-Oberfläche: Raumliste links (live Online/Offline-Status), Chat-Verlauf rechts, Eingabezeile unten. `:join <token>` fügt einen weiteren Raum hinzu, ohne neu zu starten.

In Claude Code (nach einem Neustart wegen des Presence-Hooks):

```
/buddy-chat Hey, bin online!
```

zeigt zusätzlich den letzten Chatverlauf und den Online-Status deiner Freunde. Ohne Text (`/buddy-chat`) nur Status + Verlauf anzeigen.

## Hinweis

Jeder Freund authentifiziert sich mit einem eigenen, vom Owner geminteten Token — kein geteiltes Geheimnis, echte Zugriffskontrolle pro Person.
