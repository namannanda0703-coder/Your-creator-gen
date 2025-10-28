import React, { useState, useRef, useCallback, useEffect } from 'react';
// FIX: Removed LiveSession as it is not an exported member.
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';

// Helper functions for audio processing, embedded directly
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
function createBlob(data: Float32Array): GenAIBlob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}


const Transcriber: React.FC = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  
  // FIX: Using `any` for session promise as `LiveSession` type is not exported.
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const stopRecording = useCallback(() => {
    sessionPromiseRef.current?.then(session => session.close());
    sessionPromiseRef.current = null;
    
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;
    mediaStreamSourceRef.current?.disconnect();
    mediaStreamSourceRef.current = null;
    inputAudioContextRef.current?.close();
    inputAudioContextRef.current = null;
    
    setIsRecording(false);
  }, []);
  
  const startRecording = useCallback(async () => {
    setError(null);
    setTranscription('');
    setIsRecording(true);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        // FIX: Added type assertion to handle vendor-prefixed webkitAudioContext.
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                inputAudioTranscription: {},
            },
            callbacks: {
                onopen: () => {
                    const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                    mediaStreamSourceRef.current = source;
                    const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;
                    
                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContextRef.current!.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    if(message.serverContent?.inputTranscription) {
                        setTranscription(prev => prev + message.serverContent.inputTranscription.text);
                    }
                },
                onerror: (e: ErrorEvent) => { setError(`Session error: ${e.message}`); stopRecording(); },
                onclose: (e: CloseEvent) => { stopRecording(); },
            },
        });
    } catch (e: any) {
        setError(`Failed to start transcription: ${e.message}`);
        setIsRecording(false);
    }
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      // Cleanup on component unmount
      stopRecording();
    };
  }, [stopRecording]);
  
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-accent">Transcribe Audio</h2>
        <p className="text-neutral-400 mt-1">Record audio from your microphone for a live transcription.</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-full max-w-sm flex justify-center items-center gap-2 font-semibold py-3 px-4 rounded-lg transition-all duration-300 ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-accent hover:bg-neutral-300'} text-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>

      {error && <p className="text-red-400 text-center">{error}</p>}
      
      <div className="w-full p-4 bg-brand-gray rounded-lg border border-neutral-700 min-h-[300px]">
        <p className="text-neutral-300 whitespace-pre-wrap">
            {transcription || <span className="text-neutral-500">Transcription will appear here...</span>}
        </p>
      </div>
    </div>
  );
};

export default Transcriber;