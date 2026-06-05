# CRM Almaz: логистика и документооборот

CRM Almaz — веб-приложение для ведения логистических документов: контрагентов, договоров, спецификаций и товарно-транспортных накладных. Проект помогает быстро оформить перевозку зерновых грузов, сохранить связи между участниками сделки и получить печатную форму СП-31 или редактируемый XLSX-документ.

## Технологии

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=111)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Radix UI](https://img.shields.io/badge/Radix_UI-components-161618?style=for-the-badge&logo=radixui&logoColor=white)
![tRPC](https://img.shields.io/badge/tRPC-11-2596BE?style=for-the-badge&logo=trpc&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle_ORM-0.44-C5F74F?style=for-the-badge&logo=drizzle&logoColor=111)
![MySQL](https://img.shields.io/badge/MySQL-8+-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-deploy-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-10-F69220?style=for-the-badge&logo=pnpm&logoColor=white)

## Возможности

- Единая база контрагентов с реквизитами, адресами и контактами.
- Учет договоров и спецификаций по поставкам.
- Создание и редактирование ТТН с участниками перевозки: поставщик, покупатель, перевозчик, владелец транспорта и плательщик.
- Хранение данных по автомобилю, прицепу, водителю, маршруту, грузу и весам.
- Печатная форма товарно-транспортной накладной СП-31 по образцу.
- Скачивание редактируемого XLSX-файла ТТН, чтобы при необходимости поправить форму вручную.
- Скачивание печатной HTML-формы и сохранение в PDF через браузер.
- Автоматическое применение миграций при старте приложения.

## Стек проекта

| Слой | Что используется |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Radix UI, lucide-react |
| API | Express, tRPC, SuperJSON, Zod |
| База данных | MySQL, Drizzle ORM, drizzle-kit |
| Документы | HTML-печать СП-31, XLSX-шаблон формы, PDFKit для базовых PDF-сценариев |
| Инфраструктура | Docker, Railway, pnpm |
| Проверки | TypeScript, Vitest |

## Структура

```text
logistics-docs/
├── client/                 # React-приложение
├── server/                 # Express/tRPC API, печатные формы, XLSX-генерация
│   ├── templates/          # Шаблоны документов
│   ├── waybillPrintService.ts
│   └── waybillXlsxService.ts
├── drizzle/                # Схема и миграции MySQL
├── shared/                 # Общие типы и константы
├── Dockerfile
├── railway.toml
└── package.json
```

## Локальный запуск

Требования:

- Node.js 22+
- pnpm 10+
- MySQL 8+

1. Установить зависимости:

```bash
pnpm install
```

2. Создать `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

3. Указать подключение к MySQL:

```env
DATABASE_URL=mysql://user:password@host:3306/logistics_docs
```

4. Применить миграции:

```bash
pnpm db:push
```

5. Запустить приложение:

```bash
pnpm dev
```

По умолчанию сервер поднимается на `http://localhost:3000`. Если порт занят, в dev-режиме приложение выберет ближайший свободный порт.

## Команды

```bash
pnpm dev       # запуск разработки
pnpm build     # production-сборка
pnpm start     # запуск production-сборки
pnpm check     # проверка TypeScript
pnpm test      # тесты Vitest
pnpm db:push   # генерация и применение миграций Drizzle
```

## Переменные окружения

Минимально обязательная переменная:

| Переменная | Назначение |
| --- | --- |
| `DATABASE_URL` | строка подключения к MySQL |

Дополнительные переменные могут использоваться для OAuth, карт, аналитики и файлового хранилища, если эти интеграции включены в окружении.

## Деплой на Railway

Проект готов к деплою через Dockerfile. Railway использует `railway.toml` и проверяет `/api/health`.

1. Подключить GitHub-репозиторий к Railway.
2. Добавить MySQL-сервис в Railway.
3. В переменных сервиса приложения указать:

```env
DATABASE_URL=${{MySQL.MYSQL_URL}}
```

4. Если репозиторий открыт из родительской папки, задать Root Directory:

```text
/logistics-docs
```

5. Запустить деплой или дождаться автодеплоя после `git push`.

## Документы ТТН

Печатная форма СП-31 доступна из меню накладной:

- `Итоговая ТТН по образцу` — открыть форму для печати или сохранения PDF.
- `Скачать печатную форму` — скачать HTML-версию формы.
- `Скачать XLSX` — скачать Excel-файл на базе шаблона СП-31 для ручного редактирования.

## Важно

Если приложение развернуто публично без дополнительной защиты, любой пользователь с доступом к ссылке сможет просматривать и менять данные. Для рабочего использования лучше ограничить доступ на уровне Railway, прокси, VPN или закрытой сети.
