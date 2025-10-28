import React, { useState, useCallback } from 'react';
// FIX: Removed GenerateContentRequest as it is not an exported member.
import { GoogleGenAI } from '@google/genai';
import Spinner from './Spinner';

// FIX: Made title optional to match the type from the Gemini API response.
interface GroundingChunk {
  web: {
    uri: string;
    title?: string;
  };
}

const NanoResearchAssistant: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [result, setResult] = useState<string | null>(null);
  const [sources, setSources] = useState<GroundingChunk[]>([]);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a research query.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    setSources([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // FIX: Used `any` type for request to allow conditional addition of `tools` property.
      const request: any = {
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            systemInstruction: "You are an expert research assistant for a PhD student in nanophysics. Provide detailed, accurate, and insightful responses suitable for advanced academic research. When sources are available, cite them implicitly in your response.",
            thinkingConfig: { thinkingBudget: 32768 },
        }
      };

      if (useWebSearch) {
        request.config.tools = [{googleSearch: {}}];
      }
      
      const response = await ai.models.generateContent(request);
      
      setResult(response.text);

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        // FIX: Added type assertion to fix type mismatch after filtering.
        setSources(groundingChunks.filter((chunk: any) => chunk.web?.uri) as GroundingChunk[]);
      }

    } catch (e) {
      console.error(e);
      setError('Failed to generate response. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [prompt, useWebSearch]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-accent">Nano Research Assistant</h2>
        <p className="text-neutral-400 mt-1">Your AI co-pilot for nanophysics research. Summarize literature, generate hypotheses, and accelerate your discoveries.</p>
      </div>

      <div className="flex flex-col gap-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Summarize recent advancements in using graphene for biosensors, focusing on novel fabrication techniques."
          className="w-full p-3 bg-brand-gray border border-neutral-700 rounded-lg text-brand-light placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-shadow duration-300 min-h-[200px]"
          rows={8}
          disabled={isLoading}
        />
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="web-search-checkbox"
            checked={useWebSearch}
            onChange={(e) => setUseWebSearch(e.target.checked)}
            disabled={isLoading}
            className="h-4 w-4 rounded border-gray-300 text-brand-accent focus:ring-brand-accent bg-brand-gray"
          />
          <label htmlFor="web-search-checkbox" className="text-sm font-medium text-neutral-300">
            Include latest web search results (Recommended)
          </label>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isLoading || !prompt}
          className="w-full flex justify-center items-center gap-2 bg-brand-accent text-brand-dark font-semibold py-3 px-4 rounded-lg transition-all duration-300 hover:bg-neutral-300 disabled:bg-brand-gray disabled:text-neutral-500 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {isLoading ? <><Spinner /> Researching...</> : 'Generate Response'}
        </button>
      </div>

      {error && <p className="text-red-400 text-center">{error}</p>}

      { (isLoading || result) &&
        <div className="w-full p-4 bg-brand-gray rounded-lg border border-neutral-700 min-h-[200px]">
          <h3 className="font-semibold text-brand-accent mb-2">Research Output</h3>
          {isLoading && <div className="flex items-center gap-2 text-neutral-400"><Spinner /> <p>Gemini is processing your request...</p></div>}
          {result && <pre className="text-neutral-300 whitespace-pre-wrap font-sans">{result}</pre>}
          {sources.length > 0 && (
            <div className="mt-6">
                <h4 className="font-semibold text-brand-accent mb-3 border-t border-neutral-700 pt-4">Sources</h4>
                <ul className="flex flex-col gap-2">
                    {sources.map((source, index) => (
                        <li key={index} className="text-sm">
                            <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline underline-offset-2 break-all">
                                {source.web.title || source.web.uri}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
          )}
        </div>
      }
    </div>
  );
};

export default NanoResearchAssistant;