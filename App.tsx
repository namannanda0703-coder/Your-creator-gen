import React, { useState, useCallback } from 'react';
import { GeneratorMode } from './types';
import ImageGenerator from './components/ImageGenerator';
import VideoGenerator from './components/VideoGenerator';
import CharacterStudio from './components/CharacterStudio';
import ImageEditor from './components/ImageEditor';
import ImageAnalyzer from './components/ImageAnalyzer';
import LiveChat from './components/LiveChat';
import Chatbot from './components/Chatbot';
import Transcriber from './components/Transcriber';
import ProTask from './components/ProTask';
import TTS from './components/TTS';
import NanoResearchAssistant from './components/NanoResearchAssistant';

interface TabButtonProps {
  targetMode: GeneratorMode;
  children: React.ReactNode;
}

const App: React.FC = () => {
  const [mode, setMode] = useState<GeneratorMode>(GeneratorMode.IMAGE);

  const renderGenerator = useCallback(() => {
    switch (mode) {
      case GeneratorMode.IMAGE:
        return <ImageGenerator />;
      case GeneratorMode.VIDEO:
        return <VideoGenerator />;
      case GeneratorMode.CHARACTER:
        return <CharacterStudio />;
      case GeneratorMode.EDIT_IMAGE:
        return <ImageEditor />;
      case GeneratorMode.ANALYZE_IMAGE:
        return <ImageAnalyzer />;
      case GeneratorMode.LIVE_CHAT:
        return <LiveChat />;
      case GeneratorMode.CHATBOT:
        return <Chatbot />;
      case GeneratorMode.TRANSCRIBE:
        return <Transcriber />;
      case GeneratorMode.PRO_TASK:
        return <ProTask />;
      case GeneratorMode.TTS:
        return <TTS />;
      case GeneratorMode.NANO_RESEARCH:
        return <NanoResearchAssistant />;
      default:
        return <ImageGenerator />;
    }
  }, [mode]);

  const TabButton = ({
    targetMode,
    children,
  }: TabButtonProps) => (
    <button
      onClick={() => setMode(targetMode)}
      className={`px-4 sm:px-6 py-2 text-sm font-medium rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark whitespace-nowrap ${
        mode === targetMode
          ? 'bg-brand-accent text-brand-dark'
          : 'text-brand-light hover:bg-brand-gray'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-brand-dark text-brand-light flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <header className="w-full max-w-5xl text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-brand-accent tracking-tight">
          Your Creator Gen
        </h1>
        <p className="text-neutral-400 mt-2 text-lg">
          Your AI Creation Studio
        </p>
      </header>

      <div className="w-full max-w-5xl bg-black rounded-2xl shadow-2xl shadow-neutral-900/50 border border-brand-gray overflow-hidden">
        <div className="p-4 bg-brand-dark border-b border-brand-gray">
          <div className="overflow-x-auto pb-2">
            <div className="flex justify-start sm:justify-center items-center space-x-2 sm:space-x-4">
              <TabButton targetMode={GeneratorMode.IMAGE}>Generate Image</TabButton>
              <TabButton targetMode={GeneratorMode.EDIT_IMAGE}>Edit Image</TabButton>
              <TabButton targetMode={GeneratorMode.ANALYZE_IMAGE}>Analyze Image</TabButton>
              <TabButton targetMode={GeneratorMode.VIDEO}>Generate Video</TabButton>
              <TabButton targetMode={GeneratorMode.CHARACTER}>Character Studio</TabButton>
              <TabButton targetMode={GeneratorMode.LIVE_CHAT}>Live Chat</TabButton>
              <TabButton targetMode={GeneratorMode.CHATBOT}>Chat Bot</TabButton>
              <TabButton targetMode={GeneratorMode.TRANSCRIBE}>Transcribe Audio</TabButton>
              <TabButton targetMode={GeneratorMode.TTS}>Text-to-Speech</TabButton>
              <TabButton targetMode={GeneratorMode.PRO_TASK}>Complex Tasks</TabButton>
              <TabButton targetMode={GeneratorMode.NANO_RESEARCH}>Nano Research</TabButton>
            </div>
          </div>
        </div>

        <main className="p-4 sm:p-6 lg:p-8">
          {renderGenerator()}
        </main>
      </div>
      
      <footer className="w-full max-w-5xl text-center mt-8 text-neutral-500 text-sm">
        <p>Powered by Google Gemini. Designed for creative exploration.</p>
      </footer>
    </div>
  );
};

export default App;