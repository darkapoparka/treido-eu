'use client';
export default function BillingError({reset}:{reset:()=>void}) { return <section><p role="alert">Планът е временно недостъпен. / The plan is temporarily unavailable.</p><button onClick={reset}>Опитай отново / Try again</button></section>; }
