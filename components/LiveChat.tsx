import React, { useState, useRef, useCallback, useEffect } from 'react';
// FIX: Removed LiveSession as it is not an exported member.
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';
import Spinner from './Spinner';

// Helper functions for audio processing, embedded directly
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
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


const LiveChat: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<{user: string, model: string}[]>([]);
  const [currentInput, setCurrentInput] = useState<string>('');
  const [currentOutput, setCurrentOutput] = useState<string>('');
  
  // FIX: Using `any` for session promise as `LiveSession` type is not exported.
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopSession = useCallback(() => {
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
    
    outputAudioContextRef.current?.close();
    outputAudioContextRef.current = null;
    
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    
    setIsSessionActive(false);
  }, []);
  
  const startSession = useCallback(async () => {
    setError(null);
    setTranscripts([]);
    setCurrentInput('');
    setCurrentOutput('');
    setIsSessionActive(true);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        // FIX: Added type assertion to handle vendor-prefixed webkitAudioContext.
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        // FIX: Added type assertion to handle vendor-prefixed webkitAudioContext.
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
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
                    // Handle audio playback
                    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                    if (audioData) {
                        const outCtx = outputAudioContextRef.current!;
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                        const audioBuffer = await decodeAudioData(decode(audioData), outCtx, 24000, 1);
                        const source = outCtx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outCtx.destination);
                        source.addEventListener('ended', () => { sourcesRef.current.delete(source); });
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        sourcesRef.current.add(source);
                    }
                    if (message.serverContent?.interrupted) {
                      sourcesRef.current.forEach(s => s.stop());
                      sourcesRef.current.clear();
                      nextStartTimeRef.current = 0;
                    }

                    // Handle transcriptions
                    if(message.serverContent?.inputTranscription) {
                        setCurrentInput(prev => prev + message.serverContent.inputTranscription.text);
                    }
                    if(message.serverContent?.outputTranscription) {
                        setCurrentOutput(prev => prev + message.serverContent.outputTranscription.text);
                    }
                    if(message.serverContent?.turnComplete) {
                        setTranscripts(prev => [...prev, {user: currentInput, model: currentOutput}]);
                        setCurrentInput('');
                        setCurrentOutput('');
                    }
                },
                onerror: (e: ErrorEvent) => { setError(`Session error: ${e.message}`); stopSession(); },
                onclose: (e: CloseEvent) => { stopSession(); },
            },
        });
    } catch (e: any) {
        setError(`Failed to start session: ${e.message}`);
        setIsSessionActive(false);
    }
  }, [stopSession, currentInput, currentOutput]);

  useEffect(() => {
    return () => {
      // Cleanup on component unmount
      stopSession();
    };
  }, [stopSession]);
  
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-accent">Live Chat</h2>
        <p className="text-neutral-400 mt-1">Have a real-time voice conversation with Gemini.</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          onClick={isSessionActive ? stopSession : startSession}
          className={`w-full max-w-sm flex justify-center items-center gap-2 font-semibold py-3 px-4 rounded-lg transition-all duration-300 ${isSessionActive ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-accent hover:bg-neutral-300'} text-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
        >
          {isSessionActive ? 'Stop Session' : 'Start Conversation'}
        </button>
        {isSessionActive && <div className="flex items-center gap-2 text-green-400"><Spinner/> Listening...</div>}
      </div>

      {error && <p className="text-red-400 text-center">{error}</p>}
      
      <div className="w-full p-4 bg-brand-gray rounded-lg border border-neutral-700 min-h-[300px] flex flex-col gap-4">
        {transcripts.map((t, i) => (
            <div key={i} className="flex flex-col gap-2">
                <p><strong className="text-brand-accent">You:</strong> {t.user}</p>
                <p><strong className="text-brand-light">Gemini:</strong> {t.model}</p>
            </div>
        ))}
        {isSessionActive && (
            <div className="flex flex-col gap-2">
                {currentInput && <p className="text-neutral-400"><strong className="text-brand-accent">You:</strong> {currentInput}</p>}
                {currentOutput && <p className="text-neutral-400"><strong className="text-brand-light">Gemini:</strong> {currentOutput}</p>}
            </div>
        )}
        {!isSessionActive && transcripts.length === 0 && <p className="text-neutral-500 m-auto">Conversation will appear here</p>}
      </div>
    </div>
  );
};

export default LiveChat;