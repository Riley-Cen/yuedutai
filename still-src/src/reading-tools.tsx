"use client";
import {useEffect,useRef,useState,type CSSProperties,type RefObject} from "react";

type Theme="paper"|"warm"|"green"|"night";
const themes:{id:Theme;label:string}[]=[{id:"paper",label:"纸白"},{id:"warm",label:"暖纸"},{id:"green",label:"豆绿"},{id:"night",label:"夜读"}];
function today(){const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`}
function readDay(){try{const d=JSON.parse(localStorage.getItem("still-reading-day")||"null");if(d?.day===today()&&Number.isFinite(d.seconds)&&d.seconds>=0)return d as {day:string;seconds:number}}catch{}return {day:today(),seconds:0}}
export function useReadingPreferences(){
  const [size,setSize]=useState(1),[theme,setTheme]=useState<Theme>("paper"),[saveError,setSaveError]=useState("");
  useEffect(()=>{try{const p=JSON.parse(localStorage.getItem("still-reading-preferences")||"null");if(p&&[0.94,1,1.12].includes(p.size)&&themes.some(t=>t.id===p.theme)){
    // Restore browser-only display preferences after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSize(p.size);setTheme(p.theme);
  }}catch{}},[]);
  function update(nextSize:number,nextTheme:Theme){setSize(nextSize);setTheme(nextTheme);try{localStorage.setItem("still-reading-preferences",JSON.stringify({size:nextSize,theme:nextTheme}));setSaveError("")}catch{setSaveError("浏览器未能记住设置，当前选择仅本次有效。")}}
  return {size,theme,update,saveError,style:{"--reader-size":`${size}rem`} as CSSProperties};
}
export default function ReadingTools({preferences,root}:{preferences:ReturnType<typeof useReadingPreferences>;root:RefObject<HTMLElement|null>}){
  const [seconds,setSeconds]=useState(0),[persisted,setPersisted]=useState(true);const activeAt=useRef(0);
  useEffect(()=>{
    activeAt.current=Date.now();let last=Date.now();let storageWorks=true;let volatileDay={day:today(),seconds:0};
    const active=()=>{activeAt.current=Date.now()};
    const reset=()=>{last=Date.now();if(!document.hidden)active()};
    window.addEventListener("scroll",active,{passive:true});window.addEventListener("pointerdown",active,{passive:true});window.addEventListener("keydown",active);document.addEventListener("visibilitychange",reset);
    const timer=window.setInterval(()=>{const now=Date.now(),elapsed=Math.max(0,Math.min(5,(now-last)/1000));last=now;const box=root.current?.getBoundingClientRect();const readingVisible=box&&box.bottom>0&&box.top<innerHeight;
      if(volatileDay.day!==today())volatileDay={day:today(),seconds:0};const saved=storageWorks?readDay():volatileDay;if(!document.hidden&&document.hasFocus()&&readingVisible&&now-activeAt.current<60000){saved.seconds+=elapsed;if(storageWorks)try{localStorage.setItem("still-reading-day",JSON.stringify(saved))}catch{storageWorks=false;volatileDay=saved;setPersisted(false)}}
      setSeconds(saved.seconds);
    },5000);
    return()=>{clearInterval(timer);window.removeEventListener("scroll",active);window.removeEventListener("pointerdown",active);window.removeEventListener("keydown",active);document.removeEventListener("visibilitychange",reset)};
  },[root]);
  return <div className="reading-tools"><div className="reading-settings"><div className="reading-size" aria-label="正文字号">{[0.94,1,1.12].map((size,i)=><button type="button" key={size} aria-label={`${["小","中","大"][i]}字号`} aria-pressed={preferences.size===size} onClick={()=>preferences.update(size,preferences.theme)} style={{fontSize:`${12+i*2}px`}}>字</button>)}</div><div className="reading-themes" aria-label="页面主题">{themes.map(t=><button type="button" key={t.id} aria-pressed={preferences.theme===t.id} onClick={()=>preferences.update(preferences.size,t.id)}>{t.label}</button>)}</div></div><span className="reading-time" title="只计本站课程与导读在前台且未闲置超过一分钟的时间；仅保存在本设备。">今天阅读 · {persisted?"本设备":"本次（未保存）"} {seconds>0&&seconds<60?"不足 1":Math.floor(seconds/60)} 分钟</span>{preferences.saveError&&<p role="status" className="small">{preferences.saveError}</p>}</div>;
}
