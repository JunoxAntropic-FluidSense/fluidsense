import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Microphone,
  X,
  CheckCircle,
  Warning,
  Record,
} from "@phosphor-icons/react";
import { useVoiceCapture } from "../../hooks/useVoiceCapture";
import { useActivePatient } from "../../hooks/useFluidData";
import { useStore } from "../../store/useStore";
import { extractVoiceEvents } from "../../lib/voice/extractEvents";
import { speakConfirmation } from "../../lib/voice/speak";

export function VoiceFab() {
  const location = useLocation();
  const capture = useVoiceCapture();
  const patient = useActivePatient();
  const currentUser = useStore((s) => s.currentUser);
  const fluidProfiles = useStore((s) => s.fluidProfiles);
  const recentEvents = useStore((s) => s.events);
  const addEvent = useStore((s) => s.addEvent);

  const [isOpen, setIsOpen] = useState(false);
  const [successSummary, setSuccessSummary] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpen = () => {
    setIsOpen(true);
    setSuccessSummary(null);
    setErrorMessage(null);
    capture.start();
  };

  const handleClose = () => {
    capture.cancel();
    setIsOpen(false);
    setSuccessSummary(null);
    setErrorMessage(null);
  };

  // Process transcript when speech capture finishes
  useEffect(() => {
    if (capture.status === "done" && capture.transcript) {
      processTranscript(capture.transcript);
    } else if (capture.status === "error" && capture.errorMessage) {
      setErrorMessage(capture.errorMessage);
    }
  }, [capture.status, capture.transcript, capture.errorMessage]);

  const processTranscript = (transcriptText: string) => {
    if (!patient) {
      setErrorMessage("No active patient selected.");
      return;
    }

    const parseResult = extractVoiceEvents(transcriptText, {
      patient,
      fluidProfiles,
      recentEvents,
      now: new Date(),
    });

    if (parseResult.intent === "request_summary") {
      setSuccessSummary("Request for 24h summary logged.");
      setTimeout(() => setIsOpen(false), 2000);
      return;
    }

    if (parseResult.events.length === 0) {
      setErrorMessage(
        "Could not detect fluid intake or output. Try e.g. 'I drank 250ml water'."
      );
      return;
    }

    const savedLogs: string[] = [];

    for (const c of parseResult.events) {
      if (c.direction === "unknown" || !c.category) continue;

      addEvent({
        patientId: patient.id,
        direction: c.direction,
        category: c.category,
        subtype: c.subtype,
        amountMl: c.amountMl,
        unit: "mL",
        status: c.measurementStatus,
        episodeCount: c.quantityOfEvents,
        containerFraction: c.containerFraction,
        eventTime: c.eventTime,
        enteredBy: currentUser.displayName,
        enteredByRole: currentUser.role,
        inputMethod: "voice",
        transcript: currentUser.saveVoiceTranscripts
          ? c.originalTranscript
          : undefined,
      });

      const label = c.category.replace("_", " ");
      const amountStr = c.amountMl ? `${c.amountMl} mL` : "Entry";
      savedLogs.push(`${amountStr} ${label}`);
    }

    if (savedLogs.length > 0) {
      setSuccessSummary(`Saved: ${savedLogs.join(", ")}`);
      void speakConfirmation(`Logged ${savedLogs.join(", and ")}.`);
      setTimeout(() => {
        setIsOpen(false);
        capture.reset();
      }, 2200);
    } else {
      setErrorMessage(
        "Could not parse valid fluid category. Try e.g. 'I drank 250ml water'."
      );
    }
  };

  const handleStopAndSave = () => {
    capture.stop();
  };

  // Hide floating voice widget when on the dedicated voice page — checked
  // after every hook above has run, never before, so hook count stays
  // constant across renders regardless of route.
  if (location.pathname === "/voice") {
    return null;
  }

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          aria-label="Speak an entry"
          className="fixed bottom-20 right-5 md:bottom-8 md:right-8 z-40 flex items-center gap-2.5 bg-fern-500 text-white px-4.5 py-3.5 rounded-full shadow-xl hover:bg-fern-600 hover:scale-105 active:scale-95 transition-all duration-200 group cursor-pointer border border-white/20"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fern-100 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-fern-100"></span>
          </span>
          <Microphone
            size={22}
            weight="fill"
            className="text-intake-400 group-hover:scale-110 transition-transform duration-200"
            aria-hidden="true"
          />
          <span className="font-extrabold text-sm tracking-wide text-white">
            Voice Entry
          </span>
        </button>
      )}

      {/* Clean Light Brand Voice Recorder Modal */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 left-5 sm:left-auto sm:w-96 md:bottom-8 md:right-8 z-50 rounded-3xl bg-white border border-navy-900/15 text-navy-900 p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-fog-200 pb-3">
            <div className="flex items-center gap-2">
              <Record
                size={16}
                weight="fill"
                className="text-alert-500 animate-pulse"
              />
              <span className="text-xs font-extrabold text-navy-900 tracking-wide uppercase">
                Voice Entry Recording
              </span>
            </div>
            <div className="flex items-center gap-3">
              {capture.status === "listening" && (
                <span className="text-xs font-mono font-bold text-intake-600 bg-intake-50 px-2.5 py-0.5 rounded-full border border-intake-200">
                  0:0{capture.elapsedSeconds}
                </span>
              )}
              <button
                onClick={handleClose}
                className="p-1 rounded-full text-fog-500 hover:text-navy-900 hover:bg-fog-100 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Audio Soundwave Visualizer Box */}
          <div className="flex items-center justify-center py-3.5 bg-fog-50 rounded-2xl border border-navy-900/10 relative overflow-hidden">
            {capture.status === "listening" ? (
              <div className="flex items-center justify-center gap-1.5 h-10 px-4">
                <div
                  className="w-1.5 bg-intake-500 rounded-full h-4 animate-pulse"
                  style={{ animationDelay: "0ms" }}
                ></div>
                <div
                  className="w-1.5 bg-intake-600 rounded-full h-8 animate-pulse"
                  style={{ animationDelay: "150ms" }}
                ></div>
                <div
                  className="w-1.5 bg-intake-500 rounded-full h-6 animate-pulse"
                  style={{ animationDelay: "300ms" }}
                ></div>
                <div
                  className="w-1.5 bg-intake-600 rounded-full h-10 animate-pulse"
                  style={{ animationDelay: "100ms" }}
                ></div>
                <div
                  className="w-1.5 bg-intake-400 rounded-full h-5 animate-pulse"
                  style={{ animationDelay: "250ms" }}
                ></div>
                <div
                  className="w-1.5 bg-intake-500 rounded-full h-7 animate-pulse"
                  style={{ animationDelay: "50ms" }}
                ></div>
              </div>
            ) : capture.status === "transcribing" ? (
              <p className="text-xs font-bold text-intake-600 animate-pulse py-2">
                Processing voice recording…
              </p>
            ) : (
              <div className="flex items-center gap-2 py-2 text-fog-600 text-xs font-medium">
                <Microphone size={18} className="text-intake-500" />
                <span>Microphone active</span>
              </div>
            )}
          </div>

          {/* Live Transcript Display Box */}
          <div className="min-h-16 max-h-28 overflow-y-auto bg-fog-50 rounded-2xl p-3.5 border border-navy-900/10 text-center flex items-center justify-center">
            {successSummary ? (
              <div className="flex items-center gap-2 text-success-600 font-bold text-sm">
                <CheckCircle size={20} weight="fill" className="shrink-0" />
                <span>{successSummary}</span>
              </div>
            ) : errorMessage ? (
              <div className="flex items-center gap-2 text-alert-600 font-semibold text-xs text-left">
                <Warning size={18} weight="fill" className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : capture.transcript ? (
              <p className="text-sm font-semibold text-navy-900">
                "{capture.transcript}"
              </p>
            ) : capture.status === "listening" ? (
              <p className="text-xs text-fog-600 animate-pulse">
                Listening… speak e.g. "I drank a 250ml glass of water" or
                "Passed 300ml urine"
              </p>
            ) : (
              <p className="text-xs text-fog-500">Preparing microphone…</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            {capture.status === "listening" ? (
              <button
                onClick={handleStopAndSave}
                className="flex-1 bg-fern-500 hover:bg-fern-600 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                Save Entry
              </button>
            ) : errorMessage ? (
              <button
                onClick={handleOpen}
                className="flex-1 bg-fog-100 hover:bg-fog-200 text-navy-900 font-bold py-2.5 px-4 rounded-xl text-sm transition-colors cursor-pointer border border-navy-900/10"
              >
                Try Again
              </button>
            ) : null}

            <button
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl bg-fog-100 hover:bg-fog-200 text-navy-800 font-semibold text-sm transition-colors cursor-pointer border border-navy-900/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
