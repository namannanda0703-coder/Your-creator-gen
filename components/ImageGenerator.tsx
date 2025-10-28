import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import Spinner from './Spinner';

type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
const ASPECT_RATIOS: AspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setImageUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: aspectRatio,
        },
      });
      
      const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
      if (base64ImageBytes) {
        setImageUrl(`data:image/png;base64,${base64ImageBytes}`);
      } else {
        throw new Error('No image data received from the API.');
      }
    } catch (e) {
      console.error(e);
      setError('Failed to generate image. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [prompt, aspectRatio]);
  
  const AspectRatioButton: React.FC<{ratio: AspectRatio}> = ({ratio}) => (
      <button 
        onClick={() => setAspectRatio(ratio)}
        disabled={isLoading}
        className={`px-4 py-2 text-sm font-medium rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-brand-gray ${aspectRatio === ratio ? 'bg-brand-accent text-brand-dark' : 'bg-brand-gray text-brand-light hover:bg-neutral-700'}`}
      >
        {ratio}
      </button>
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-accent">Image Generation (Imagen 4)</h2>
        <p className="text-neutral-400 mt-1">Describe the image you want to create with our most powerful model.</p>
      </div>

      <div className="flex flex-col gap-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., A robot holding a red skateboard."
          className="w-full p-3 bg-brand-gray border border-neutral-700 rounded-lg text-brand-light placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-shadow duration-300 min-h-[100px]"
          rows={3}
          disabled={isLoading}
        />
        <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-neutral-400">Aspect Ratio</label>
            <div className="flex flex-wrap gap-2">
                {ASPECT_RATIOS.map(r => <AspectRatioButton key={r} ratio={r} />)}
            </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isLoading || !prompt}
          className="w-full flex justify-center items-center gap-2 bg-brand-accent text-brand-dark font-semibold py-3 px-4 rounded-lg transition-all duration-300 hover:bg-neutral-300 disabled:bg-brand-gray disabled:text-neutral-500 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {isLoading ? (
            <>
              <Spinner /> Generating...
            </>
          ) : (
            'Generate Image'
          )}
        </button>
      </div>

      {error && <p className="text-red-400 text-center">{error}</p>}

      <div className="w-full aspect-square bg-brand-gray rounded-lg flex items-center justify-center border border-neutral-700 overflow-hidden">
        {isLoading && (
          <div className="flex flex-col items-center gap-2 text-neutral-400">
            <Spinner />
            <p>Creating your vision...</p>
          </div>
        )}
        {!isLoading && imageUrl && (
          <img
            src={imageUrl}
            alt="Generated AI"
            className="w-full h-full object-contain animate-fade-in"
          />
        )}
        {!isLoading && !imageUrl && (
          <p className="text-neutral-500">Your generated image will appear here</p>
        )}
      </div>
    </div>
  );
};

export default ImageGenerator;