import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  counterparties,
  contracts,
  specifications,
  deals,
  organizationProfiles,
  waybills,
  type InsertCounterparty,
  type InsertContract,
  type InsertSpecification,
  type InsertDeal,
  type InsertOrganizationProfile,
  type InsertWaybill,
} from "../drizzle/schema";
import { eq, or, and, isNull } from "drizzle-orm";

async function main() {
  const connectionUrl = process.env.DATABASE_URL || "mysql://root@127.0.0.1:3306/logistics_docs";
  console.log("Connecting to database:", connectionUrl.replace(/:[^:@]*@/, ":***@"));

  const connection = await mysql.createConnection(connectionUrl);
  const db = drizzle(connection);

  console.log("--- 1. Upsert Own Organization Profile (ООО «ТД «АЛМАЗ») ---");
  const ownOrgData: Omit<InsertOrganizationProfile, "id" | "createdAt" | "updatedAt"> = {
    name: 'Общество с ограниченной ответственностью «ТОРГОВЫЙ ДОМ «АЛМАЗ»',
    shortName: 'ООО «ТД «АЛМАЗ»',
    inn: "2371003651",
    kpp: "237101001",
    ogrn: "1202300051348",
    legalAddress: "352026, Краснодарский край, Кущевский р-н, п. Комсомольский, ул. 70 лет Октября, д. 2",
    postalAddress: "352026, Краснодарский край, Кущевский р-н, п. Комсомольский, ул. 70 лет Октября, д. 2",
    representativeName: "Сайко Илья Сергеевич",
    representativePosition: "Директор",
    authorityBasis: "Устав",
    bankName: "Отделение № 8619 Сбербанка России г. Краснодар",
    bankBik: "040349602",
    bankAccount: "40702810330000046572",
    corrAccount: "30101810100000000602",
    phone: "8 (938) 535-45-45",
    email: "agro.almaz@mail.ru",
  };

  const existingOrgs = await db.select().from(organizationProfiles).limit(1);
  if (existingOrgs.length > 0) {
    await db.update(organizationProfiles).set(ownOrgData).where(eq(organizationProfiles.id, existingOrgs[0].id));
    console.log("Updated own organization profile ID:", existingOrgs[0].id);
  } else {
    const res = await db.insert(organizationProfiles).values(ownOrgData);
    console.log("Inserted own organization profile ID:", res[0].insertId);
  }

  console.log("--- 2. Upsert Distributed Counterparties ---");
  const counterpartiesToSeed: InsertCounterparty[] = [
    // 1. Carrier - Без НДС (ИП Шелковников А.А. из договора перевозки № 20/26)
    {
      name: "Индивидуальный предприниматель Шелковников Алексей Алексеевич",
      shortName: "ИП Шелковников А.А.",
      type: "individual",
      businessRole: "carrier",
      vatType: "without_vat",
      status: "normal",
      region: "Ростовская область",
      profile: "Автомобильные грузоперевозки сельхозпродукции (зерновозы)",
      inn: "611186946109",
      ogrn: "321619600220816",
      legalAddress: "Ростовская область, Зерноградский район, х. 1-й Россошинский, ул. Садовая, д. 102, кв. 2",
      postalAddress: "Ростовская область, Зерноградский район, х. 1-й Россошинский, ул. Садовая, д. 102, кв. 2",
      actualAddress: "Ростовская область, Зерноградский район, х. 1-й Россошинский, ул. Садовая, д. 102, кв. 2",
      representativeName: "Шелковников Алексей Алексеевич",
      representativePosition: "Индивидуальный предприниматель",
      authorityBasis: "Свидетельство ОГРНИП 321619600220816",
      bankName: "Филиал «Ростовский» АО «АЛЬФА-БАНК» г. Ростов-на-Дону",
      bankBik: "046015207",
      bankAccount: "40802810426020031581",
      corrAccount: "30101810500000000207",
      phone: "+7 (928) 123-45-67",
      email: "shelkovnikov.trans@mail.ru",
      notes: "Основной перевозчик по договору № 20/26. УСН (без НДС). Подвижной состав проверен.",
    },
    // 2. Carrier - С НДС (ООО АгроТрансЛогистик)
    {
      name: "Общество с ограниченной ответственностью «АгроТрансЛогистик»",
      shortName: "ООО «АгроТрансЛогистик»",
      type: "legal",
      businessRole: "carrier",
      vatType: "with_vat",
      status: "normal",
      region: "Ростовская область",
      profile: "Федеральный перевозчик зерновых и масличных культур с собственным автопарком с НДС",
      inn: "6165219840",
      kpp: "616501001",
      ogrn: "1196196014520",
      legalAddress: "344018, Ростовская область, г. Ростов-на-Дону, пер. Соборный, д. 90, оф. 402",
      postalAddress: "344018, Ростовская область, г. Ростов-на-Дону, пер. Соборный, д. 90, оф. 402",
      actualAddress: "344018, Ростовская область, г. Ростов-на-Дону, пер. Соборный, д. 90, оф. 402",
      representativeName: "Мельников Денис Игоревич",
      representativePosition: "Генеральный директор",
      authorityBasis: "Устав",
      bankName: "Юго-Западный банк ПАО Сбербанк г. Ростов-на-Дону",
      bankBik: "046015602",
      bankAccount: "40702810952090012345",
      corrAccount: "30101810600000000602",
      phone: "+7 (863) 299-88-77",
      email: "info@agrotranslog.ru",
      notes: "Перевозчик с ОСНО (с НДС). Предоставляет полный пакет документов и реестры ТТН.",
    },
    // 3. Buyer - С НДС (ООО ТРЕЙД ОВЕРСИС из договора перевозки и проектов)
    {
      name: "Общество с ограниченной ответственностью «ТРЕЙД ОВЕРСИС»",
      shortName: "ООО «ТРЕЙД ОВЕРСИС»",
      type: "legal",
      businessRole: "buyer",
      vatType: "with_vat",
      status: "normal",
      region: "г. Москва",
      profile: "Крупный зерновой экспортёр и трейдер (поставка в портовые терминалы)",
      inn: "9704197254",
      kpp: "770301001",
      ogrn: "1237700085420",
      legalAddress: "123112, г. Москва, вн.тер.г. Муниципальный округ Пресненский, Пресненская наб., д. 6, стр. 2, помещ. 26/38",
      postalAddress: "123112, г. Москва, Пресненская наб., д. 6, стр. 2, помещ. 26/38",
      actualAddress: "г. Ростов-на-Дону, ул. 1-я Луговая, д. 42б (Портовый терминал)",
      representativeName: "Смирнов Андрей Викторович",
      representativePosition: "Генеральный директор",
      authorityBasis: "Устав",
      bankName: "ПАО «БАНК ВТБ» г. Москва",
      bankBik: "044525411",
      bankAccount: "40702810200000045678",
      corrAccount: "30101810145250000411",
      phone: "+7 (495) 789-01-23",
      email: "trade.overseas@agro-export.ru",
      notes: "Ключевой покупатель сельхозпродукции (с НДС). Пункт разгрузки: г. Ростов-на-Дону, ул. 1-я Луговая, д. 42б.",
    },
    // 4. Buyer - С НДС (ООО Южный Зерновой Терминал)
    {
      name: "Общество с ограниченной ответственностью «Южный Зерновой Терминал»",
      shortName: "ООО «ЮЗТ»",
      type: "legal",
      businessRole: "buyer",
      vatType: "with_vat",
      status: "normal",
      region: "Краснодарский край",
      profile: "Экспортёр зерна глубоководной перевалки Новороссийск",
      inn: "2315189045",
      kpp: "231501001",
      ogrn: "1142315003421",
      legalAddress: "353900, Краснодарский край, г. Новороссийск, ул. Портовая, д. 15",
      postalAddress: "353900, Краснодарский край, г. Новороссийск, ул. Портовая, д. 15",
      actualAddress: "353900, Краснодарский край, г. Новороссийск, Портовая перевалка",
      representativeName: "Васильев Артем Олегович",
      representativePosition: "Директор",
      authorityBasis: "Устав",
      bankName: "ПАО Сбербанк г. Краснодар",
      bankBik: "040349602",
      bankAccount: "40702810830000098765",
      corrAccount: "30101810100000000602",
      phone: "+7 (8617) 60-12-34",
      email: "terminal@yug-grain.ru",
      notes: "Покупатель зерновых (ОСНО с НДС). Приемка в порту Новороссийск.",
    },
    // 5. Seller - Без НДС (ИП ГКФХ «Березовая Роща» по адресу погрузки из заявки перевозки)
    {
      name: "Индивидуальный предприниматель Глава крестьянского (фермерского) хозяйства Иванов Иван Васильевич",
      shortName: "ИП ГКФХ Иванов И.В.",
      type: "sole_trader",
      businessRole: "seller",
      vatType: "without_vat",
      status: "normal",
      region: "Ростовская область",
      profile: "Сельхозтоваропроизводитель (ЕСХН без НДС): производство гороха продовольственного, пшеницы, ячменя",
      inn: "611401234567",
      ogrn: "318619600012345",
      legalAddress: "347706, Ростовская область, м. р-н Кагальницкий, с.п. Кировское, п. Березовая Роща, ул. Полевая, д. 8",
      postalAddress: "347706, Ростовская область, м. р-н Кагальницкий, с.п. Кировское, п. Березовая Роща, ул. Полевая, д. 8",
      actualAddress: "347706, Ростовская область, м. р-н Кагальницкий, с.п. Кировское, п. Березовая Роща, ул. Полевая, д. 8",
      loadingAddress: "347706, Ростовская обл., м. р-н Кагальницкий, с.п. Кировское, п. Березовая Роща (Ток / Склад № 1)",
      representativeName: "Иванов Иван Васильевич",
      representativePosition: "Глава КФХ",
      authorityBasis: "Свидетельство ОГРНИП 318619600012345",
      bankName: "АО «РОССЕЛЬХОЗБАНК» Ростовский РФ",
      bankBik: "046015799",
      bankAccount: "40802810500120004561",
      corrAccount: "30101810600000000799",
      phone: "+7 (918) 555-22-33",
      email: "kfh.berezovaya@mail.ru",
      notes: "Сельхозпроизводитель без НДС (ЕСХН). Пункт погрузки по Заявке № 1: п. Березовая Роща, Кагальницкий р-н.",
    },
    // 6. Seller - С НДС (ИП Глава КФХ Петров С.Н. - категория «Глава КФХ с НДС»)
    {
      name: "Индивидуальный предприниматель Глава крестьянского (фермерского) хозяйства Петров Сергей Николаевич",
      shortName: "ИП ГКФХ Петров С.Н.",
      type: "sole_trader",
      businessRole: "seller",
      vatType: "with_vat",
      status: "normal",
      region: "Ростовская область",
      profile: "Сельхозпроизводитель (Глава КФХ с НДС): выращивание пшеницы 3 класса, кукурузы",
      inn: "610109876543",
      ogrn: "320619600054321",
      legalAddress: "347740, Ростовская область, Зерноградский район, г. Зерноград, ул. Мира, д. 45",
      postalAddress: "347740, Ростовская область, Зерноградский район, г. Зерноград, ул. Мира, д. 45",
      actualAddress: "347740, Ростовская область, Зерноградский район, г. Зерноград, ул. Мира, д. 45",
      loadingAddress: "Ростовская область, Зерноградский р-н, ст-ца Мечетинская, ул. Элеваторная, д. 5",
      representativeName: "Петров Сергей Николаевич",
      representativePosition: "Глава КФХ",
      authorityBasis: "Свидетельство ОГРНИП 320619600054321",
      bankName: "ПАО Сбербанк г. Ростов-на-Дону",
      bankBik: "046015602",
      bankAccount: "40802810152000034567",
      corrAccount: "30101810600000000602",
      phone: "+7 (928) 444-11-22",
      email: "kfh.kolos61@yandex.ru",
      notes: "Глава КФХ на ОСНО (с НДС). Предоставлены согласия по ст. 102 НК РФ и декларации.",
    },
    // 7. Seller - С НДС (Сельхозкооператив СПК «Степные Просторы» - категория «Остальные с НДС»)
    {
      name: "Сельскохозяйственный производственный кооператив «Степные Просторы»",
      shortName: "СПК «Степные Просторы»",
      type: "legal",
      businessRole: "seller",
      vatType: "with_vat",
      status: "normal",
      region: "Краснодарский край",
      profile: "Крупный агрохолдинг / сельхозпредприятие с НДС: зерновые, масличные культуры",
      inn: "2340018920",
      kpp: "234001001",
      ogrn: "1022304245678",
      legalAddress: "352030, Краснодарский край, Кущевский район, ст-ца Кущевская, ул. Советская, д. 80",
      postalAddress: "352030, Краснодарский край, Кущевский район, ст-ца Кущевская, ул. Советская, д. 80",
      actualAddress: "352030, Краснодарский край, Кущевский район, ст-ца Кущевская, ул. Советская, д. 80",
      loadingAddress: "352030, Краснодарский край, Кущевский р-н, х. Большая Лопатина, Центральный зерноток",
      representativeName: "Сидоренко Николай Павлович",
      representativePosition: "Председатель кооператива",
      authorityBasis: "Устав",
      bankName: "Краснодарский РФ АО «Россельхозбанк»",
      bankBik: "040349836",
      bankAccount: "40702810300180000123",
      corrAccount: "30101810700000000836",
      phone: "+7 (86168) 5-31-42",
      email: "spk-step@kuban-agro.ru",
      notes: "Сельхозпредприятие (ООО/СХПК) на ОСНО (с НДС). Полный пакет уставных и налоговых документов.",
    },
  ];

  const seededCounterparties: Record<string, number> = {};

  for (const cp of counterpartiesToSeed) {
    const existing = await db
      .select()
      .from(counterparties)
      .where(and(isNull(counterparties.deletedAt), or(eq(counterparties.inn, cp.inn!), eq(counterparties.name, cp.name))))
      .limit(1);

    if (existing.length > 0) {
      await db.update(counterparties).set(cp).where(eq(counterparties.id, existing[0].id));
      console.log(`Updated counterparty [${cp.businessRole} | ${cp.vatType}]: ${cp.shortName} (ID: ${existing[0].id})`);
      seededCounterparties[cp.shortName || cp.name] = existing[0].id;
    } else {
      const res = await db.insert(counterparties).values(cp);
      const newId = Number(res[0].insertId);
      console.log(`Inserted counterparty [${cp.businessRole} | ${cp.vatType}]: ${cp.shortName} (ID: ${newId})`);
      seededCounterparties[cp.shortName || cp.name] = newId;
    }
  }

  console.log("--- 3. Upsert Contracts and Specifications matching documents ---");
  const carrierId = seededCounterparties["ИП Шелковников А.А."];
  const buyerId = seededCounterparties["ООО «ТРЕЙД ОВЕРСИС»"];
  const sellerId = seededCounterparties["ИП ГКФХ Иванов И.В."];

  if (carrierId) {
    // Договор перевозки № 20/26 от 20.03.2026
    const carriageContractNum = "20/26";
    let contractId: number;
    const existing = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.number, carriageContractNum), isNull(contracts.deletedAt)))
      .limit(1);

    const contractData: InsertContract = {
      number: carriageContractNum,
      counterpartyId: carrierId,
      contractKind: "carriage",
      type: "service",
      subject: "Оказание услуг по перевозке грузов автомобильным транспортом (горох продовольственный)",
      startDate: new Date("2026-03-20T00:00:00Z"),
      endDate: new Date("2026-12-31T23:59:59Z"),
      amount: "100000.00",
      currency: "RUB",
      status: "active",
      notes: "Договор перевозки № 20/26 с ИП Шелковников А.А. (тариф 500 руб./т).",
    };

    if (existing.length > 0) {
      await db.update(contracts).set(contractData).where(eq(contracts.id, existing[0].id));
      contractId = existing[0].id;
      console.log(`Updated carriage contract № ${carriageContractNum} (ID: ${contractId})`);
    } else {
      const res = await db.insert(contracts).values(contractData);
      contractId = Number(res[0].insertId);
      console.log(`Inserted carriage contract № ${carriageContractNum} (ID: ${contractId})`);
    }

    // Спецификация (Заявка № 1) к Договору перевозки № 20/26
    const specNum = "Заявка №1";
    const existingSpec = await db
      .select()
      .from(specifications)
      .where(and(eq(specifications.contractId, contractId), eq(specifications.number, specNum), isNull(specifications.deletedAt)))
      .limit(1);

    const specData: InsertSpecification = {
      number: specNum,
      contractId,
      counterpartyId: carrierId,
      cargoName: "Горох продовольственный на пищевые цели",
      loadingAddress: "347706, Ростовская обл., м. р-н Кагальницкий, с.п Кировское, п. Березовая Роща",
      unloadingAddress: "г. Ростов-на-Дону, ул. 1-я Луговая, д. 42б",
      pricePerUnit: "500.00",
      unit: "т",
      volumeTotal: "200.000",
      volumeShipped: "0.000",
      startDate: new Date("2026-03-20T00:00:00Z"),
      endDate: new Date("2026-03-25T23:59:59Z"),
      status: "active",
      notes: "Заявка № 1 к Договору перевозки № 20/26. Маршрут: п. Березовая Роща -> г. Ростов-на-Дону, ул. 1-я Луговая, д. 42б.",
    };

    if (existingSpec.length > 0) {
      await db.update(specifications).set(specData).where(eq(specifications.id, existingSpec[0].id));
      console.log(`Updated specification ${specNum} for contract ${carriageContractNum}`);
    } else {
      await db.insert(specifications).values(specData);
      console.log(`Inserted specification ${specNum} for contract ${carriageContractNum}`);
    }
  }

  if (sellerId) {
    // Договор закупки № 12/26 от 15.03.2026
    const purchaseNum = "12/26";
    let contractId: number;
    const existing = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.number, purchaseNum), isNull(contracts.deletedAt)))
      .limit(1);

    const contractData: InsertContract = {
      number: purchaseNum,
      counterpartyId: sellerId,
      contractKind: "purchase",
      type: "framework",
      subject: "Поставка сельскохозяйственной продукции (горох продовольственный)",
      startDate: new Date("2026-03-15T00:00:00Z"),
      endDate: new Date("2026-12-31T23:59:59Z"),
      amount: "3600000.00",
      currency: "RUB",
      status: "active",
      notes: "Договор закупки с сельхозпроизводителем ИП ГКФХ Иванов И.В. (200 т по 18 000 руб./т).",
    };

    if (existing.length > 0) {
      await db.update(contracts).set(contractData).where(eq(contracts.id, existing[0].id));
      contractId = existing[0].id;
      console.log(`Updated purchase contract № ${purchaseNum} (ID: ${contractId})`);
    } else {
      const res = await db.insert(contracts).values(contractData);
      contractId = Number(res[0].insertId);
      console.log(`Inserted purchase contract № ${purchaseNum} (ID: ${contractId})`);
    }

    // Спецификация № 1 к договору закупки
    const specNum = "1";
    const existingSpec = await db
      .select()
      .from(specifications)
      .where(and(eq(specifications.contractId, contractId), eq(specifications.number, specNum), isNull(specifications.deletedAt)))
      .limit(1);

    const specData: InsertSpecification = {
      number: specNum,
      contractId,
      counterpartyId: sellerId,
      cargoName: "Горох продовольственный на пищевые цели",
      loadingAddress: "347706, Ростовская обл., м. р-н Кагальницкий, с.п Кировское, п. Березовая Роща (Склад № 1)",
      unloadingAddress: "г. Ростов-на-Дону, ул. 1-я Луговая, д. 42б",
      pricePerUnit: "18000.00",
      unit: "т",
      volumeTotal: "200.000",
      volumeShipped: "0.000",
      startDate: new Date("2026-03-15T00:00:00Z"),
      endDate: new Date("2026-03-31T23:59:59Z"),
      status: "active",
      notes: "Спецификация № 1 на закупку 200 тонн гороха по 18 000 руб./т.",
    };

    if (existingSpec.length > 0) {
      await db.update(specifications).set(specData).where(eq(specifications.id, existingSpec[0].id));
      console.log(`Updated specification ${specNum} for purchase contract ${purchaseNum}`);
    } else {
      await db.insert(specifications).values(specData);
      console.log(`Inserted specification ${specNum} for purchase contract ${purchaseNum}`);
    }
  }

  if (buyerId) {
    // Договор реализации № ТО-01/26 от 18.03.2026
    const saleNum = "ТО-01/26";
    let contractId: number;
    const existing = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.number, saleNum), isNull(contracts.deletedAt)))
      .limit(1);

    const contractData: InsertContract = {
      number: saleNum,
      counterpartyId: buyerId,
      contractKind: "sale",
      type: "framework",
      subject: "Поставка сельскохозяйственной продукции (горох продовольственный)",
      startDate: new Date("2026-03-18T00:00:00Z"),
      endDate: new Date("2026-12-31T23:59:59Z"),
      amount: "4200000.00",
      currency: "RUB",
      status: "active",
      notes: "Договор поставки/реализации с ООО «ТРЕЙД ОВЕРСИС» (200 т по 21 000 руб./т).",
    };

    if (existing.length > 0) {
      await db.update(contracts).set(contractData).where(eq(contracts.id, existing[0].id));
      contractId = existing[0].id;
      console.log(`Updated sale contract № ${saleNum} (ID: ${contractId})`);
    } else {
      const res = await db.insert(contracts).values(contractData);
      contractId = Number(res[0].insertId);
      console.log(`Inserted sale contract № ${saleNum} (ID: ${contractId})`);
    }

    // Спецификация № 1 к договору реализации
    const specNum = "1";
    const existingSpec = await db
      .select()
      .from(specifications)
      .where(and(eq(specifications.contractId, contractId), eq(specifications.number, specNum), isNull(specifications.deletedAt)))
      .limit(1);

    const specData: InsertSpecification = {
      number: specNum,
      contractId,
      counterpartyId: buyerId,
      cargoName: "Горох продовольственный на пищевые цели",
      loadingAddress: "347706, Ростовская обл., м. р-н Кагальницкий, с.п Кировское, п. Березовая Роща",
      unloadingAddress: "г. Ростов-на-Дону, ул. 1-я Луговая, д. 42б",
      pricePerUnit: "21000.00",
      unit: "т",
      volumeTotal: "200.000",
      volumeShipped: "0.000",
      startDate: new Date("2026-03-18T00:00:00Z"),
      endDate: new Date("2026-03-31T23:59:59Z"),
      status: "active",
      notes: "Спецификация № 1 на поставку 200 тонн гороха по 21 000 руб./т в г. Ростов-на-Дону, ул. 1-я Луговая, д. 42б.",
    };

    if (existingSpec.length > 0) {
      await db.update(specifications).set(specData).where(eq(specifications.id, existingSpec[0].id));
      console.log(`Updated specification ${specNum} for sale contract ${saleNum}`);
    } else {
      await db.insert(specifications).values(specData);
      console.log(`Inserted specification ${specNum} for sale contract ${saleNum}`);
    }
  }

  // Сделка (Deal)
  if (sellerId && buyerId && carrierId) {
    const dealNum = "СД-2026/01";
    const existingDeal = await db
      .select()
      .from(deals)
      .where(and(eq(deals.number, dealNum), isNull(deals.deletedAt)))
      .limit(1);

    const dealData: InsertDeal = {
      number: dealNum,
      sellerId,
      buyerId,
      carrierId,
      cargoName: "Горох продовольственный на пищевые цели",
      cargoGrade: "1 сорт",
      plannedVolume: "200.000",
      purchasePrice: "18000.00",
      salePrice: "21000.00",
      currency: "RUB",
      startDate: new Date("2026-03-20T00:00:00Z"),
      endDate: new Date("2026-03-31T23:59:59Z"),
      status: "active",
      notes: "Сделка по поставке 200 тонн гороха от ИП ГКФХ Иванов И.В. для ООО «ТРЕЙД ОВЕРСИС» с доставкой силами ИП Шелковников А.А.",
    };

    let dealId: number;
    if (existingDeal.length > 0) {
      await db.update(deals).set(dealData).where(eq(deals.id, existingDeal[0].id));
      dealId = existingDeal[0].id;
      console.log(`Updated deal № ${dealNum} (ID: ${dealId})`);
    } else {
      const res = await db.insert(deals).values(dealData);
      dealId = Number(res[0].insertId);
      console.log(`Inserted deal № ${dealNum} (ID: ${dealId})`);
    }

    // Link specifications to this deal
    await db
      .update(specifications)
      .set({ dealId })
      .where(
        and(
          isNull(specifications.deletedAt),
          or(
            eq(specifications.number, "Заявка №1"),
            eq(specifications.number, "1")
          )
        )
      );
    console.log(`Linked specifications to deal ID: ${dealId}`);

    // Seed a waybill in transit for this deal
    const waybillNum = "ТТН-2026/001";
    const existingWb = await db.select().from(waybills).where(eq(waybills.number, waybillNum)).limit(1);
    const carriageContract = await db.select().from(contracts).where(and(eq(contracts.number, "20/26"), isNull(contracts.deletedAt))).limit(1);
    const carriageSpec = await db.select().from(specifications).where(and(eq(specifications.number, "Заявка №1"), isNull(specifications.deletedAt))).limit(1);

    const wbData: InsertWaybill = {
      number: waybillNum,
      contractId: carriageContract[0]?.id,
      specificationId: carriageSpec[0]?.id,
      supplierId: sellerId,
      supplierName: "ИП ГКФХ Иванов Иван Васильевич",
      loadingAddress: "347706, Ростовская обл., м. р-н Кагальницкий, с.п Кировское, п. Березовая Роща",
      buyerId: buyerId,
      buyerName: "ООО «ТРЕЙД ОВЕРСИС»",
      unloadingAddress: "г. Ростов-на-Дону, ул. 1-я Луговая, д. 42б",
      carrierId: carrierId,
      carrierName: "ИП Шелковников Алексей Алексеевич",
      driverName: "Шелковников А.А.",
      vehicleMake: "КАМАЗ 6520",
      tractorNumber: "А 777 АА 161",
      trailerNumber: "Е 1234 61",
      cargoName: "Горох продовольственный на пищевые цели",
      cargoGrade: "1 сорт",
      quantity: "32.500",
      grossWeight: "48.200",
      tareWeight: "15.700",
      netWeight: "32.500",
      dispatchedWeight: "32.500",
      receivedWeight: "32.480",
      pricePerUnit: "500.00",
      currency: "RUB",
      status: "in_transit",
      waybillDate: new Date("2026-03-21T08:30:00Z"),
      notes: "Рейс № 1 по Заявке № 1 договора перевозки 20/26. В пути на терминал в Ростове-на-Дону.",
    };

    if (existingWb.length > 0) {
      await db.update(waybills).set(wbData).where(eq(waybills.id, existingWb[0].id));
      console.log(`Updated waybill ${waybillNum}`);
    } else {
      await db.insert(waybills).values(wbData);
      console.log(`Inserted waybill ${waybillNum}`);
    }
  }

  await connection.end();
  console.log("--- Seeding successfully finished! ---");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
