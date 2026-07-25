import { useCallback, useEffect, useRef, useState } from "react";
import {
  SERVER_STT_CONFIGURED,
  transcribeAudioServer,
} from "../lib/voice/transcribe";

export const MAX_RECORDING_SECONDS = 60;

export type VoiceCaptureStatus =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "transcribing"
  | "error"
  | "done";

interface BrowserRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  onerror: ((event: any) => void) | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  onend: (() => void) | null;
}

function getBrowserRecognitionCtor(): (new () => BrowserRecognition) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceCapture() {
  const [status, setStatus] = useState<VoiceCaptureStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [transcriptSource, setTranscriptSource] = useState<
    "server" | "browser" | null
  >(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const browserTranscriptRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const statusRef = useRef<VoiceCaptureStatus>("idle");
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(
    () => () => {
      clearTimer();
      releaseStream();
      recognitionRef.current?.stop();
    },
    []
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setElapsedSeconds(0);
    setErrorMessage(null);
    setTranscript("");
    setTranscriptSource(null);
    chunksRef.current = [];
    browserTranscriptRef.current = "";
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    if (statusRef.current !== "listening") return;
    setStatus("transcribing");
    mediaRecorderRef.current?.stop();
    recognitionRef.current?.stop();
    releaseStream();
  }, []);

  const start = useCallback(async () => {
    cancelledRef.current = false;
    reset();
    setStatus("requesting_permission");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      setErrorMessage(
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "Microphone access was blocked. Please allow microphone access, or type your entry below."
          : name === "NotFoundError"
            ? "No microphone was found on this device. Please type your entry below."
            : "Could not access the microphone. Please type your entry below."
      );
      setStatus("error");
      return;
    }

    if (cancelledRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    // Audio capture for the server transcription path.
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : undefined;
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => void handleStopped();
    mediaRecorderRef.current = recorder;
    recorder.start();

    // Concurrent browser recognition, used as the fallback transcript source.
    const RecognitionCtor = getBrowserRecognitionCtor();
    if (RecognitionCtor) {
      const recognition = new RecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-GB";
      recognition.onresult = (event) => {
        let text = "";
        for (let i = 0; i < event.results.length; i++)
          text += event.results[i][0].transcript;
        browserTranscriptRef.current = text;
      };
      recognition.onerror = () => {
        /* fallback source simply stays empty */
      };
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        /* ignore */
      }
    }

    setStatus("listening");
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => {
        if (s + 1 >= MAX_RECORDING_SECONDS) {
          stop();
          return MAX_RECORDING_SECONDS;
        }
        return s + 1;
      });
    }, 1000);
  }, [reset, stop]);

  const handleStopped = async () => {
    if (cancelledRef.current) return;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];

    if (SERVER_STT_CONFIGURED) {
      try {
        const serverTranscript = await transcribeAudioServer(blob);
        if (cancelledRef.current) return;
        setTranscript(serverTranscript);
        setTranscriptSource("server");
        setStatus("done");
        return;
      } catch {
        // fall through to browser transcript below
      }
    }

    if (cancelledRef.current) return;
    const fallback = browserTranscriptRef.current.trim();
    if (fallback) {
      setTranscript(fallback);
      setTranscriptSource("browser");
      setStatus("done");
    } else {
      setErrorMessage(
        "No speech was detected. Please try again, or type your entry below."
      );
      setStatus("error");
    }
  };

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    clearTimer();
    mediaRecorderRef.current?.stop();
    recognitionRef.current?.stop();
    releaseStream();
    reset();
  }, [reset]);

  return {
    status,
    elapsedSeconds,
    maxSeconds: MAX_RECORDING_SECONDS,
    errorMessage,
    transcript,
    transcriptSource,
    start,
    stop,
    cancel,
    reset,
    supported:
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia,
  };
}
