# Logistics Docs — TODO

## Database Schema
- [x] Counterparties table (ИНН, ОГРН, КПП, bank accounts, addresses, type)
- [x] Contracts table (linked to counterparty, number, date, type, status)
- [x] Specifications table (linked to contract, addresses, price, volume_total, volume_shipped, status)
- [x] Waybills table (linked to specification, supplier, buyer, carrier, tractor, trailer, gross, tare, net, status, number auto-increment)
- [x] Run migrations

## Backend (tRPC Routers)
- [x] counterparties router: list, getById, create, update, delete
- [x] contracts router: list, getById, create, update, delete, updateStatus
- [x] specifications router: list, getById, create, update, delete, updateStatus, updateShipped
- [x] waybills router: list, getById, create, update, delete, updateStatus
- [x] Auto-numbering for waybills
- [x] PDF generation REST endpoint (/api/waybills/:id/pdf)

## Frontend — Layout & Navigation
- [x] AppLayout with sidebar (Контрагенты, Договоры, Спецификации, Накладные)
- [x] Dashboard home with stats cards
- [x] Elegant design system (colors, typography, spacing)

## Frontend — Counterparties (Контрагенты)
- [x] List page with search and filter
- [x] Detail card with requisites (ИНН, ОГРН, КПП, счета, адреса)
- [x] Linked documents list on detail card
- [x] Create/Edit form

## Frontend — Contracts (Договоры)
- [x] List page with search, filter by status/counterparty
- [x] Create form with counterparty auto-fill
- [x] Status management (manual change via dropdown)

## Frontend — Specifications (Спецификации)
- [x] List page with search and filter
- [x] Volume tracking progress bar (отгружено / остаток)
- [x] Create form linked to contract
- [x] Status management (manual change via dropdown)

## Frontend — Waybills (Накладные)
- [x] List page with search, filter by status
- [x] Create form with 4 blocks: Закупка, Продажа, Перевозчик, Весовые характеристики
- [x] Auto-fill from specification
- [x] Weight fields: Брутто, Тара, Нетто (auto-calc Нетто = Брутто − Тара)
- [x] Status management (manual change via dropdown)
- [x] PDF generation and download

## PDF Generation
- [x] pdfkit installed
- [x] Waybill PDF template with all 4 blocks
- [x] Download endpoint

## Testing
- [x] Vitest tests for auth router
- [x] Vitest tests for dashboard stats
- [x] Vitest tests for counterparties, contracts, specifications, waybills routers

## Изменения по запросу пользователя
- [x] Убрать экран логина — приложение должно открываться сразу без авторизации
- [x] Убрать упоминания Manus из интерфейса (логотип, имя пользователя, кнопка выхода)
- [x] Заменить protectedProcedure на publicProcedure в tRPC роутерах
