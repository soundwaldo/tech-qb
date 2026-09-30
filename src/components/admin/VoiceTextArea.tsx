"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";

interface SpeechResultLike {
    readonly isFinal: boolean;
    readonly 0: { readonly transcript: string };
}

interface SpeechResultListLike {
    readonly length: number;
    readonly [index: number]: SpeechResultLike;
}

interface SpeechEventLike extends Event {
    readonly results: SpeechResultListLike;
}

interface SpeechErrorEventLike extends Event {
    readonly error: string;
}

interface SpeechRecognitionLike {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechEventLike) => void) | null;
    onerror: ((event: SpeechErrorEventLike) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const subscribeToBrowserCapability = () => () => undefined;

declare global {
    interface Window {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }
}

function recognitionConstructor(): SpeechRecognitionConstructor | undefined {
    if (typeof window === "undefined") return undefined;
    return window.SpeechRecognition || window.webkitSpeechRecognition;
}

function applyVoiceCommands(transcript: string): string {
    return transcript
        .replace(/\bnew paragraph\b/gi, "\n\n")
        .replace(/\b(?:new line|next line)\b/gi, "\n")
        .trim();
}

export function VoiceTextArea({
    name,
    label,
    defaultValue,
    rows,
    required = false,
}: {
    name: string;
    label: string;
    defaultValue: string;
    rows: number;
    required?: boolean;
}) {
    const [value, setValue] = useState(defaultValue);
    const [isListening, setIsListening] = useState(false);
    const isSupported = useSyncExternalStore(
        subscribeToBrowserCapability,
        () => Boolean(recognitionConstructor()),
        () => false,
    );
    const [message, setMessage] = useState("");
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const baseValueRef = useRef("");

    useEffect(() => {
        return () => recognitionRef.current?.abort();
    }, []);

    const stopListening = () => {
        recognitionRef.current?.stop();
        setIsListening(false);
    };

    const startListening = () => {
        const Recognition = recognitionConstructor();
        if (!Recognition) {
            setMessage("Voice dictation is not supported in this browser. Use Chrome or Edge.");
            return;
        }

        const recognition = new Recognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        baseValueRef.current = value.trimEnd();
        recognitionRef.current = recognition;

        recognition.onresult = (event) => {
            let transcript = "";
            for (let index = 0; index < event.results.length; index += 1) {
                transcript += event.results[index][0].transcript;
            }
            const spokenText = applyVoiceCommands(transcript);
            setValue([baseValueRef.current, spokenText].filter(Boolean).join(baseValueRef.current ? " " : ""));
        };
        recognition.onerror = (event) => {
            setIsListening(false);
            recognitionRef.current = null;
            if (event.error === "not-allowed" || event.error === "service-not-allowed") {
                setMessage("Microphone access was blocked. Allow microphone access in your browser and try again.");
            } else if (event.error === "no-speech") {
                setMessage("No speech was detected. Try again and speak closer to the microphone.");
            } else {
                setMessage("Voice dictation stopped unexpectedly. Your typed text is still saved in this field.");
            }
        };
        recognition.onend = () => {
            setIsListening(false);
            recognitionRef.current = null;
        };

        setMessage("Listening… Say “new line” or “new paragraph” to format your notes.");
        setIsListening(true);
        recognition.start();
    };

    return (
        <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={name} className="text-sm font-medium text-slate-300">
                    {label}
                </label>
                <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    disabled={isSupported === false}
                    aria-pressed={isListening}
                    aria-label={`${isListening ? "Stop" : "Start"} voice dictation for ${label}`}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${isListening
                        ? "border-red-400 bg-red-950/60 text-red-200 hover:bg-red-950"
                        : "border-cyan-700 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-950"
                        } disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500`}
                >
                    {isListening ? <Square className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                    {isListening ? "Stop dictation" : "Dictate"}
                </button>
            </div>
            <textarea
                id={name}
                name={name}
                required={required}
                rows={rows}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="field resize-y"
            />
            {isSupported === false ? (
                <p className="mt-2 text-xs text-amber-300">Voice dictation requires a supported browser such as Chrome or Edge.</p>
            ) : null}
            {message ? (
                <p aria-live="polite" className={`mt-2 text-xs ${isListening ? "text-cyan-300" : "text-slate-400"}`}>
                    {message}
                </p>
            ) : null}
        </div>
    );
}
