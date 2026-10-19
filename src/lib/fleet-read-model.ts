import { dateFormatter } from "@/lib/date-format";
import {and,asc,desc,eq,gte,isNull,lte,ne,or} from "drizzle-orm";
import {db} from "./db";
import {appointments,appointmentVehicles,vehicleDefects,vehicleTrips,vehicles} from "@/db/schema";
import type {FleetFeed} from "./asset-types";
import {toWire} from "./wire";

const berlinDay=dateFormatter({timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"});
export async function loadFleetFeed(role:string,view="vehicles"):Promise<FleetFeed>{
 const empty:FleetFeed={vehicles:[],defects:[],trips:[],canManage:role==="ADMIN"||role==="VERWALTUNG"};
 if(view==="defects"){
  const defects=await db.select({defect:{id:vehicleDefects.id,vehicleId:vehicleDefects.vehicleId,title:vehicleDefects.title,createdAt:vehicleDefects.createdAt,status:vehicleDefects.status,category:vehicleDefects.category},vehicle:{licensePlate:vehicles.licensePlate}})
   .from(vehicleDefects).innerJoin(vehicles,eq(vehicleDefects.vehicleId,vehicles.id)).orderBy(desc(vehicleDefects.createdAt)).limit(100);
  return {...empty,defects:toWire(defects)};
 }
 if(view==="trips"){
  const trips=await db.select({trip:{id:vehicleTrips.id,vehicleId:vehicleTrips.vehicleId,title:vehicleTrips.title,kmStart:vehicleTrips.kmStart,kmEnd:vehicleTrips.kmEnd,startAt:vehicleTrips.startAt,endAt:vehicleTrips.endAt},vehicle:{licensePlate:vehicles.licensePlate},appointment:{title:appointments.title,startAt:appointments.startAt}})
   .from(vehicleTrips).innerJoin(vehicles,eq(vehicleTrips.vehicleId,vehicles.id)).leftJoin(appointments,eq(vehicleTrips.appointmentId,appointments.id)).orderBy(desc(vehicleTrips.startAt)).limit(100);
  return {...empty,trips:toWire(trips)};
 }
 const now=new Date(),today=berlinDay.format(now);
 const rows=await db.select({id:vehicles.id,licensePlate:vehicles.licensePlate,type:vehicles.type,mileage:vehicles.mileage,location:vehicles.location,tuvLastAt:vehicles.tuvLastAt,isActive:vehicles.isActive}).from(vehicles).orderBy(asc(vehicles.isActive),asc(vehicles.licensePlate));
 // Only ongoing services and starts within the next day can affect today's
 // availability. Reusing the formatter avoids thousands of Intl allocations.
 const bookings=await db.select({vehicleId:appointmentVehicles.vehicleId,title:appointments.title,startAt:appointments.startAt,endAt:appointments.endAt})
  .from(appointmentVehicles).innerJoin(appointments,eq(appointmentVehicles.appointmentId,appointments.id))
  .where(and(ne(appointments.state,"CANCELLED"),lte(appointments.startAt,new Date(now.getTime()+86400000)),or(gte(appointments.endAt,now),gte(appointments.startAt,new Date(now.getTime()-86400000)),isNull(appointments.endAt))));
 const statusByVehicle=new Map<number,{status:"PLANNED"|"IN_USE";title:string;startAt:Date;endAt:Date|null}>();
 for(const booking of bookings){
  const status=booking.startAt<=now&&(!booking.endAt||now<=booking.endAt)?"IN_USE":booking.startAt>now&&berlinDay.format(booking.startAt)===today?"PLANNED":null;
  const previous=statusByVehicle.get(booking.vehicleId);
  if(status==="IN_USE"||(status==="PLANNED"&&previous?.status!=="IN_USE"&&(!previous||booking.startAt<previous.startAt)))statusByVehicle.set(booking.vehicleId,{status,title:booking.title,startAt:booking.startAt,endAt:booking.endAt});
 }
 return {...empty,vehicles:toWire(rows.map(vehicle=>({...vehicle,booking:vehicle.isActive?statusByVehicle.get(vehicle.id)??{status:"FREE"}:{status:"FREE"}})))};
}
