# claude-buddy-chat

Presence + Chat zwischen zwei Claude-Code-Nutzern, über [ntfy.sh](https://ntfy.sh) (kostenlos, kein Signup).

## Setup (ein Kommando)

```
npx github:XamHans/claude-buddy-chat <dein-name> <gemeinsamer-topic-slug>
```

Den `topic-slug` bekommst du von der Person, mit der du das einrichtest — beide müssen denselben benutzen. Ohne Argumente fragt das Skript interaktiv danach.

Das Kommando:
- legt `~/.claude/skills/buddy-chat/SKILL.md` an
- ergänzt `~/.claude/settings.json` um zwei Hooks (`SessionStart`/`SessionEnd`), die automatisch "online"/"offline" posten
- legt vor jeder Änderung ein `settings.json.bak` als Backup an
- lässt bestehende Einstellungen unangetastet (merged nur die Hooks rein, überschreibt nichts)

## Benutzung in Claude Code

Claude Code einmal neu starten, danach:

```
/buddy-chat Hey, bin online!
```

zeigt dir außerdem den letzten Chatverlauf und ob dein Buddy gerade online ist. Ohne Text (`/buddy-chat`) nur Status + Verlauf anzeigen.

## Live-Chat im Terminal (ohne Claude)

Für echtes Hin-und-her-Chatten ohne Claude dazwischen — ein normales Terminalfenster, tippen + Enter zum Senden, eingehende Nachrichten poppen sofort auf:

```
npx -p github:XamHans/claude-buddy-chat buddy-chat-live
```

Läuft, solange das Fenster offen ist. Strg+C zum Beenden. Name und Topic werden automatisch aus der lokalen `~/.claude/skills/buddy-chat/SKILL.md` gelesen (die der Setup-Befehl oben angelegt hat) — falls die nicht existiert, `buddy-chat-live <name> <topic-slug>` angeben.

## Hinweis

Der Topic-Slug ist ein geteiltes Geheimnis (zufällige Zeichenfolge) — kein echter Zugriffsschutz, nur Security-by-obscurity. Nichts Sensibles darüber schicken.
