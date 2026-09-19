import { useEffect, useRef, useState } from "react";
import { api } from "./api";
export function useVoice(
  connected: boolean,
  onText: (text: string) => void,
  notify: (text: string) => void,
) {
  const [recording, setRecording] = useState(false),
    [processing, setProcessing] = useState(false);
  const stream = useRef<MediaStream | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    recognition = useRef<any>(null),
    epoch = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function stop() {
    epoch.current++;
    clearTimeout(timer.current);
    if (recorder.current && recorder.current.state !== "inactive") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recognition.current?.abort();
    setRecording(false);
  }
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  async function toggle() {
    if (processing) return;
    if (recording) {
      if (recorder.current?.state === "recording") recorder.current.stop();
      else recognition.current?.stop();
      return;
    }
    window.speechSynthesis?.cancel();
    if (!connected) {
      const Recognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (!Recognition) {
        notify(
          "Voice input needs an AI connection in this browser. You can type, or connect a key in Settings.",
        );
        return;
      }
      try {
        const r = new Recognition();
        recognition.current = r;
        r.lang = navigator.language;
        r.continuous = false;
        r.interimResults = false;
        r.onstart = () => setRecording(true);
        r.onend = () => setRecording(false);
        r.onerror = (e: any) => {
          setRecording(false);
          if (e.error !== "aborted")
            notify(
              "Browser speech input stopped. Check microphone permission or type instead.",
            );
        };
        r.onresult = (e: any) => {
          onText(e.results[0][0].transcript);
          notify("Review your words, then press Send.");
        };
        r.start();
      } catch {
        notify("Voice input could not start. You can type instead.");
      }
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      notify("Audio recording is not supported here. Use text input.");
      return;
    }
    const token = ++epoch.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      if (token !== epoch.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const mime = ["audio/webm", "audio/mp4"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      if (!mime) {
        stop();
        notify(
          "This browser cannot record a supported audio format. Type instead.",
        );
        return;
      }
      const r = new MediaRecorder(media, {
        mimeType: mime,
        audioBitsPerSecond: 64000,
      });
      recorder.current = r;
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onerror = () => {
        stop();
        notify("Audio recording stopped unexpectedly.");
      };
      r.onstop = async () => {
        clearTimeout(timer.current);
        media.getTracks().forEach((t) => t.stop());
        stream.current = null;
        setRecording(false);
        if (token !== epoch.current) return;
        setProcessing(true);
        try {
          const blob = new Blob(chunks, { type: mime });
          if (blob.size > 4 * 1024 * 1024)
            throw new Error("Please record a shorter message.");
          const audio = await new Promise<string>((resolve, reject) => {
            const f = new FileReader();
            f.onload = () => resolve(String(f.result));
            f.onerror = reject;
            f.readAsDataURL(blob);
          });
          const result = await api<{ text: string }>("/api/v1/transcribe", {
            audio,
          });
          if (token === epoch.current) {
            onText(result.text);
            notify(
              "Review the transcript, then press Send. Audio was not saved.",
            );
          }
        } catch (e: any) {
          notify(e.message);
        } finally {
          setProcessing(false);
        }
      };
      r.start();
      setRecording(true);
      timer.current = setTimeout(() => {
        if (r.state === "recording") r.stop();
      }, 90000);
    } catch (e: any) {
      stop();
      notify(
        e.name === "NotAllowedError"
          ? "Microphone permission was denied. You can type instead."
          : "No microphone could be opened. Check your device or use text.",
      );
    }
  }
  return {
    recording,
    processing,
    toggle,
    stop,
    note: connected
      ? "Voice clips go to OpenAI for transcription after you stop"
      : "Voice fallback uses your browser’s speech service",
  };
}
