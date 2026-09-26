import {useId,useState} from 'react';
const key='still-course-storage-demo';
function readRecord(){const value=localStorage.getItem(key);return value===null?'':value}
export default function StorageDemo(){
 const id=useId();const[mode,setMode]=useState('memory'),[draft,setDraft]=useState('去月亮上散步'),[memory,setMemory]=useState(''),[local,setLocal]=useState(''),[fail,setFail]=useState(false),[message,setMessage]=useState('先选位置，再提交书名。');
 function choose(next:string){setMode(next);setMessage('先选位置，再提交书名。');if(next==='local')try{setLocal(readRecord())}catch{setMessage('浏览器不允许读取本机练习记录。')}}
 function save(e:React.FormEvent){e.preventDefault();const text=draft.trim();if(!text){setMessage('书名不能为空，记录没有改变。');return}if(mode==='memory'){setMemory(text);setMessage('已放入页面内存，还没有持久保存。')}else try{if(fail)throw Error('simulated');localStorage.setItem(key,text);setLocal(text);setMessage('已保存到这个浏览器的本机练习记录。')}catch{setMessage('未保存成功，输入已保留。关闭模拟失败后可以重试。')}}
 function reopen(){setMemory('');setDraft('');if(mode==='memory'){setMessage('重新创建页面状态：内存记录消失了。');return}try{setLocal(readRecord());setMessage('重新读取本机存储：下面是实际读回的记录。')}catch{setMessage('浏览器不允许读取本机练习记录。')}}
 function clear(){try{localStorage.removeItem(key);setLocal('');setMemory('');setMessage('练习记录已清除。')}catch{setMessage('未能清除本机练习记录。')}}
 return <section className="storage-demo example" aria-label="数据保存实验"><h2>亲手比较两种保存位置</h2><p>用一条虚构书名做实验。先提交，再点“模拟重新打开”，观察记录还在不在。这里只练习一条虚构记录；输入不会上传，本机保存会留在当前浏览器。</p>
 <div className="demo-modes" role="group" aria-label="保存位置">{[['memory','页面内存'],['local','本机保存']].map(([value,label])=><button className="secondary" type="button" key={value} aria-pressed={mode===value} onClick={()=>choose(value)}>{label}</button>)}</div>
 <form onSubmit={save}><label htmlFor={id}>练习书名</label><div className="demo-input"><input id={id} value={draft} maxLength={60} onChange={e=>setDraft(e.target.value)} autoComplete="off"/><button className="primary" type="submit">提交书名</button></div></form>
 {mode==='local'&&<label className="demo-failure"><input type="checkbox" checked={fail} onChange={e=>setFail(e.target.checked)}/>模拟无法写入</label>}
 <p className="demo-record">{mode==='memory'?'内存中的记录':'本机存储读回的记录'}：<strong>{(mode==='memory'?memory:local)||'暂无记录'}</strong></p><p role="status" className="demo-status">{message}</p>
 <div className="demo-actions"><button className="secondary" type="button" onClick={reopen}>模拟重新打开</button><button className="quiet-button" type="button" onClick={clear}>清除练习记录</button></div><p className="small">“模拟重新打开”会清空练习的内存；本机模式会重新读取已存记录。清除练习只影响这条书名。</p></section>;
}
