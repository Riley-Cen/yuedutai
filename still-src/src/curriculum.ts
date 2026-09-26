import data from './curriculum.json';
export type CourseSeries={id:string;area:string;title:string;short:string;outcome:string;prerequisite:string;lessonIds:string[]};
export type CourseLesson={id:string;seriesId:string;title:string;short:string;summary:string;minutes:number;objectives:string[];sections:{title:string;body:string}[];practice?:{question:string;answer:string};transfer:{task:string;check:string};references:{label:string;url:string}[]};
export const series=data.series as CourseSeries[];
export const courses=data.lessons as CourseLesson[];
export const seriesLessons=(s:CourseSeries)=>s.lessonIds.map(id=>courses.find(l=>l.id===id)!);
export const nextUnread=(s:CourseSeries,done:string[])=>seriesLessons(s).find(l=>!done.includes(l.id))||seriesLessons(s)[0];
