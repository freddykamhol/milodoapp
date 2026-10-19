import { relations, sql } from "drizzle-orm";
import { blob, check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const epochMsNow = sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`;
export const courseMaterials=sqliteTable('course_materials',{id:integer('id').primaryKey({autoIncrement:true}),appointmentId:integer('appointment_id').notNull().references(()=>appointments.id,{onDelete:'cascade'}),itemId:integer('item_id').references(()=>inventoryItems.id,{onDelete:'set null'}),name:text('name').notNull(),inventoryNumber:text('inventory_number').notNull(),quantity:integer('quantity').notNull()},t=>[uniqueIndex('course_materials_item_idx').on(t.appointmentId,t.itemId)]);

export const courseParticipants=sqliteTable('course_participants',{
 id:integer('id').primaryKey({autoIncrement:true}),appointmentId:integer('appointment_id').notNull().references(()=>appointments.id,{onDelete:'cascade'}),
 firstName:text('first_name').notNull(),lastName:text('last_name').notNull(),dateOfBirth:text('date_of_birth').notNull(),identityKey:text('identity_key').notNull(),
 present:integer('present',{mode:'boolean'}).notNull().default(false),source:text('source',{enum:['INTERNAL','EXTERNAL']}).notNull().default('INTERNAL'),
 createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull(),updatedById:integer('updated_by_id').references(()=>users.id,{onDelete:'set null'}),
},t=>[uniqueIndex('course_participants_identity_idx').on(t.appointmentId,t.identityKey),index('course_participants_appointment_idx').on(t.appointmentId,t.lastName,t.firstName)]);

export const defectAppointments = sqliteTable("defect_appointments", {
 id:integer("id").primaryKey({autoIncrement:true}),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).notNull(),
 vehicleDefectId:integer("vehicle_defect_id").references(()=>vehicleDefects.id,{onDelete:"cascade"}),inventoryDefectId:integer("inventory_defect_id").references(()=>inventoryDefects.id,{onDelete:"cascade"}),
 companyId:integer("company_id").references(()=>vehicleServiceCompanies.id,{onDelete:"set null"}),companyName:text("company_name").notNull().default(""),
 title:text("title").notNull(),description:text("description").notNull().default(""),location:text("location").notNull().default(""),
 startAt:integer("start_at",{mode:"timestamp_ms"}).notNull(),endAt:integer("end_at",{mode:"timestamp_ms"}),createdById:integer("created_by_id").references(()=>users.id,{onDelete:"set null"}),
},t=>[index("defect_appointments_vehicle_defect_idx").on(t.vehicleDefectId,t.startAt),index("defect_appointments_inventory_defect_idx").on(t.inventoryDefectId,t.startAt),index("defect_appointments_start_idx").on(t.startAt),check("defect_appointments_single_defect",sql`(${t.vehicleDefectId} is not null and ${t.inventoryDefectId} is null) or (${t.vehicleDefectId} is null and ${t.inventoryDefectId} is not null)`),check("defect_appointments_end_after_start",sql`${t.endAt} is null or ${t.endAt} > ${t.startAt}`)]);

export const messageJobs = sqliteTable("message_jobs", {
 id:integer("id").primaryKey({autoIncrement:true}), createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull(),
 createdById:integer("created_by_id").notNull().references(()=>users.id,{onDelete:"restrict"}), clientToken:text("client_token").notNull(),
 subject:text("subject").notNull(), body:text("body").notNull(), selectionJson:text("selection_json").notNull(),
 scheduledAt:integer("scheduled_at",{mode:"timestamp_ms"}).notNull(), status:text("status").notNull().default("QUEUED"),
},t=>[uniqueIndex("message_jobs_sender_token_idx").on(t.createdById,t.clientToken),index("message_jobs_due_idx").on(t.status,t.scheduledAt)]);
export const messageDeliveries = sqliteTable("message_deliveries", {
 id:integer("id").primaryKey({autoIncrement:true}),jobId:integer("job_id").notNull().references(()=>messageJobs.id,{onDelete:"cascade"}),
 email:text("email").notNull(),status:text("status").notNull().default("PENDING"),claimedAt:integer("claimed_at",{mode:"timestamp_ms"}),claimToken:text("claim_token"),sentAt:integer("sent_at",{mode:"timestamp_ms"}),error:text("error"),
},t=>[uniqueIndex("message_deliveries_job_email_idx").on(t.jobId,t.email),index("message_deliveries_job_status_idx").on(t.jobId,t.status)]);
export const messageAttachments = sqliteTable("message_attachments", {
 id:integer("id").primaryKey({autoIncrement:true}),jobId:integer("job_id").notNull().references(()=>messageJobs.id,{onDelete:"cascade"}),
 name:text("name").notNull(),mimeType:text("mime_type").notNull(),sizeBytes:integer("size_bytes").notNull(),content:blob("content",{mode:"buffer"}).notNull(),
},t=>[index("message_attachments_job_idx").on(t.jobId)]);

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
    contractType: text("contract_type", { enum: ["GFB", "HONORAR"] }),

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
    inquiryServiceTypes: text("inquiry_service_types"),

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

export const vehicles = sqliteTable(
  "vehicles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    licensePlate: text("license_plate").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    type: text("type", { enum: ["PKW", "MTW", "KTW", "RTW", "S-KTW-S-RTW", "ITW", "NEF", "LKW", "SONSTIGE"] }).notNull(),
    initialMileage: integer("initial_mileage").notNull().default(0),
    mileage: integer("mileage").notNull().default(0),
    location: text("location").notNull().default(""),
    tuvLastAt: integer("tuv_last_at", { mode: "timestamp_ms" }),
    notes: text("notes").notNull().default(""),
  },
  (table) => [uniqueIndex("vehicles_license_plate_unique").on(table.licensePlate)],
);

export const vehicleDefects = sqliteTable(
  "vehicle_defects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: text("category", { enum: ["ELEKTRIK", "AUFBAU", "FAHRGESTELL", "MOTOR_GETRIEBE"] }).notNull(),
    status: text("status", { enum: ["ERSTELLT", "IN_BEARBEITUNG", "BEHOBEN"] }).notNull().default("ERSTELLT"),
    mileage: integer("mileage").notNull().default(0),
    imageUrls: text("image_urls").notNull().default("[]"),
    reportedById: integer("reported_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => [index("vehicle_defects_vehicle_id_idx").on(table.vehicleId), index("vehicle_defects_status_idx").on(table.status), index("vehicle_defects_created_idx").on(table.createdAt)],
);

export const vehicleTrips = sqliteTable(
  "vehicle_trips",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    kmStart: integer("km_start").notNull(),
    kmEnd: integer("km_end").notNull(),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    appointmentId: integer("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    createdById: integer("created_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => [index("vehicle_trips_vehicle_id_idx").on(table.vehicleId), index("vehicle_trips_start_at_idx").on(table.startAt), index("vehicle_trips_vehicle_start_idx").on(table.vehicleId, table.startAt)],
);

export const vehicleMaintenances = sqliteTable(
  "vehicle_maintenances",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    lastAt: integer("last_at", { mode: "timestamp_ms" }).notNull(),
    intervalDays: integer("interval_days").notNull().default(0),
    nextAt: integer("next_at", { mode: "timestamp_ms" }).notNull(),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("vehicle_maintenances_vehicle_id_idx").on(table.vehicleId)],
);

export const vehicleServiceCompanies = sqliteTable(
  "vehicle_service_companies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    name: text("name").notNull(),
    address: text("address").notNull().default(""),
    street: text("street").notNull().default(""),
    postalCode: text("postal_code").notNull().default(""),
    city: text("city").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    contactPerson: text("contact_person").notNull().default(""),
  },
  (table) => [uniqueIndex("vehicle_service_companies_name_unique").on(table.name)],
);

export const vehicleMaintenanceAppointments = sqliteTable(
  "vehicle_maintenance_appointments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    maintenanceId: integer("maintenance_id").references(() => vehicleMaintenances.id, { onDelete: "cascade" }),
    companyId: integer("company_id").references(() => vehicleServiceCompanies.id, { onDelete: "set null" }),
    companyName: text("company_name").notNull(),
    address: text("address").notNull().default(""),
    title: text("title").notNull(),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }),
    createdById: integer("created_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => [index("vehicle_maintenance_appointments_start_at_idx").on(table.startAt), index("vehicle_maintenance_appointments_vehicle_id_idx").on(table.vehicleId)],
);

export const inventoryItems = sqliteTable(
  "inventory_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    inventoryNumber: text("inventory_number"),
    name: text("name").notNull(),
    category: text("category", { enum: ["MEDICAL_DEVICE", "CONSUMABLE", "BAG", "OXYGEN", "OTHER"] }).notNull(),
    status: text("status", { enum: ["ACTIVE", "OUT_OF_SERVICE", "RETIRED"] }).notNull().default("ACTIVE"),
    quantity: integer("quantity").notNull().default(0),
    minimumQuantity: integer("minimum_quantity").notNull().default(0),
    unit: text("unit").notNull().default("Stück"),
    location: text("location").notNull().default(""),
    manufacturer: text("manufacturer").notNull().default(""),
    model: text("model").notNull().default(""),
    serialNumber: text("serial_number").notNull().default(""),
    lotNumber: text("lot_number").notNull().default(""),
    expiryAt: integer("expiry_at", { mode: "timestamp_ms" }),
    inspectionIntervalDays: integer("inspection_interval_days").notNull().default(0),
    lastInspectionAt: integer("last_inspection_at", { mode: "timestamp_ms" }),
    nextInspectionAt: integer("next_inspection_at", { mode: "timestamp_ms" }),
    medicalDeviceClass: text("medical_device_class").notNull().default(""),
    udi: text("udi").notNull().default(""),
    commissionedAt: integer("commissioned_at", { mode: "timestamp_ms" }),
    oxygenCapacityLiters: integer("oxygen_capacity_liters"),
    oxygenPressureBar: integer("oxygen_pressure_bar"),
    oxygenContentPercent: integer("oxygen_content_percent"),
    notes: text("notes").notNull().default(""),
  },
  (table) => [
    uniqueIndex("inventory_items_inventory_number_unique").on(table.inventoryNumber),
    index("inventory_items_category_idx").on(table.category), index("inventory_items_name_idx").on(table.name),
    index("inventory_items_status_idx").on(table.status),
    index("inventory_items_expiry_idx").on(table.expiryAt),
    index("inventory_items_inspection_idx").on(table.nextInspectionAt),
  ],
);

export const inventoryMovements = sqliteTable(
  "inventory_movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    itemId: integer("item_id").notNull().references(() => inventoryItems.id, { onDelete: "cascade" }),
    movementType: text("movement_type", { enum: ["IN", "OUT", "ADJUST"] }).notNull(),
    quantityChange: integer("quantity_change").notNull(),
    quantityAfter: integer("quantity_after").notNull(),
    reason: text("reason").notNull(),
    reference: text("reference").notNull().default(""),
    actorId: integer("actor_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => [index("inventory_movements_item_id_idx").on(table.itemId), index("inventory_movements_item_created_idx").on(table.itemId, table.createdAt), index("inventory_movements_created_at_idx").on(table.createdAt)],
);

export const inventoryInspections = sqliteTable(
  "inventory_inspections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    itemId: integer("item_id").notNull().references(() => inventoryItems.id, { onDelete: "cascade" }),
    result: text("result", { enum: ["PASSED", "FAILED", "REPAIR_REQUIRED"] }).notNull(),
    performedAt: integer("performed_at", { mode: "timestamp_ms" }).notNull(),
    nextDueAt: integer("next_due_at", { mode: "timestamp_ms" }),
    notes: text("notes").notNull().default(""),
    performedById: integer("performed_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => [index("inventory_inspections_item_id_idx").on(table.itemId), index("inventory_inspections_item_performed_idx").on(table.itemId, table.performedAt), index("inventory_inspections_performed_at_idx").on(table.performedAt)],
);

export const inventoryDefects = sqliteTable(
  "inventory_defects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    itemId: integer("item_id").notNull().references(() => inventoryItems.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    imageUrls: text("image_urls").notNull().default("[]"),
    status: text("status", { enum: ["ERSTELLT", "IN_BEARBEITUNG", "BEHOBEN"] }).notNull().default("ERSTELLT"),
    reportedById: integer("reported_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => [index("inventory_defects_item_id_idx").on(table.itemId), index("inventory_defects_status_idx").on(table.status), index("inventory_defects_created_idx").on(table.createdAt)],
);

export const appointmentVehicles = sqliteTable(
  "appointment_vehicles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    appointmentId: integer("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
    vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [uniqueIndex("appointment_vehicles_unique").on(table.appointmentId, table.vehicleId), index("appointment_vehicles_appointment_id_idx").on(table.appointmentId), index("appointment_vehicles_vehicle_appointment_idx").on(table.vehicleId, table.appointmentId)],
);

export const appointmentVehicleMembers = sqliteTable(
  "appointment_vehicle_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    appointmentVehicleId: integer("appointment_vehicle_id").notNull().references(() => appointmentVehicles.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("appointment_vehicle_members_unique").on(table.appointmentVehicleId, table.userId), index("appointment_vehicle_members_vehicle_idx").on(table.appointmentVehicleId)],
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
      enum: ["CV", "TRAINING", "DRIVER_LICENSE", "QUALIFICATION", "CONTRACT"],
    }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    expiryReminderSentAt: integer("expiry_reminder_sent_at", { mode: "timestamp_ms" }),
    expiredReminderSentAt: integer("expired_reminder_sent_at", { mode: "timestamp_ms" }),
    ownerExpiryReminderSentAt: integer("owner_expiry_reminder_sent_at", { mode: "timestamp_ms" }),
    ownerExpiredReminderSentAt: integer("owner_expired_reminder_sent_at", { mode: "timestamp_ms" }),
    requestedExpiresAt: integer("requested_expires_at", { mode: "timestamp_ms" }),
    expiryApprovalStatus: text("expiry_approval_status", { enum: ["NONE", "PENDING", "APPROVED"] }).notNull().default("NONE"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    storageKey: text("storage_key").notNull(),
    sizeBytes: integer("size_bytes"),
  },
  (table) => [
    uniqueIndex("documents_storage_key_unique").on(table.storageKey),
    index("documents_owner_id_idx").on(table.ownerId), index("documents_owner_created_idx").on(table.ownerId, table.createdAt),
    index("documents_owner_category_idx").on(table.ownerId, table.category),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  owner: one(users, { fields: [documents.ownerId], references: [users.id] }),
}));

export const documentExpirySettings = sqliteTable(
  "document_expiry_settings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    category: text("category", {
      enum: ["TRAINING", "DRIVER_LICENSE", "QUALIFICATION"],
    }).notNull(),
    expiryMonths: integer("expiry_months").notNull().default(0),
    reminderDaysBefore: integer("reminder_days_before").notNull().default(0),
  },
  (table) => [uniqueIndex("document_expiry_settings_category_unique").on(table.category)],
);

export const documentExpiryPreferences = sqliteTable("document_expiry_preferences", {
  id: integer("id").primaryKey(),
  manualExpiryRequiresApproval: integer("manual_expiry_requires_approval", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
});

export const documentExpiryRecipients = sqliteTable(
  "document_expiry_recipients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    category: text("category", { enum: ["TRAINING", "DRIVER_LICENSE", "QUALIFICATION"] }).notNull(),
    recipientType: text("recipient_type", { enum: ["ROLE", "USER", "EMAIL"] }).notNull(),
    role: text("role", { enum: ["ADMIN", "VERWALTUNG", "PERSONAL", "KUNDE"] }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email"),
    originCategory: text("origin_category", { enum: ["TRAINING", "DRIVER_LICENSE", "QUALIFICATION"] }),
  },
  (table) => [
    index("document_expiry_recipients_category_idx").on(table.category),
    uniqueIndex("document_expiry_recipients_unique").on(table.category, table.recipientType, table.role, table.userId, table.email),
  ],
);

export const memberRegistrationForms = sqliteTable(
  "member_registration_forms",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    token: text("token").notNull(),
    title: text("title").notNull().default("Registrierungsformular"),
    userLimit: integer("user_limit").notNull(),
    role: text("role", {
      enum: ["ADMIN", "VERWALTUNG", "PERSONAL"],
    })
      .notNull()
      .default("PERSONAL"),
    verificationMode: text("verification_mode", {
      enum: ["ADMIN", "PASSWORD"],
    })
      .notNull()
      .default("ADMIN"),
    passwordMode: text("password_mode", {
      enum: ["SELF", "GENERATED"],
    })
      .notNull()
      .default("SELF"),
    verificationPasswordHash: text("verification_password_hash"),
    verificationPasswordSecret: text("verification_password_secret"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),

    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("member_registration_forms_token_unique").on(table.token),
    index("member_registration_forms_expires_at_idx").on(table.expiresAt),
    index("member_registration_forms_active_idx").on(table.active),
  ],
);

export const memberRegistrationSubmissions = sqliteTable(
  "member_registration_submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),

    formId: integer("form_id")
      .notNull()
      .references(() => memberRegistrationForms.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    status: text("status", {
      enum: ["PENDING", "APPROVED"],
    })
      .notNull()
      .default("PENDING"),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    approvedById: integer("approved_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("member_registration_submissions_user_unique").on(table.userId),
    index("member_registration_submissions_form_id_idx").on(table.formId),
    index("member_registration_submissions_status_idx").on(table.status),
  ],
);

export const memberRegistrationFormsRelations = relations(memberRegistrationForms, ({ many, one }) => ({
  createdBy: one(users, { fields: [memberRegistrationForms.createdById], references: [users.id] }),
  submissions: many(memberRegistrationSubmissions),
}));

export const memberRegistrationSubmissionsRelations = relations(memberRegistrationSubmissions, ({ one }) => ({
  form: one(memberRegistrationForms, {
    fields: [memberRegistrationSubmissions.formId],
    references: [memberRegistrationForms.id],
  }),
  user: one(users, { fields: [memberRegistrationSubmissions.userId], references: [users.id] }),
  approvedBy: one(users, { fields: [memberRegistrationSubmissions.approvedById], references: [users.id] }),
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
  (table) => [uniqueIndex("customers_name_unique").on(table.name), index("customers_account_user_idx").on(table.accountUserId)],
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
    courseType:text('course_type'),
    courseParticipantLimit:integer('course_participant_limit'),
    courseRegistrationHash:text('course_registration_hash'),
    courseRegistrationExpiresAt:integer('course_registration_expires_at',{mode:'timestamp_ms'}),
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
    index("appointments_start_at_idx").on(table.startAt), index("appointments_state_start_idx").on(table.state, table.startAt), index("appointments_customer_state_start_idx").on(table.customerId, table.state, table.startAt),
    uniqueIndex('appointments_course_registration_idx').on(table.courseRegistrationHash),
    index("appointments_state_idx").on(table.state),
    index("appointments_staffing_status_idx").on(table.staffingStatus),
    index("appointments_target_user_id_idx").on(table.targetUserId),
    index("appointments_customer_id_idx").on(table.customerId),
    index("appointments_bereich_idx").on(table.bereich),
    index("appointments_dienstart_idx").on(table.dienstart),
  ],
);

export const courseRegistrationLinks = sqliteTable(
  "course_registration_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appointmentId: integer("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [uniqueIndex("course_registration_links_token_idx").on(table.tokenHash), index("course_registration_links_appointment_idx").on(table.appointmentId)],
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
    index("appointment_applications_status_idx").on(table.status), index("appointment_applications_user_status_appointment_idx").on(table.userId, table.status, table.appointmentId), index("appointment_applications_appointment_status_idx").on(table.appointmentId, table.status),
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
    index("notifications_scope_idx").on(table.scope), index("notifications_scope_user_created_idx").on(table.scope, table.userId, table.createdAt),
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

export const calendarCategoryColors = sqliteTable("calendar_category_colors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category").notNull(),
  color: text("color").notNull().default("#0878F9"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
}, (table) => [uniqueIndex("calendar_category_colors_category_unique").on(table.category)]);

export const rolePermissions = sqliteTable("role_permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  role: text("role", { enum: ["ADMIN", "VERWALTUNG", "PERSONAL", "KUNDE"] }).notNull(),
  permission: text("permission").notNull(),
  canView: integer("can_view", { mode: "boolean" }).notNull().default(false),
  canManage: integer("can_manage", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
}, (table) => [uniqueIndex("role_permissions_role_permission_unique").on(table.role, table.permission)]);

export const responsibilityAssignments = sqliteTable("responsibility_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["VEHICLE", "MATERIAL"] }).notNull(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  address: text("address").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
}, (table) => [uniqueIndex("responsibility_assignments_type_user_unique").on(table.type, table.userId), index("responsibility_assignments_type_idx").on(table.type)]);

export const responsibilityRecipients = sqliteTable("responsibility_recipients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["VEHICLE", "MATERIAL"] }).notNull(),
  recipientType: text("recipient_type", { enum: ["ROLE", "USER", "EMAIL"] }).notNull(),
  role: text("role", { enum: ["ADMIN", "VERWALTUNG", "PERSONAL", "KUNDE"] }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email"),
  location: text("location").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
}, (table) => [uniqueIndex("responsibility_recipients_unique").on(table.type, table.recipientType, table.role, table.userId, table.email)]);

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
    index("contact_inquiries_deleted_at_idx").on(table.deletedAt), index("contact_inquiries_deleted_created_idx").on(table.deletedAt, table.createdAt),
    index("contact_inquiries_status_idx").on(table.status),
    index("contact_inquiries_email_idx").on(table.email),
  ],
);

export const contactInquiryRecipients = sqliteTable(
  "contact_inquiry_recipients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(epochMsNow),
    mode: text("mode", { enum: ["eh", "notfall", "sanitaet", "boerse", "kontakt"] }).notNull(),
    originMode: text("origin_mode", { enum: ["eh", "notfall", "sanitaet", "boerse", "kontakt"] }),
    recipientType: text("recipient_type", { enum: ["ROLE", "USER", "EMAIL"] }).notNull(),
    role: text("role", { enum: ["ADMIN", "VERWALTUNG", "PERSONAL", "KUNDE"] }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email"),
  },
  (table) => [
    index("contact_inquiry_recipients_mode_idx").on(table.mode),
    uniqueIndex("contact_inquiry_recipients_unique").on(table.mode, table.recipientType, table.role, table.userId, table.email),
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
