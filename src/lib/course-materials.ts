import {eq} from 'drizzle-orm';
import {db} from './db';
import {inventoryItems} from '@/db/schema';
import {CourseError} from './courses';
export async function loadCourseMaterialOptions(){return db.select({id:inventoryItems.id,name:inventoryItems.name,inventoryNumber:inventoryItems.inventoryNumber,quantity:inventoryItems.quantity,unit:inventoryItems.unit,category:inventoryItems.category}).from(inventoryItems).where(eq(inventoryItems.status,'ACTIVE')).orderBy(inventoryItems.name);}
export async function validateCourseMaterials(input:unknown){
 if(input===undefined)return [];if(!Array.isArray(input)||input.length>100)throw new CourseError('Ungültige Materialauswahl.');
 const options=await loadCourseMaterialOptions(),seen=new Set<number>();
 return input.map(value=>{if(!value||typeof value!=='object')throw new CourseError('Ungültige Materialauswahl.');const {itemId,count}=value as {itemId:unknown;count:unknown};if(!Number.isSafeInteger(itemId)||!Number.isSafeInteger(count)||Number(count)<1)throw new CourseError('Bitte Material und eine gültige Anzahl auswählen.');const item=options.find(option=>option.id===itemId);if(!item)throw new CourseError('Ein ausgewählter Materialartikel ist nicht mehr verfügbar.');if(seen.has(item.id))throw new CourseError('Materialartikel bitte nur einmal auswählen.');seen.add(item.id);const available=item.category==='MEDICAL_DEVICE'||item.category==='BAG'?1:item.quantity;if(Number(count)>available)throw new CourseError(`Für „${item.name}“ ist die gewählte Anzahl nicht im Bestand verfügbar.`);return {itemId:item.id,name:item.name,inventoryNumber:item.inventoryNumber??'',quantity:Number(count)};});
}
