import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import Spinner from './Spinner';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
};

const ImageAnalyzer: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('Describe this image in detail.');
  const [image, setImage] = useState<{ file: File, url: string } | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage({ file, url: URL.createObjectURL(file) });
      setAnalysis(null);
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!prompt.trim() || !image) {
      setError('Please upload an image and enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const imageBase64 = await fileToBase64(image.file);
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                data: imageBase64,
                mimeType: image.file.type,
              },
            },
            { text: prompt },
          ],
        },
      });
      
      setAnalysis(response.text);

    } catch (e) {
      console.error(e);
      setError('Failed to analyze image. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [prompt, image]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-accent">Image Analyzer</h2>
        <p className="text-neutral-400 mt-1">Upload an image and ask Gemini a question about it.</p>
      </div>

      <div className="w-full aspect-video bg-brand-gray border-dashed border-2 border-neutral-700 rounded-lg flex items-center justify-center relative overflow-hidden">
          {image ? (
            <img src={image.url} alt="To be analyzed" className="w-full h-full object-contain" />
          ) : (
            <span className="text-neutral-500">Upload Image to Analyze</span>
          )}
          <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isLoading} />
      </div>
      
      <div className="flex flex-col gap-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Describe this image in detail."
          className="w-full p-3 bg-brand-gray border border-neutral-700 rounded-lg text-brand-light placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-shadow duration-300"
          rows={2}
          disabled={isLoading}
        />
        <button
          onClick={handleAnalyze}
          disabled={isLoading || !prompt || !image}
          className="w-full flex justify-center items-center gap-2 bg-brand-accent text-brand-dark font-semibold py-3 px-4 rounded-lg transition-all duration-300 hover:bg-neutral-300 disabled:bg-brand-gray disabled:text-neutral-500 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {isLoading ? <><Spinner /> Analyzing...</> : 'Analyze Image'}
        </button>
      </div>

      {error && <p className="text-red-400 text-center">{error}</p>}
      
      { (isLoading || analysis) &&
        <div className="w-full p-4 bg-brand-gray rounded-lg border border-neutral-700 min-h-[150px]">
          <h3 className="font-semibold text-brand-accent mb-2">Analysis Result</h3>
          {isLoading && <div className="flex items-center gap-2 text-neutral-400"><Spinner /> <p>Gemini is analyzing the image...</p></div>}
          {analysis && <p className="text-neutral-300 whitespace-pre-wrap">{analysis}</p>}
        </div>
      }
    </div>
  );
};

export default ImageAnalyzer;