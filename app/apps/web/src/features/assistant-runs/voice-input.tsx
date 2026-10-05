"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SourceLink } from "../discovery/return-navigation";
import { encodeInputWav } from "./wav";
import { inputCopy } from "./copy";
import s from "../photo-match/photo.module.css";
export function VoiceInput({
  locale,
  maximumSeconds,
  disabled,
  onFile,
}: {
  locale: "bg" | "en";
  maximumSeconds: number;
  disabled: boolean;
  onFile: (file: File | null) => void;
}) {
  const t = inputCopy[locale],
    [recording, setRecording] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(false),
    [seconds, setSeconds] = useState(0);
  const listener = useRef(onFile);
  const duration = useRef(maximumSeconds);
  useEffect(() => {
    listener.current = onFile;
    duration.current = maximumSeconds;
  }, [onFile, maximumSeconds]);
  const capture = useRef<{
    alive: boolean;
    ticket: number;
    stream: MediaStream | null;
    context: AudioContext | null;
    node: ScriptProcessorNode | null;
    source: MediaStreamAudioSourceNode | null;
    gain: GainNode | null;
    chunks: Float32Array[];
    frames: number;
  }>({
    alive: true,
    ticket: 0,
    stream: null,
    context: null,
    node: null,
    source: null,
    gain: null,
    chunks: [],
    frames: 0,
  });
  const stop = useCallback((discard: boolean) => {
    const current = capture.current;
    ++current.ticket;
    if (!discard && current.context && current.frames > 0) {
      try {
        listener.current(
          new File(
            [
              encodeInputWav(
                current.chunks,
                current.context.sampleRate,
                duration.current,
              ),
            ],
            "recording.wav",
            { type: "audio/wav" },
          ),
        );
      } catch {
        setError(true);
      }
    }
    current.stream?.getTracks().forEach((track) => track.stop());
    current.node?.disconnect();
    current.source?.disconnect();
    current.gain?.disconnect();
    if (current.context) void current.context.close().catch(() => undefined);
    current.stream = null;
    current.context = null;
    current.node = null;
    current.source = null;
    current.gain = null;
    current.chunks = [];
    current.frames = 0;
    if (current.alive) {
      setRecording(false);
      setPending(false);
      if (discard) {
        setSeconds(0);
        listener.current(null);
      }
    }
  }, []);
  useEffect(() => {
    const current = capture.current;
    current.alive = true;
    const hidden = () => {
      if (document.visibilityState !== "visible") stop(true);
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      current.alive = false;
      stop(true);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [stop]);
  useEffect(() => {
    if (disabled && (capture.current.stream || pending)) stop(true);
  }, [disabled, pending, stop]);
  async function start() {
    if (disabled || recording || pending) return;
    const current = capture.current,
      ticket = ++current.ticket;
    setPending(true);
    setError(false);
    listener.current(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext)
        throw Error();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
        video: false,
      });
      if (!current.alive || ticket !== current.ticket) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      current.stream = stream;
      const context = new AudioContext();
      current.context = context;
      if (![16000, 24000, 44100, 48000].includes(context.sampleRate))
        throw Error();
      const source = context.createMediaStreamSource(stream),
        node = context.createScriptProcessor(4096, 1, 1),
        gain = context.createGain();
      gain.gain.value = 0;
      current.source = source;
      current.node = node;
      current.gain = gain;
      current.chunks = [];
      current.frames = 0;
      node.onaudioprocess = (event) => {
        if (!current.alive || ticket !== current.ticket) return;
        const remaining = maximumSeconds * context.sampleRate - current.frames,
          samples = event.inputBuffer
            .getChannelData(0)
            .slice(0, Math.max(0, remaining));
        current.chunks.push(samples);
        current.frames += samples.length;
        setSeconds(Math.floor(current.frames / context.sampleRate));
        if (current.frames >= maximumSeconds * context.sampleRate) stop(false);
      };
      source.connect(node);
      node.connect(gain);
      gain.connect(context.destination);
      await context.resume();
      if (!current.alive || ticket !== current.ticket) return;
      setPending(false);
      setRecording(true);
      setSeconds(0);
    } catch {
      if (current.alive && ticket === current.ticket) {
        stop(true);
        setError(true);
      }
    }
  }
  return (
    <div className={s.panel}>
      <p>
        {t.voice} · {maximumSeconds} {t.seconds}
      </p>
      <div className={s.actions}>
        <button
          type="button"
          className={s.button}
          disabled={disabled || recording || pending}
          onClick={() => void start()}
        >
          {t.capture}
        </button>
        {(recording || pending) && (
          <>
            <button
              type="button"
              className={s.button}
              disabled={!recording}
              onClick={() => stop(false)}
            >
              {t.stopCapture}
            </button>
            <button
              type="button"
              className={s.button}
              onClick={() => stop(true)}
            >
              {t.discardCapture}
            </button>
          </>
        )}
        <SourceLink
          preserveDiscoveryContext={false}
          href={"/minis/find-for-me?lang=" + locale}
        >
          {t.typed}
        </SourceLink>
      </div>
      {recording && (
        <p role="status">
          {t.recording}: {seconds}
        </p>
      )}
      {error && <p role="alert">{t.captureError}</p>}
    </div>
  );
}
