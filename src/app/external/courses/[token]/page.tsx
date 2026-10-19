import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {CourseError,publicCourse} from '@/lib/courses';
import {courseType} from '@/lib/course-types';
import {dateFormatter} from '@/lib/date-format';
import {PublicCourseRegistration} from './registration-form';
export const metadata:Metadata={title:'Teilnehmer erfassen | milodo',robots:{index:false,follow:false},referrer:'no-referrer'};
export const dynamic='force-dynamic';
export default async function ExternalCoursePage({params}:{params:Promise<{token:string}>}){const {token}=await params;let row;try{row=publicCourse(token);}catch(error){if(error instanceof CourseError)notFound();throw error;}return <main className="mx-auto min-h-screen w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6"><section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] sm:p-8"><p className="text-xs font-semibold text-[color:var(--accent)]">milodo medical · Teilnehmererfassung</p><h1 className="mt-3 break-words text-2xl font-bold">{row.title}</h1><p className="mt-2 break-words text-sm font-semibold">{courseType(row.course_type)?.label}</p><p className="mt-4 text-sm">{dateFormatter({dateStyle:'medium',timeStyle:'short'}).format(new Date(row.start_at))} – {dateFormatter({timeStyle:'short'}).format(new Date(row.end_at))}</p><p className="mt-2 break-words text-sm text-[color:var(--muted)]">{row.einsatzort}</p><p className="mt-4 text-sm">Bitte erfassen Sie Vorname, Nachname und Geburtsdatum der teilnehmenden Personen. Bereits gespeicherte Teilnehmerdaten werden hier nicht angezeigt.</p></section><PublicCourseRegistration token={token}/></main>;}
