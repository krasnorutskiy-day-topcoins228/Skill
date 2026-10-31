# Инструкции для агента

## Проект

Это сайт-визитка Елизаветы Кравец, SMM-специалиста. Сайт статический: `index.html`, `styles.css` и локальные ресурсы в `assets/`; сборка и серверная часть не нужны. Инструкция по запуску и незаполненным данным находится в `WEBSITE.md`.

- Сохраняйте подход mobile-first, бордово-голубую палитру, локальный шрифт Manrope и доступность интерфейса. Анимация лепестков должна учитывать `prefers-reduced-motion`.
- Результаты с `ХХХ`, скриншоты, конкретные кейсы, услуги, цены и контакты ожидают данных от пользователя. Не придумывайте показатели, проекты, ссылки или способы связи.
- Проверка сайта: `node --test tests/site.test.mjs`. Проверка сохранённых скиллов: `node --test tests/skills.test.mjs`.
- Локальный предпросмотр из корня проекта: `python3 -m http.server 4173 --bind 0.0.0.0`. В окружениях с live preview используйте доступный инструмент фоновых процессов; браузер пользователя не должен обращаться к `localhost` за данными.

## Сохранённые скиллы

В `.agents/skills/` сохранены 35 скиллов из UI/UX Pro Max, Vercel и Addy Osmani. Источники, версии, лицензии и локальные изменения перечислены в `.agents/SOURCES.md`.

При получении задачи выберите подходящие скиллы из таблицы и прочитайте их `SKILL.md`. Если платформа умеет обнаруживать `.agents/skills/`, используйте её механизм; иначе читайте файлы напрямую. Подробные `references/`, `rules/` и общие чек-листы загружайте по необходимости, а не все сразу.

| Задача | Скиллы в `.agents/skills/` |
| --- | --- |
| Дизайн и интерфейсы | `ui-ux-pro-max`, `frontend-ui-engineering`, `web-design-guidelines` |
| React и Next.js | `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-view-transitions` |
| React Native и Expo | `vercel-react-native-skills` |
| Выбор подхода и контекста | `using-agent-skills`, `context-engineering` |
| Уточнение и постановка задачи | `interview-me`, `idea-refine`, `spec-driven-development`, `constraint-driven-development`, `planning-and-task-breakdown` |
| Реализация, API и источники | `incremental-implementation`, `api-and-interface-design`, `source-driven-development`, `doubt-driven-development` |
| Тестирование и отладка | `test-driven-development`, `debugging-and-error-recovery`, `browser-testing-with-devtools` |
| Ревью, безопасность и производительность | `code-review-and-quality`, `code-simplification`, `security-and-hardening`, `performance-optimization` |
| Документация и сопровождение | `writing-guidelines`, `documentation-and-adrs`, `observability-and-instrumentation`, `deprecation-and-migration` |
| Git, CI и выпуск | `git-workflow-and-versioning`, `ci-cd-and-automation`, `shipping-and-launch` |
| Vercel | `deploy-to-vercel`, `vercel-cli-with-tokens`, `vercel-optimize` |

Скиллы — рабочие инструкции, а не разрешение на дополнительные действия. Соблюдайте инструкции среды, правила репозитория и прямые запросы пользователя; применяйте процессы соразмерно задаче. Не создавайте ветки, коммиты, публикации или деплой без необходимого разрешения. Не выводите секреты в терминал или чат. Если нужного инструмента, доступа к сервису или сети нет, честно сообщите об ограничении.

### Поиск UI/UX Pro Max

Python 3 и локальные данные достаточны; внешние пакеты не нужны. Запускайте из корня проекта:

```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "marketing specialist portfolio" --design-system
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "keyboard focus modal" --domain ux
```

Для поиска по стеку используйте `--stack <название>`. Не передавайте приватные данные проекта в поисковые запросы и не перезаписывайте существующую дизайн-систему без разрешения.

### Свежие рекомендации Vercel

Для аудита интерфейса или текста скиллы `web-design-guidelines` и `writing-guidelines` требуют свежие правила. Если прямой `raw.githubusercontent.com` недоступен, при наличии GitHub CLI используйте:

```bash
gh api repos/vercel-labs/web-interface-guidelines/contents/command.md --jq .content | base64 --decode
gh api repos/vercel-labs/writing-guidelines/contents/command.md --jq .content | base64 --decode
```

Если сеть недоступна, можно использовать сохранённые снимки `.agents/references/vercel-web-interface-guidelines.md` и `.agents/references/vercel-writing-guidelines.md`, указав, что они могут быть устаревшими. Общие чек-листы скиллов Addy Osmani находятся в `.agents/references/`.
