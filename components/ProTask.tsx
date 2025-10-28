import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import Spinner from './Spinner';

const ProTask: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 32768 },
        }
      });
      
      setResult(response.text);

    } catch (e) {
      console.error(e);
      setError('Failed to generate response. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [prompt]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-accent">Complex Tasks (Gemini 2.5 Pro)</h2>
        <p className="text-neutral-400 mt-1">Leverage advanced reasoning for your most complex queries. Ideal for coding, analysis, and creative writing.</p>
      </div>

      <div className="flex flex-col gap-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Write Python code for a web application that visualizes real-time stock market data, including backend and frontend components."
          className="w-full p-3 bg-brand-gray border border-neutral-700 rounded-lg text-brand-light placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-shadow duration-300 min-h-[200px]"
          rows={8}
          disabled={isLoading}
        />
        <button
          onClick={handleGenerate}
          disabled={isLoading || !prompt}
          className="w-full flex justify-center items-center gap-2 bg-brand-accent text-brand-dark font-semibold py-3 px-4 rounded-lg transition-all duration-300 hover:bg-neutral-300 disabled:bg-brand-gray disabled:text-neutral-500 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {isLoading ? <><Spinner /> Thinking...</> : 'Generate Response'}
        </button>
      </div>

      {error && <p className="text-red-400 text-center">{error}</p>}

      { (isLoading || result) &&
        <div className="w-full p-4 bg-brand-gray rounded-lg border border-neutral-700 min-h-[200px]">
          <h3 className="font-semibold text-brand-accent mb-2">Result</h3>
          {isLoading && <div className="flex items-center gap-2 text-neutral-400"><Spinner /> <p>Gemini is processing your request...</p></div>}
          {result && <pre className="text-neutral-300 whitespace-pre-wrap font-sans">{result}</pre>}
        </div>
      }
    </div>
  );
};

export default ProTask;