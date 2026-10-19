"use client";
import { DefectCreateForm } from "../../../_components/defects";
export function DefectForm({vehicles,initialSubject}:{vehicles:{id:number;licensePlate:string;mileage:number}[];initialSubject?:string}){return <DefectCreateForm domain="vehicle" subjects={vehicles.map(vehicle=>({id:vehicle.id,label:vehicle.licensePlate,mileage:vehicle.mileage}))} initialSubject={initialSubject}/>;}
