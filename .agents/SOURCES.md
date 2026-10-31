# Источники сохранённых скиллов

Скиллы сохранены локально для повторного использования в этом репозитории. Инструкции по выбору находятся в корневом `AGENTS.md`. Сетевые сервисы, аутентификация и инструменты браузера не устанавливаются и не подключаются автоматически.

| Набор | Источник | Зафиксированная версия | Лицензия |
| --- | --- | --- | --- |
| UI/UX Pro Max | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | v2.15.0, `a38d04c3d5c298c851dbe5e6ee1965ee3de42cb5` | MIT: `licenses/ui-ux-pro-max-MIT.txt` |
| Vercel Agent Skills | https://github.com/vercel-labs/agent-skills | `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` | В README исходного набора указана MIT; отдельного файла LICENSE в указанном коммите нет. Некоторые `SKILL.md` также содержат поле `license: MIT`. |
| Addy Osmani Agent Skills | https://github.com/addyosmani/agent-skills | `8bfcc1f9916f2eea55494d8c1fa7f4bde867dd9e` | MIT: `licenses/addyosmani-agent-skills-MIT.txt` |

Дополнительные снимки правил для работы без сети:

| Файл | Источник | Коммит | Лицензия |
| --- | --- | --- | --- |
| `references/vercel-web-interface-guidelines.md` | https://github.com/vercel-labs/web-interface-guidelines/blob/434b7f91364665f2f733b310ec54809bf8f37937/command.md | `434b7f91364665f2f733b310ec54809bf8f37937` | MIT: `licenses/vercel-web-interface-guidelines-MIT.txt` |
| `references/vercel-writing-guidelines.md` | https://github.com/vercel-labs/writing-guidelines/blob/83e2316b034cf572400513538e4e4da01c4cc742/command.md | `83e2316b034cf572400513538e4e4da01c4cc742` | MIT: `licenses/vercel-writing-guidelines-MIT.txt` |

Эти два снимка не заменяют проверку свежих правил при доступе к сети; при использовании офлайн нужно указывать возможное устаревание.

## Локальная упаковка

- Скиллы Vercel размещены в каталогах, соответствующих полю `name` в каждом `SKILL.md`. Сохранены все файлы каталогов скиллов, но не отдельные тестовые пакеты исходного репозитория, например `packages/vercel-optimize-tests`; инструкции в их `CONTRIBUTING.md` относятся к разработке в оригинальном репозитории.
- В `skills/vercel-optimize/scripts/scan-codebase.mjs` каталог `.agents` исключён из сканирования и обнаружения маршрутов, чтобы примеры скиллов не считались кодом сайта. При фильтрации директорий распознаются разделители путей Unix и Windows; эта адаптация не означает полной проверки сканера в Windows.
- Команды в `skills/ui-ux-pro-max/SKILL.md` адаптированы с пути плагина Claude на `.agents/skills/ui-ux-pro-max/`. Базы данных, справочники и исполняемые Python-скрипты сохранены; тесты разработки исходного набора не копировались.
- Общие чек-листы Addy Osmani находятся в `references/`, поэтому относительные пути `../../references/` продолжают работать. Его корневой `AGENTS.md`, предназначенный только для исходного репозитория, не переносился.
