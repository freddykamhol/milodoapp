import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const epochMsNow = sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`;

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),

    role: text("role", {
      enum: ["ADMIN", "VERWALTUNG", "PERSONAL", "KUNDE"],
    }).notNull(),

    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),

    qualRD: text("qual_rd", {
      enum: ["SAN", "RH", "RS", "RA", "NFS"],
    }),
    qualAusb: text("qual_ausb", {
      enum: ["AUSBILDER"],
    }),

    geb: integer("geb", { mode: "timestamp_ms" }),
    telefon: text("telefon"),
    email: text("email"),
    eintritt: integer("eintritt", { mode: "timestamp_ms" }),
    anzahlEinsaetze: integer("anzahl_einsaetze").notNull().default(0),

    strasse: text("strasse"),
    hausnummer: text("hausnummer"),
    plz: text("plz"),
    ort: text("ort"),
    ortErgaenzung: text("ort_ergaenzung").notNull().default(""),

    einsatzort: text("einsatzort", {
      enum: ["AUSBILDUNG", "RD", "BEIDE"],
    }),

    locked: integer("locked", { mode: "boolean" }).notNull().default(false),

    publicFirstName: integer("public_first_name", { mode: "boolean" }).notNull().default(true),
    publicLastName: integer("public_last_name", { mode: "boolean" }).notNull().default(true),
    publicGeb: integer("public_geb", { mode: "boolean" }).notNull().default(false),
    publicQualifications: integer("public_qualifications", { mode: "boolean" }).notNull().default(true),
    publicAddress: integer("public_address", { mode: "boolean" }).notNull().default(false),
    publicContact: integer("public_contact", { mode: "boolean" }).notNull().default(false),

    // Optional per-user overrides for qualification-based hourly rates (cents per hour).
    // If set, these override the rates configured under Settings → Fees.
    hourlyRateQualRdCents: integer("hourly_rate_qual_rd_cents"),
    hourlyRateQualAusbCents: integer("hourly_rate_qual_ausb_cents"),
  },
  (table) => [
    uniqueIndex("users_username_unique").on(table.username),
    uniqueIndex("users_email_unique").on(table.email),
    index("users_role_idx").on(table.role),
    index("users_einsatzort_idx").on(table.einsatzort),
    index("users_qual_rd_idx").on(table.qualRD),
  ],
);

export const documents = sqliteTable(
  "documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    category: text("category", {
      enum: ["CV", "TRAINING", "CONTRACT"],
    }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    storageKey: text("storage_key").notNull(),
    sizeBytes: integer("size_bytes"),
  },
  (table) => [
    uniqueIndex("documents_storage_key_unique").on(table.storageKey),
    index("documents_owner_id_idx").on(table.ownerId),
    index("documents_owner_category_idx").on(table.ownerId, table.category),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  owner: one(users, { fields: [documents.ownerId], references: [users.id] }),
}));

export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    name: text("name").notNull(),

    mainBereich: text("main_bereich", {
      enum: ["RD_BOERSE", "SANITATSDIENST", "ERSTE_HILFE"],
    })
      .notNull()
      .default("RD_BOERSE"),

    contactName: text("contact_name").notNull().default(""),
    street: text("street").notNull().default(""),
    houseNumber: text("house_number").notNull().default(""),
    plz: text("plz").notNull().default(""),
    city: text("city").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),

    accountUserId: integer("account_user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [uniqueIndex("customers_name_unique").on(table.name)],
);

export const appointments = sqliteTable(
  "appointments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }),

    title: text("title").notNull(),
    einsatzort: text("einsatzort").notNull(),

    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),

    bereich: text("bereich", {
      enum: ["RD_BOERSE", "SANITATSDIENST", "ERSTE_HILFE"],
    }).notNull(),

    dienstart: text("dienstart", {
      enum: ["KTW", "NKTW", "RTW", "NEF", "ITW", "S_RTW", "SONSTIGES"],
    }),

    eventName: text("event_name").notNull().default(""),
    notes: text("notes").notNull().default(""),
    detailsJson: text("details_json").notNull().default("{}"),

    targetUserId: integer("target_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    staffingStatus: text("staffing_status", {
      enum: ["BESETZT", "UNBESETZT", "UNTERBESETZT"],
    })
      .notNull()
      .default("UNBESETZT"),

    approved: integer("approved", { mode: "boolean" }).notNull().default(true),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),

    state: text("state", {
      enum: ["OPEN", "CLOSED", "CANCELLED"],
    })
      .notNull()
      .default("OPEN"),
  },
  (table) => [
    index("appointments_start_at_idx").on(table.startAt),
    index("appointments_state_idx").on(table.state),
    index("appointments_staffing_status_idx").on(table.staffingStatus),
    index("appointments_target_user_id_idx").on(table.targetUserId),
    index("appointments_customer_id_idx").on(table.customerId),
    index("appointments_bereich_idx").on(table.bereich),
    index("appointments_dienstart_idx").on(table.dienstart),
  ],
);

export const appointmentRequirements = sqliteTable(
  "appointment_requirements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    appointmentId: integer("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),

    kind: text("kind", {
      enum: ["QUAL_RD", "QUAL_AUSB"],
    }).notNull(),

    value: text("value").notNull(),

    minCount: integer("min_count").notNull(),
  },
  (table) => [
    uniqueIndex("appointment_requirements_unique").on(table.appointmentId, table.kind, table.value),
    index("appointment_requirements_appointment_id_idx").on(table.appointmentId),
    index("appointment_requirements_kind_value_idx").on(table.kind, table.value),
  ],
);

export const appointmentApplications = sqliteTable(
  "appointment_applications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    appointmentId: integer("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    status: text("status", {
      enum: ["REPORTED", "CONFIRMED", "CANCELLED"],
    }).notNull(),

    role: text("role", { enum: ["NORMAL", "EL"] }).notNull().default("NORMAL"),
    adminNote: text("admin_note").notNull().default(""),
  },
  (table) => [
    uniqueIndex("appointment_applications_user_appointment_unique").on(
      table.userId,
      table.appointmentId,
    ),
    index("appointment_applications_user_id_idx").on(table.userId),
    index("appointment_applications_appointment_id_idx").on(table.appointmentId),
    index("appointment_applications_status_idx").on(table.status),
  ],
);

export const appointmentSections = sqliteTable(
  "appointment_sections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    appointmentId: integer("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("appointment_sections_appointment_id_idx").on(table.appointmentId),
    index("appointment_sections_sort_order_idx").on(table.sortOrder),
  ],
);

export const appointmentSectionMembers = sqliteTable(
  "appointment_section_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    sectionId: integer("section_id")
      .notNull()
      .references(() => appointmentSections.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("appointment_section_members_unique").on(table.sectionId, table.userId),
    index("appointment_section_members_section_id_idx").on(table.sectionId),
    index("appointment_section_members_user_id_idx").on(table.userId),
  ],
);

export const appointmentFiles = sqliteTable(
  "appointment_files",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    appointmentId: integer("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),

    fileName: text("file_name").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull().default("application/pdf"),
    sizeBytes: integer("size_bytes").notNull().default(0),
  },
  (table) => [
    index("appointment_files_appointment_id_idx").on(table.appointmentId),
    uniqueIndex("appointment_files_storage_key_unique").on(table.storageKey),
  ],
);

export const appointmentsRelations = relations(appointments, ({ many, one }) => ({
  applications: many(appointmentApplications),
  requirements: many(appointmentRequirements),
  targetUser: one(users, { fields: [appointments.targetUserId], references: [users.id] }),
  customer: one(customers, { fields: [appointments.customerId], references: [customers.id] }),
}));

export const appointmentApplicationsRelations = relations(appointmentApplications, ({ one }) => ({
  appointment: one(appointments, {
    fields: [appointmentApplications.appointmentId],
    references: [appointments.id],
  }),
  user: one(users, { fields: [appointmentApplications.userId], references: [users.id] }),
}));

export const appointmentSectionsRelations = relations(appointmentSections, ({ many, one }) => ({
  appointment: one(appointments, { fields: [appointmentSections.appointmentId], references: [appointments.id] }),
  members: many(appointmentSectionMembers),
}));

export const appointmentSectionMembersRelations = relations(appointmentSectionMembers, ({ one }) => ({
  section: one(appointmentSections, { fields: [appointmentSectionMembers.sectionId], references: [appointmentSections.id] }),
  user: one(users, { fields: [appointmentSectionMembers.userId], references: [users.id] }),
}));

export const appointmentRequirementsRelations = relations(appointmentRequirements, ({ one }) => ({
  appointment: one(appointments, {
    fields: [appointmentRequirements.appointmentId],
    references: [appointments.id],
  }),
}));

export const hourEntries = sqliteTable(
  "hour_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    appointmentId: integer("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),

    actualStartAt: integer("actual_start_at", { mode: "timestamp_ms" }).notNull(),
    actualEndAt: integer("actual_end_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("hour_entries_user_appointment_unique").on(table.userId, table.appointmentId),
    index("hour_entries_user_id_idx").on(table.userId),
    index("hour_entries_appointment_id_idx").on(table.appointmentId),
    index("hour_entries_actual_start_idx").on(table.actualStartAt),
  ],
);

export const timesheetMonths = sqliteTable(
  "timesheet_months",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(), // 1-12

    status: text("status", { enum: ["OPEN", "CLOSED"] })
      .notNull()
      .default("OPEN"),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("timesheet_months_user_year_month_unique").on(table.userId, table.year, table.month),
    index("timesheet_months_user_id_idx").on(table.userId),
  ],
);

export const timesheetEvents = sqliteTable(
  "timesheet_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(), // 1-12

    action: text("action", { enum: ["REOPEN"] }).notNull(),
    note: text("note"),

    actorUserId: integer("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => [
    index("timesheet_events_user_year_month_idx").on(table.userId, table.year, table.month),
    index("timesheet_events_actor_user_id_idx").on(table.actorUserId),
  ],
);

export const hourEntriesRelations = relations(hourEntries, ({ one }) => ({
  user: one(users, { fields: [hourEntries.userId], references: [users.id] }),
  appointment: one(appointments, { fields: [hourEntries.appointmentId], references: [appointments.id] }),
}));

export const timesheetMonthsRelations = relations(timesheetMonths, ({ one }) => ({
  user: one(users, { fields: [timesheetMonths.userId], references: [users.id] }),
}));

export const timesheetEventsRelations = relations(timesheetEvents, ({ one }) => ({
  user: one(users, { fields: [timesheetEvents.userId], references: [users.id] }),
  actorUser: one(users, { fields: [timesheetEvents.actorUserId], references: [users.id] }),
}));

export const notificationPrefs = sqliteTable(
  "notification_prefs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    key: text("key", {
      enum: [
        "NEW_SHIFT",
        "SHIFT_CHANGE",
        "URGENT_REQUESTS",
        "REQUESTS_GENERAL",
        "SHIFT_REMINDER",
        "TIMESHEET",
        "BIRTHDAY",
        "CUSTOMER_REQUEST",
        "CUSTOMER_SHIFT_RELEASED",
        "CUSTOMER_SHIFT_FILLED",
        "CUSTOMER_SHIFT_UNFILLED_2D",
      ],
    }).notNull(),

    telegramEnabled: integer("telegram_enabled", { mode: "boolean" }).notNull().default(false),
    emailEnabled: integer("email_enabled", { mode: "boolean" }).notNull().default(false),

    // only used for SHIFT_REMINDER
    reminderDaysBefore: integer("reminder_days_before"),
  },
  (table) => [
    uniqueIndex("notification_prefs_user_key_unique").on(table.userId, table.key),
    index("notification_prefs_user_id_idx").on(table.userId),
  ],
);

export const notificationPrefsRelations = relations(notificationPrefs, ({ one }) => ({
  user: one(users, { fields: [notificationPrefs.userId], references: [users.id] }),
}));

export const feeRates = sqliteTable(
  "fee_rates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    kind: text("kind", { enum: ["QUAL_RD", "QUAL_AUSB"] }).notNull(),
    value: text("value").notNull(),

    // cents per hour (nullable = not configured yet)
    hourlyRateCents: integer("hourly_rate_cents"),
  },
  (table) => [
    uniqueIndex("fee_rates_kind_value_unique").on(table.kind, table.value),
    index("fee_rates_kind_idx").on(table.kind),
  ],
);

export const smtpSettings = sqliteTable("smtp_settings", {
  id: integer("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  host: text("host").notNull().default(""),
  port: integer("port").notNull().default(587),
  username: text("username").notNull().default(""),
  password: text("password").notNull().default(""),
  fromEmail: text("from_email").notNull().default(""),
  secure: integer("secure", { mode: "boolean" }).notNull().default(false),
});

export const sftpSettings = sqliteTable("sftp_settings", {
  id: integer("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  host: text("host").notNull().default(""),
  port: integer("port").notNull().default(22),
  username: text("username").notNull().default(""),
  password: text("password").notNull().default(""),
  remotePath: text("remote_path").notNull().default("/"),
});

export const telegramSettings = sqliteTable("telegram_settings", {
  id: integer("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

  botToken: text("bot_token").notNull().default(""),
});

export const telegramChats = sqliteTable(
  "telegram_chats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    name: text("name").notNull().default(""),
    chatId: text("chat_id").notNull().default(""),
    inviteUrl: text("invite_url").notNull().default(""),
    kindsJson: text("kinds_json").notNull().default("[]"),
  },
  (table) => [index("telegram_chats_enabled_idx").on(table.enabled)],
);

export const prowlKeys = sqliteTable(
  "prowl_keys",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    label: text("label").notNull().default(""),
    apiKey: text("api_key").notNull().default(""),
  },
  (table) => [
    index("prowl_keys_user_id_idx").on(table.userId),
    index("prowl_keys_enabled_idx").on(table.enabled),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    scope: text("scope", { enum: ["ALL", "USER"] }).notNull().default("ALL"),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),

    kind: text("kind", {
      enum: [
        "NEW_SHIFT",
        "SHIFT_CHANGE",
        "URGENT_REQUESTS",
        "REQUESTS_GENERAL",
        "SHIFT_REMINDER",
        "TIMESHEET",
        "BIRTHDAY",
        "SYSTEM",
      ],
    })
      .notNull()
      .default("SYSTEM"),

    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    href: text("href").notNull().default(""),
  },
  (table) => [
    index("notifications_created_at_idx").on(table.createdAt),
    index("notifications_scope_idx").on(table.scope),
    index("notifications_user_id_idx").on(table.userId),
  ],
);

export const notificationReads = sqliteTable(
  "notification_reads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    notificationId: integer("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("notification_reads_user_notification_unique").on(table.userId, table.notificationId),
    index("notification_reads_user_id_idx").on(table.userId),
    index("notification_reads_notification_id_idx").on(table.notificationId),
  ],
);

export const prowlKeysRelations = relations(prowlKeys, ({ one }) => ({
  user: one(users, { fields: [prowlKeys.userId], references: [users.id] }),
}));

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
    index("password_reset_tokens_user_id_idx").on(table.userId),
    index("password_reset_tokens_expires_at_idx").on(table.expiresAt),
  ],
);

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const requirementPresets = sqliteTable(
  "requirement_presets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    name: text("name").notNull(),
    description: text("description").notNull().default(""),
  },
  (table) => [uniqueIndex("requirement_presets_name_unique").on(table.name)],
);

export const requirementPresetItems = sqliteTable(
  "requirement_preset_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    presetId: integer("preset_id")
      .notNull()
      .references(() => requirementPresets.id, { onDelete: "cascade" }),

    kind: text("kind", {
      enum: ["QUAL_RD", "QUAL_AUSB"],
    }).notNull(),

    value: text("value").notNull(),
    minCount: integer("min_count").notNull().default(1),
  },
  (table) => [
    index("requirement_preset_items_preset_id_idx").on(table.presetId),
    index("requirement_preset_items_kind_value_idx").on(table.kind, table.value),
  ],
);

export const requirementPresetsRelations = relations(requirementPresets, ({ many }) => ({
  items: many(requirementPresetItems),
}));

export const requirementPresetItemsRelations = relations(requirementPresetItems, ({ one }) => ({
  preset: one(requirementPresets, { fields: [requirementPresetItems.presetId], references: [requirementPresets.id] }),
}));

export const personalQuestionnaires = sqliteTable(
  "personal_questionnaires",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    kind: text("kind", { enum: ["HONORAR", "MINIJOB"] })
      .notNull()
      .default("HONORAR"),

    status: text("status", { enum: ["SUBMITTED", "REVIEWED", "APPROVED", "REJECTED"] })
      .notNull()
      .default("SUBMITTED"),

    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    geb: integer("geb", { mode: "timestamp_ms" }),
    taxNumber: text("tax_number").notNull().default(""),
    nationality: text("nationality").notNull().default(""),

    street: text("street").notNull().default(""),
    houseNumber: text("house_number").notNull().default(""),
    plz: text("plz").notNull().default(""),
    city: text("city").notNull().default(""),
    cityExtra: text("city_extra").notNull().default(""),

    phone: text("phone").notNull().default(""),
    phoneShare: integer("phone_share", { mode: "boolean" }).notNull().default(false),
    email: text("email").notNull().default(""),

    bankAccountHolder: text("bank_account_holder").notNull().default(""),
    bankAccountHolderDiffers: integer("bank_account_holder_differs", { mode: "boolean" })
      .notNull()
      .default(false),
    bankName: text("bank_name").notNull().default(""),
    iban: text("iban").notNull().default(""),
    blz: text("blz").notNull().default(""),

    einsatzfelderJson: text("einsatzfelder_json").notNull().default("[]"),
    qualMed: text("qual_med", {
      enum: [
        "ERSTHELFER",
        "SANITAETER",
        "RETTUNGSHELFER",
        "RETTUNGSSANITAETER",
        "RETTUNGSASSISTENT",
        "NOTFALLSANITAETER",
      ],
    }),
    qualEhAusbilder: integer("qual_eh_ausbilder", { mode: "boolean" }).notNull().default(false),

    sizesJson: text("sizes_json").notNull().default("{}"),
    hasNeutralPsa: integer("has_neutral_psa", { mode: "boolean" }).notNull().default(false),

    driverLicencesJson: text("driver_licences_json").notNull().default("[]"),
    hasPss: integer("has_pss", { mode: "boolean" }).notNull().default(false),
    ownCar: integer("own_car", { mode: "boolean" }).notNull().default(false),

    contactPrefsJson: text("contact_prefs_json").notNull().default("[]"),

    rawJson: text("raw_json").notNull().default("{}"),

    // MINIJOB-specific additions
    socialSecurityNumber: text("social_security_number").notNull().default(""),
    taxId: text("tax_id").notNull().default(""),
    healthInsurance: text("health_insurance").notNull().default(""),
    insuranceStatus: text("insurance_status").notNull().default(""),
    maritalStatus: text("marital_status").notNull().default(""),
    hasChildren: integer("has_children", { mode: "boolean" }).notNull().default(false),
    childrenCount: integer("children_count"),

    employmentStatusJson: text("employment_status_json").notNull().default("[]"),
    employmentStatusOther: text("employment_status_other").notNull().default(""),

    hasMainJob: integer("has_main_job", { mode: "boolean" }).notNull().default(false),
    mainJobEmployer: text("main_job_employer").notNull().default(""),

    hasOtherMinijobs: integer("has_other_minijobs", { mode: "boolean" }).notNull().default(false),
    otherMinijobsCount: integer("other_minijobs_count"),
    otherMinijobsEmployers: text("other_minijobs_employers").notNull().default(""),

    pensionChoice: text("pension_choice").notNull().default(""),

    taxClass: text("tax_class").notNull().default(""),
    confession: text("confession").notNull().default(""),

    createdUserId: integer("created_user_id"),
    createdUsername: text("created_username").notNull().default(""),
    createdUserAt: integer("created_user_at", { mode: "timestamp_ms" }),

    adminNotes: text("admin_notes").notNull().default(""),
  },
  (table) => [
    index("personal_questionnaires_kind_idx").on(table.kind),
    index("personal_questionnaires_status_idx").on(table.status),
    index("personal_questionnaires_created_at_idx").on(table.createdAt),
    index("personal_questionnaires_email_idx").on(table.email),
    index("personal_questionnaires_created_user_id_idx").on(table.createdUserId),
  ],
);

export const blogPosts = sqliteTable(
  "blog_posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    status: text("status", { enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] })
      .notNull()
      .default("DRAFT"),

    title: text("title").notNull().default(""),
    category: text("category").notNull().default("allgemein"),
    slug: text("slug").notNull().default(""),
    excerpt: text("excerpt").notNull().default(""),
    contentMd: text("content_md").notNull().default(""),
    contentBlocksJson: text("content_blocks_json").notNull().default("[]"),

    titleImageKey: text("title_image_key").notNull().default(""),

    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("blog_posts_status_idx").on(table.status),
    index("blog_posts_category_idx").on(table.category),
    index("blog_posts_published_at_idx").on(table.publishedAt),
    uniqueIndex("blog_posts_category_slug_unique").on(table.category, table.slug),
  ],
);

export const blogAssets = sqliteTable(
  "blog_assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    postId: integer("post_id")
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),

    kind: text("kind", { enum: ["TITLE", "INLINE"] }).notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    storageKey: text("storage_key").notNull(),
    sizeBytes: integer("size_bytes"),
    width: integer("width"),
    height: integer("height"),
  },
  (table) => [
    uniqueIndex("blog_assets_storage_key_unique").on(table.storageKey),
    index("blog_assets_post_id_idx").on(table.postId),
    index("blog_assets_kind_idx").on(table.kind),
  ],
);

export const blogMedia = sqliteTable(
  "blog_media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    storageKey: text("storage_key").notNull(),
    sizeBytes: integer("size_bytes"),
    width: integer("width"),
    height: integer("height"),
  },
  (table) => [
    uniqueIndex("blog_media_storage_key_unique").on(table.storageKey),
    index("blog_media_created_at_idx").on(table.createdAt),
  ],
);

export const blogPostsRelations = relations(blogPosts, ({ many }) => ({
  assets: many(blogAssets),
}));

export const blogAssetsRelations = relations(blogAssets, ({ one }) => ({
  post: one(blogPosts, { fields: [blogAssets.postId], references: [blogPosts.id] }),
}));

export const contactInquiries = sqliteTable(
  "contact_inquiries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),

    status: text("status", { enum: ["NEW", "DONE"] }).notNull().default("NEW"),
    source: text("source").notNull().default("website"),
    sourceUrl: text("source_url").notNull().default(""),
    ip: text("ip").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    recaptchaScoreBp: integer("recaptcha_score_bp"),
    recaptchaAction: text("recaptcha_action").notNull().default(""),

    mode: text("mode").notNull().default("kontakt"),
    name: text("name").notNull().default(""),
    company: text("company").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    message: text("message").notNull().default(""),
    detailsJson: text("details_json").notNull().default("{}"),

    privacyConsent: integer("privacy_consent", { mode: "boolean" }).notNull().default(false),
    privacyConsentAt: integer("privacy_consent_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("contact_inquiries_created_at_idx").on(table.createdAt),
    index("contact_inquiries_read_at_idx").on(table.readAt),
    index("contact_inquiries_deleted_at_idx").on(table.deletedAt),
    index("contact_inquiries_status_idx").on(table.status),
    index("contact_inquiries_email_idx").on(table.email),
  ],
);

export const personalQuestionnaireFiles = sqliteTable(
  "personal_questionnaire_files",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    questionnaireId: integer("questionnaire_id")
      .notNull()
      .references(() => personalQuestionnaires.id, { onDelete: "cascade" }),

    kind: text("kind", {
      enum: [
        "ZEUGNIS_MED",
        "FORTBILDUNG_RD",
        "ARBEITSMED",
        "FUEHRUNGSKRAEFTE",
        "AUSBILDER_QUAL",
        "SONSTIGE",
        "FUEHRERSCHEIN",
        "PSS",
      ],
    }).notNull(),

    fileName: text("file_name").notNull(),
    originalName: text("original_name").notNull().default(""),
    mimeType: text("mime_type"),
    storageKey: text("storage_key").notNull(),
    sizeBytes: integer("size_bytes"),
  },
  (table) => [
    uniqueIndex("personal_questionnaire_files_storage_key_unique").on(table.storageKey),
    index("personal_questionnaire_files_questionnaire_id_idx").on(table.questionnaireId),
    index("personal_questionnaire_files_kind_idx").on(table.kind),
  ],
);

export const personalQuestionnairesRelations = relations(personalQuestionnaires, ({ many }) => ({
  files: many(personalQuestionnaireFiles),
}));

export const personalQuestionnaireFilesRelations = relations(personalQuestionnaireFiles, ({ one }) => ({
  questionnaire: one(personalQuestionnaires, {
    fields: [personalQuestionnaireFiles.questionnaireId],
    references: [personalQuestionnaires.id],
  }),
}));
