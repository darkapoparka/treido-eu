"use client";
import { useState } from "react";
import Image from "next/image";
import type { ReportImageEvidence } from "./image-evidence.server";
import s from "./operations.module.css";
import w from "../sellers/workspace.module.css";
export function ReportEvidenceImages({reportId, images, language}: {reportId: string; images: ReportImageEvidence[]; language: "bg" | "en"}) {
  return <section className={s.card}>
    <h2>{language==="bg"?"Лични снимки към сигнала":"Private images in this report"}</h2>
    <p>{language==="bg"?"Достъпът е ограничен до този сигнал и се проверява при всяко зареждане. Прегледите се записват в историята на случая.":"Access is limited to this report and checked on every load. Access is recorded in the case audit history."}</p>
    {!images.length && <p>{language==="bg"?"Няма прикачени снимки към съобщението.":"This message has no attached images."}</p>}
    <ul className={s.list}>{images.map(image=><li key={image.id}><EvidenceImage reportId={reportId} image={image} language={language}/></li>)}</ul>
  </section>;
}
function EvidenceImage({reportId,image,language}:{reportId:string;image:ReportImageEvidence;language:"bg"|"en"}) {
  const [attempt,setAttempt]=useState(0),[failed,setFailed]=useState(false);
  const url="/api/ops/reports/"+reportId+"/images/"+image.id;
  const unavailable=language==="bg"?"Снимката не може да бъде заредена. Не приемай, че липсата на снимка доказва липса на нарушение.":"The image cannot be loaded. Missing image evidence does not establish that no violation occurred.";
  if(image.state!=="available") return <p role="status">{image.state==="deletion-in-flight" ? language==="bg"?"Изтриване вече е било изпратено към хранилището. Запазването на тези байтове не е потвърдено; необходима е проверка на точния обект.":"Deletion was already dispatched to storage. Retention of these bytes is not confirmed; the exact object needs reconciliation." : image.state==="removed" ? language==="bg"?"Байтовете са били изтрити. Текстът, сигналът и историята остават налични.":"The image bytes were deleted. The message, report and audit history remain available." : unavailable}</p>;
  return <div>{failed ? <p role="status">{unavailable}</p> : <a href={url} target="_blank" rel="noreferrer"><Image unoptimized key={attempt} src={url+(attempt?"?attempt="+attempt:"")} alt={language==="bg"?"Снимка към докладваното съобщение":"Image attached to the reported message"} width={image.width??1024} height={image.height??1024} style={{maxWidth:"100%",maxHeight:360,objectFit:"contain",height:"auto"}} loading="lazy" onError={()=>setFailed(true)}/></a>}{failed && <button type="button" className={w.button} onClick={()=>{setAttempt(value=>value+1);setFailed(false);}}>{language==="bg"?"Опитай отново":"Retry"}</button>}</div>;
}
