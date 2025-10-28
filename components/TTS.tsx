import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import Spinner from './Spinner';

// Helper function to decode base64 audio data
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper function to convert raw PCM data to an AudioBuffer
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
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


type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
const VOICES: VoiceName[] = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

const TTS: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Zephyr');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    // Initialize AudioContext on first interaction (or component mount)
    // and handle vendor prefixes for cross-browser compatibility.
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    
    return () => {
        // Cleanup audio resources on unmount
        audioSourceRef.current?.stop();
        audioContextRef.current?.close();
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter some text to generate audio.');
      return;
    }
    setIsLoading(true);
    setError(null);

    // Stop any currently playing audio
    if (audioSourceRef.current) {
        audioSourceRef.current.stop();
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
          },
        },
      });
      
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioBuffer = await decodeAudioData(
            decode(base64Audio),
            audioContextRef.current!,
            24000,
            1,
        );
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current!.destination);
        source.start();
        audioSourceRef.current = source;
      } else {
        throw new Error("No audio data received from the API.");
      }

    } catch (e) {
      console.error(e);
      setError('Failed to generate speech. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [prompt, selectedVoice]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-accent">Text-to-Speech</h2>
        <p className="text-neutral-400 mt-1">Convert text into natural-sounding speech with a choice of voices.</p>
      </div>

      <div className="flex flex-col gap-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Say cheerfully: Have a wonderful day!"
          className="w-full p-3 bg-brand-gray border border-neutral-700 rounded-lg text-brand-light placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-shadow duration-300 min-h-[150px]"
          rows={5}
          disabled={isLoading}
        />
        <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-neutral-400">Select a Voice</label>
            <div className="flex flex-wrap gap-2">
                {VOICES.map(voice => (
                    <button 
                        key={voice}
                        onClick={() => setSelectedVoice(voice)}
                        disabled={isLoading}
                        className={`px-4 py-2 text-sm font-medium rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-brand-gray ${selectedVoice === voice ? 'bg-brand-accent text-brand-dark' : 'bg-brand-gray text-brand-light hover:bg-neutral-700'}`}
                    >
                        {voice}
                    </button>
                ))}
            </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isLoading || !prompt}
          className="w-full flex justify-center items-center gap-2 bg-brand-accent text-brand-dark font-semibold py-3 px-4 rounded-lg transition-all duration-300 hover:bg-neutral-300 disabled:bg-brand-gray disabled:text-neutral-500 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {isLoading ? (
            <>
              <Spinner /> Generating Audio...
            </>
          ) : (
            'Generate & Play'
          )}
        </button>
      </div>

      {error && <p className="text-red-400 text-center">{error}</p>}
    </div>
  );
};

export default TTS;
