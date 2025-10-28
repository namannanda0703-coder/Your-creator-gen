import React, { useState, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
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

const ImageEditor: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [originalImage, setOriginalImage] = useState<{ file: File, url: string } | null>(null);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOriginalImage({ file, url: URL.createObjectURL(file) });
      setEditedImageUrl(null); // Clear previous edit on new image upload
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || !originalImage) {
      setError('Please upload an image and enter an editing prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setEditedImageUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const imageBase64 = await fileToBase64(originalImage.file);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: imageBase64,
                mimeType: originalImage.file.type,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      const firstPart = response.candidates?.[0]?.content?.parts?.[0];
      if (firstPart?.inlineData) {
        const base64ImageBytes: string = firstPart.inlineData.data;
        setEditedImageUrl(`data:image/png;base64,${base64ImageBytes}`);
      } else {
        throw new Error('No edited image data received from the API.');
      }
    } catch (e) {
      console.error(e);
      setError('Failed to edit image. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [prompt, originalImage]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-accent">Image Editor</h2>
        <p className="text-neutral-400 mt-1">Upload an image and describe the changes you want to make.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="w-full aspect-square bg-brand-gray border-dashed border-2 border-neutral-700 rounded-lg flex items-center justify-center relative overflow-hidden">
          {originalImage ? (
            <img src={originalImage.url} alt="Original" className="w-full h-full object-contain" />
          ) : (
            <span className="text-neutral-500">Upload Original Image</span>
          )}
          <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isLoading} />
        </div>
        <div className="w-full aspect-square bg-brand-gray rounded-lg flex items-center justify-center border border-neutral-700 overflow-hidden">
          {isLoading && <div className="flex flex-col items-center gap-2 text-neutral-400"><Spinner /><p>Editing your image...</p></div>}
          {!isLoading && editedImageUrl && <img src={editedImageUrl} alt="Edited" className="w-full h-full object-contain animate-fade-in" />}
          {!isLoading && !editedImageUrl && <p className="text-neutral-500">Your edited image will appear here</p>}
        </div>
      </div>
      
      <div className="flex flex-col gap-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Add a retro filter, or remove the person in the background"
          className="w-full p-3 bg-brand-gray border border-neutral-700 rounded-lg text-brand-light placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-shadow duration-300 min-h-[100px]"
          rows={3}
          disabled={isLoading}
        />
        <button
          onClick={handleGenerate}
          disabled={isLoading || !prompt || !originalImage}
          className="w-full flex justify-center items-center gap-2 bg-brand-accent text-brand-dark font-semibold py-3 px-4 rounded-lg transition-all duration-300 hover:bg-neutral-300 disabled:bg-brand-gray disabled:text-neutral-500 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {isLoading ? <><Spinner /> Editing...</> : 'Edit Image'}
        </button>
      </div>

      {error && <p className="text-red-400 text-center">{error}</p>}
    </div>
  );
};

export default ImageEditor;