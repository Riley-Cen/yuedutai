import {useRef} from 'react';
import {ArrowLeft,ArrowRight,Check} from 'lucide-react';
import {series,seriesLessons,nextUnread,type CourseSeries,type CourseLesson} from './curriculum';
import ReadingTools,{useReadingPreferences} from './reading-tools';
import OpportunityLesson from './opportunity-lesson';
import StorageDemo from './storage-demo';
const areaName:Record<string,string>={work:'工作',capability:'个人能力',growth:'心灵成长'};
const courseHome=(area:string)=>`#/?area=${area}&mode=course`;
export function Paragraphs({text}:{text:string}){return <>{text.split('\n\n').filter(Boolean).map((p,i)=><p key={i}>{p}</p>)}</>}
export function CourseList({area,done}:{area:string;done:string[]}){
 const list=series.filter(s=>s.area===area);const current=list.find(s=>s.lessonIds.some(id=>done.includes(id))&&s.lessonIds.some(id=>!done.includes(id)))||list.find(s=>s.lessonIds.some(id=>!done.includes(id)))||list[0];const next=nextUnread(current,done);const index=current.lessonIds.indexOf(next.id);const finished=current.lessonIds.every(id=>done.includes(id));
 return <><article className="feature"><div className="feature-copy"><span className="eyebrow">课程系列 · {current.lessonIds.length} 课</span><h2>{current.title}</h2><p>{current.short}</p><a className="primary" href={`#/learn/${next.id}`}>{finished?'从第一课复习':index===0?'从第一课开始':`继续第 ${index+1} 课`}<ArrowRight size={16}/></a><a className="course-route-link" href={`#/course/${current.id}`}>查看课程路线</a></div><img className="feature-art" src="./still-paper.png" alt="深紫纸页旁，一轮橙色的太阳"/></article><div className="section-head"><h2>课程系列</h2><span className="small muted">{list.length} 个系列 · {list.reduce((sum,s)=>sum+s.lessonIds.length,0)} 课</span></div>
 {list.map(s=><a className="series-row" href={`#/course/${s.id}`} key={s.id}><div><h3>{s.title}</h3><p>{s.outcome}</p><span className="small muted">{s.lessonIds.filter(id=>done.includes(id)).length} / {s.lessonIds.length} 课已读 · 本设备</span></div><ArrowRight size={18}/></a>)}</>;
}
export function CourseOverview({course,done}:{course:CourseSeries;done:string[]}){
 const lessons=seriesLessons(course),next=nextUnread(course,done),count=course.lessonIds.filter(id=>done.includes(id)).length;
 return <article className="course-overview reader"><a className="back" href={courseHome(course.area)}><ArrowLeft size={16}/>回到{areaName[course.area]}</a><span className="eyebrow">{areaName[course.area]} · 课程系列 · {lessons.length} 课</span><h1>{course.title}</h1><p className="dek">{course.outcome}</p><p className="course-prerequisite">起点：{course.prerequisite}</p><div className="course-start"><a className="primary" href={`#/learn/${next.id}`}>{count===lessons.length?'从第一课复习':count===0?'开始第一课':`继续第 ${course.lessonIds.indexOf(next.id)+1} 课`}<ArrowRight size={16}/></a><span className="small muted">{count} / {lessons.length} 课已读 · 本设备</span></div>
 <ol className="chapter-list">{lessons.map((l,i)=><li key={l.id}><a className="lesson-row" href={`#/learn/${l.id}`}><span className="lesson-no">{String(i+1).padStart(2,'0')}</span><div><h2>{l.title}</h2><p>{l.short}</p><span className="meta">约 {l.minutes} 分钟 · 含练习{done.includes(l.id)?' · 已读':''}</span></div>{done.includes(l.id)?<Check size={18}/>:<ArrowRight size={18}/>}</a></li>)}</ol></article>;
}
export function CourseReadPage({lesson,done,complete}:{lesson:CourseLesson;done:string[];complete:(id:string)=>void}){
 const prefs=useReadingPreferences(),root=useRef<HTMLElement>(null);const course=series.find(s=>s.id===lesson.seriesId)!,lessons=seriesLessons(course),index=course.lessonIds.indexOf(lesson.id),previous=lessons[index-1],next=lessons[index+1];
 return <article ref={root} className={`reader course-reader reader-theme-${prefs.theme}`} style={prefs.style}><a className="back" href={`#/course/${course.id}`}><ArrowLeft size={16}/>回到课程路线</a><div className="eyebrow">{course.title} · 第 {index+1} / {lessons.length} 课</div><h1>{lesson.title}</h1><p className="dek">{lesson.short}</p><ReadingTools preferences={prefs} root={root}/><details className="lesson-outline"><summary>本系列章节</summary><ol>{lessons.map((l,i)=><li key={l.id}><a href={`#/learn/${l.id}`} aria-current={l.id===lesson.id?'page':undefined}>第 {i+1} 课 · {l.title}</a></li>)}</ol></details>
 {previous&&<p className="lesson-connection">接着上一课：<a href={`#/learn/${previous.id}`}>{previous.title}</a></p>}
 <section className="lesson-summary"><h2>先看概念摘要</h2><p>{lesson.summary}</p></section><section className="learning-objectives"><h2>这一课要学会</h2><ul>{lesson.objectives.map(o=><li key={o}>{o}</li>)}</ul></section>
 {lesson.sections.map(s=><section key={s.title}><h2>{s.title}</h2><Paragraphs text={s.body}/></section>)}
 {lesson.id==='opportunity-cost'&&<OpportunityLesson/>}{lesson.id==='where-data-lives'&&<StorageDemo/>}
 {lesson.practice&&<section className="exercise"><h2>先自己推一遍</h2><Paragraphs text={lesson.practice.question}/><details className="practice-answer"><summary>想好后，看参考推理</summary><div className="answer"><Paragraphs text={lesson.practice.answer}/></div></details></section>}
 <section className="lesson-transfer"><h2>带到另一个情境</h2><Paragraphs text={lesson.transfer.task}/><details className="transfer-check"><summary>怎样检查自己的理解</summary><Paragraphs text={lesson.transfer.check}/></details></section>
 <div className="reader-footer"><button className="primary" disabled={done.includes(lesson.id)} onClick={()=>complete(lesson.id)}>{done.includes(lesson.id)?'本课已读':'标记本课已读'}</button><span className="small muted">已读状态仅保存在本设备</span></div>
 <nav className="chapter-navigation" aria-label="章节导航">{previous?<a href={`#/learn/${previous.id}`}><span>上一课</span>{previous.title}</a>:<a href={`#/course/${course.id}`}><span>课程路线</span>查看全部 {lessons.length} 课</a>}{next?<a href={`#/learn/${next.id}`}><span>下一课 <ArrowRight size={14}/></span>{next.title}</a>:<a href={`#/course/${course.id}`}><span>回到课程路线 <ArrowRight size={14}/></span>回顾本系列</a>}</nav>
 {lesson.references.length>0&&<div className="sources"><h2>来源与延伸阅读</h2><p>本站独立编写的入门课，案例与练习为原创教学设计。资料核实于 2026-09-26。</p>{lesson.references.map(r=><div className="reading-reference" key={r.url}><a href={r.url} target="_blank" rel="noreferrer">{r.label}</a></div>)}</div>}</article>;
}
