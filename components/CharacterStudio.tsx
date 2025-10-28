import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, VideoGenerationReferenceImage, VideoGenerationReferenceType } from '@google/genai';
import Spinner from './Spinner';

const LOADING_MESSAGES = [
  "Analyzing reference images...",
  "Building the character profile...",
  "Rendering the initial scenes...",
  "This can take a few minutes...",
  "Animating your character...",
  "Finalizing your masterpiece...",
];

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

const CharacterStudio: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [refImages, setRefImages] = useState<(File | null)[]>([null, null, null]);
  const [refImagePreviews, setRefImagePreviews] = useState<(string | null)[]>([null, null, null]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>(LOADING_MESSAGES[0]);
  const intervalRef = useRef<number | null>(null);

  const checkApiKey = useCallback(async () => {
    if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setApiKeySelected(hasKey);
    } else {
      console.warn('window.aistudio not found. Assuming API key is set in environment.');
      setApiKeySelected(!!process.env.API_KEY);
    }
  }, []);

  useEffect(() => {
    checkApiKey();
  }, [checkApiKey]);
  
  useEffect(() => {
    if (isLoading) {
      intervalRef.current = window.setInterval(() => {
        setLoadingMessage(prev => {
          const currentIndex = LOADING_MESSAGES.indexOf(prev);
          const nextIndex = (currentIndex + 1) % LOADING_MESSAGES.length;
          return LOADING_MESSAGES[nextIndex];
        });
      }, 3000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setLoadingMessage(LOADING_MESSAGES[0]);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLoading]);
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const newImages = [...refImages];
      newImages[index] = file;
      setRefImages(newImages);

      const reader = new FileReader();
      reader.onloadend = () => {
        const newPreviews = [...refImagePreviews];
        newPreviews[index] = reader.result as string;
        setRefImagePreviews(newPreviews);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setApiKeySelected(true);
    } else {
      setError("API key selection is not available in this environment.");
    }
  };

  const pollOperation = async (operation: any, ai: GoogleGenAI): Promise<any> => {
    let currentOperation = operation;
    while (!currentOperation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      try {
        currentOperation = await ai.operations.getVideosOperation({ operation: currentOperation });
      } catch (e) {
        throw new Error('Failed while polling for video status.');
      }
    }
    return currentOperation;
  };
  
  const handleGenerate = useCallback(async () => {
    const hasPrompt = prompt.trim();
    const hasImages = refImages.some(img => img !== null);

    if (!hasPrompt || !hasImages) {
      setError('Please enter a prompt and upload at least one reference image.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setVideoUrl(null);
  
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const referenceImagesPayload: VideoGenerationReferenceImage[] = [];
      for (const file of refImages) {
        if (file) {
          const base64EncodeString = await fileToBase64(file);
          referenceImagesPayload.push({
            image: {
              imageBytes: base64EncodeString,
              mimeType: file.type,
            },
            referenceType: VideoGenerationReferenceType.ASSET,
          });
        }
      }

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          referenceImages: referenceImagesPayload,
          resolution: '720p',
          aspectRatio: '16:9',
        }
      });
  
      const completedOperation = await pollOperation(operation, ai);
      
      const downloadLink = completedOperation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error('Video generation succeeded, but no download link was found.');
      
      const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      if (!videoResponse.ok) throw new Error(`Failed to download video. Status: ${videoResponse.status}`);
      
      const videoBlob = await videoResponse.blob();
      setVideoUrl(URL.createObjectURL(videoBlob));
  
    } catch (e: any) {
      console.error(e);
      const errorMessage = e.message || 'An unknown error occurred.';
      setError(`Failed to generate video. ${errorMessage}`);
      if (errorMessage.includes("Requested entity was not found")) {
        setApiKeySelected(false);
        setError("API key is invalid or not found. Please select a valid key.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [prompt, refImages]);

  if (!apiKeySelected) {
    return (
      <div className="text-center p-8 bg-brand-gray rounded-lg animate-fade-in">
        <h3 className="text-xl font-semibold text-brand-accent mb-4">API Key Required</h3>
        <p className="text-neutral-400 mb-6">To generate videos with Veo, you need to select an API key associated with a project that has billing enabled.</p>
        <button
          onClick={handleSelectKey}
          className="bg-brand-accent text-brand-dark font-semibold py-2 px-6 rounded-lg transition-colors hover:bg-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          Select API Key
        </button>
        <p className="text-xs text-neutral-500 mt-4">
          For more information, see the{' '}
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-light">
            billing documentation
          </a>.
        </p>
        {error && <p className="text-red-400 text-center mt-4">{error}</p>}
      </div>
    );
  }

  const isGenerateDisabled = isLoading || !prompt.trim() || !refImages.some(img => img !== null);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-accent">Character Studio (Veo)</h2>
        <p className="text-neutral-400 mt-1">Define a character with up to 3 images and bring them to life in a new video.</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map(index => (
          <div key={index} className="aspect-square bg-brand-gray border-dashed border-2 border-neutral-700 rounded-lg flex items-center justify-center relative overflow-hidden">
            {refImagePreviews[index] ? (
              <img src={refImagePreviews[index]} alt={`Reference ${index+1}`} className="w-full h-full object-cover"/>
            ) : (
              <span className="text-neutral-500 text-sm">Reference Image {index+1}</span>
            )}
            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, index)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isLoading} />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., A video of this character, walking through a futuristic city at night"
          className="w-full p-3 bg-brand-gray border border-neutral-700 rounded-lg text-brand-light placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-shadow duration-300 min-h-[100px]"
          rows={3}
          disabled={isLoading}
        />
        <button
          onClick={handleGenerate}
          disabled={isGenerateDisabled}
          className="w-full flex justify-center items-center gap-2 bg-brand-accent text-brand-dark font-semibold py-3 px-4 rounded-lg transition-all duration-300 hover:bg-neutral-300 disabled:bg-brand-gray disabled:text-neutral-500 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {isLoading ? <><Spinner /> Generating Video...</> : 'Generate Character Video'}
        </button>
      </div>

      {error && <p className="text-red-400 text-center">{error}</p>}

      <div className="w-full aspect-video bg-brand-gray rounded-lg flex items-center justify-center border border-neutral-700 overflow-hidden">
        {isLoading && (
          <div className="flex flex-col items-center gap-4 text-neutral-400 text-center p-4">
            <Spinner />
            <p className="font-medium">{loadingMessage}</p>
            <p className="text-sm text-neutral-500">This may take several minutes. Please be patient.</p>
          </div>
        )}
        {!isLoading && videoUrl && (
          <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain animate-fade-in" />
        )}
        {!isLoading && !videoUrl && (
          <p className="text-neutral-500">Your generated video will appear here</p>
        )}
      </div>
    </div>
  );
};

export default CharacterStudio;
