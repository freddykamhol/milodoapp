import {loadDefectAppointments} from "./defect-appointments";
import {and,desc,eq,isNotNull,ne,or,sql} from "drizzle-orm";
import {db} from "./db";
import {inventoryDefects,inventoryInspections,inventoryItems,inventoryMovements,users,vehicles} from "@/db/schema";
import {toWire} from "./wire";
import {assetManager,AssetValidationError,inventoryPrefixes} from "./asset-validation";
import type {InventoryDetailData} from "./asset-types";

const listColumns={id:inventoryItems.id,name:inventoryItems.name,category:inventoryItems.category,inventoryNumber:inventoryItems.inventoryNumber,quantity:inventoryItems.quantity,minimumQuantity:inventoryItems.minimumQuantity,unit:inventoryItems.unit,location:inventoryItems.location,status:inventoryItems.status,nextInspectionAt:inventoryItems.nextInspectionAt,expiryAt:inventoryItems.expiryAt,oxygenCapacityLiters:inventoryItems.oxygenCapacityLiters};
export async function loadInventoryFeed(view="items",category:string|null=null){
 if(view==="movements")return toWire({movements:await db.select({movement:inventoryMovements,itemName:inventoryItems.name,inventoryNumber:inventoryItems.inventoryNumber}).from(inventoryMovements).innerJoin(inventoryItems,eq(inventoryMovements.itemId,inventoryItems.id)).orderBy(desc(inventoryMovements.createdAt)).limit(300)});
 if(view==="inspections"){
  const [inspections,schedule]=await Promise.all([
   db.select({inspection:inventoryInspections,itemName:inventoryItems.name,inventoryNumber:inventoryItems.inventoryNumber,username:users.username}).from(inventoryInspections).innerJoin(inventoryItems,eq(inventoryInspections.itemId,inventoryItems.id)).innerJoin(users,eq(inventoryInspections.performedById,users.id)).orderBy(desc(inventoryInspections.performedAt)).limit(300),
   db.select(listColumns).from(inventoryItems).where(and(eq(inventoryItems.category,"MEDICAL_DEVICE"),ne(inventoryItems.status,"RETIRED"),isNotNull(inventoryItems.nextInspectionAt))).orderBy(inventoryItems.nextInspectionAt),
  ]);return toWire({inspections,schedule});
 }
 if(view==="defects")return toWire({defects:await db.select({defect:{id:inventoryDefects.id,itemId:inventoryDefects.itemId,title:inventoryDefects.title,status:inventoryDefects.status,createdAt:inventoryDefects.createdAt},itemName:inventoryItems.name,inventoryNumber:inventoryItems.inventoryNumber,username:users.username}).from(inventoryDefects).innerJoin(inventoryItems,eq(inventoryDefects.itemId,inventoryItems.id)).innerJoin(users,eq(inventoryDefects.reportedById,users.id)).orderBy(desc(inventoryDefects.createdAt)).limit(300)});
 if(category&&![...Object.keys(inventoryPrefixes),"OXYGEN"].includes(category))throw new AssetValidationError("Ungültige Kategorie.");
 const categoryFilter=category==="CONSUMABLE"?or(eq(inventoryItems.category,"CONSUMABLE"),eq(inventoryItems.category,"OXYGEN")):category?eq(inventoryItems.category,category as never):undefined;
 const items=await db.select(listColumns).from(inventoryItems).where(and(ne(inventoryItems.status,"RETIRED"),categoryFilter)).orderBy(inventoryItems.name).limit(500);
 const [movements,summary]=await Promise.all([
  db.select({movement:inventoryMovements,itemName:inventoryItems.name}).from(inventoryMovements).innerJoin(inventoryItems,eq(inventoryMovements.itemId,inventoryItems.id)).orderBy(desc(inventoryMovements.createdAt)).limit(12),
  db.select({
   lowStock:sql<number>`coalesce(sum(case when category in ('CONSUMABLE','OXYGEN') and quantity<=minimum_quantity then 1 else 0 end),0)`,
   dueInspections:sql<number>`coalesce(sum(case when next_inspection_at<cast((julianday('now')-2440587.5)*86400000 as integer) then 1 else 0 end),0)`,
   expired:sql<number>`coalesce(sum(case when expiry_at<cast((julianday('now')-2440587.5)*86400000 as integer) then 1 else 0 end),0)`,
  }).from(inventoryItems).where(eq(inventoryItems.status,"ACTIVE")),
 ]);
 return toWire({items,movements,summary:summary[0]});
}

export async function loadInventoryDetail(itemId:number,role:string):Promise<InventoryDetailData|null>{
 const item=await db.query.inventoryItems.findFirst({where:(t,{eq})=>eq(t.id,itemId)});if(!item)return null;
 const canManage=assetManager(role);
 const [movements,inspections,defects,vehicleOptions,defectAppointments]=await Promise.all([
  db.select({movement:inventoryMovements,username:users.username}).from(inventoryMovements).innerJoin(users,eq(inventoryMovements.actorId,users.id)).where(eq(inventoryMovements.itemId,itemId)).orderBy(desc(inventoryMovements.createdAt)).limit(100),
  db.select({inspection:inventoryInspections,username:users.username}).from(inventoryInspections).innerJoin(users,eq(inventoryInspections.performedById,users.id)).where(eq(inventoryInspections.itemId,itemId)).orderBy(desc(inventoryInspections.performedAt)).limit(100),
  db.select({defect:{id:inventoryDefects.id,title:inventoryDefects.title,description:inventoryDefects.description,status:inventoryDefects.status,createdAt:inventoryDefects.createdAt},username:users.username}).from(inventoryDefects).innerJoin(users,eq(inventoryDefects.reportedById,users.id)).where(eq(inventoryDefects.itemId,itemId)).orderBy(desc(inventoryDefects.createdAt)),
  canManage&&(item.category==="MEDICAL_DEVICE"||item.category==="BAG")?db.select({id:vehicles.id,licensePlate:vehicles.licensePlate,type:vehicles.type}).from(vehicles).where(eq(vehicles.isActive,true)).orderBy(vehicles.licensePlate):[],
  item.category==="MEDICAL_DEVICE"?loadDefectAppointments({domain:"inventory",assetId:itemId}):[],
 ]);
 return toWire({item,movements,inspections,defects,vehicleOptions,defectAppointments,canManage});
}
