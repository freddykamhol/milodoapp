"use client";
import { DefectOverview } from "../../../_components/defects";
import { vehicleDefectCategories } from "@/lib/defects";
import type { VehicleDefectRow } from "@/lib/asset-types";
export function DefectList({defects}:{defects:VehicleDefectRow[]}){return <DefectOverview rows={defects.map(row=>({id:row.defect.id,title:row.defect.title,status:row.defect.status,createdAt:row.defect.createdAt,subject:row.vehicle.licensePlate,category:vehicleDefectCategories[row.defect.category],href:`/vehicles/defects/${row.defect.id}`}))} createHref="/vehicles/defects/new"/>;}
