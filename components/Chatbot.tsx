import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import Spinner from './Spinner';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }
  useEffect(scrollToBottom, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    setError(null);
    const userMessage: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    try {
      if (!chatRef.current) {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        chatRef.current = ai.chats.create({
          model: 'gemini-2.5-flash',
        });
      }
      
      const response = await chatRef.current.sendMessage({ message: input });
      const modelMessage: Message = { role: 'model', text: response.text };
      setMessages(prev => [...prev, modelMessage]);

    } catch (e) {
      console.error(e);
      setError('Failed to get a response. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [input]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in h-[60vh]">
      <div>
        <h2 className="text-2xl font-bold text-brand-accent">Chat Bot</h2>
        <p className="text-neutral-400 mt-1">Ask a question and get a response from Gemini.</p>
      </div>
      
      <div className="flex-grow bg-brand-gray rounded-lg border border-neutral-700 p-4 overflow-y-auto flex flex-col gap-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-xl p-3 rounded-2xl ${msg.role === 'user' ? 'bg-brand-accent text-brand-dark rounded-br-none' : 'bg-neutral-700 text-brand-light rounded-bl-none'}`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex items-start">
                <div className="max-w-xl p-3 rounded-2xl bg-neutral-700 text-brand-light rounded-bl-none">
                    <Spinner />
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && <p className="text-red-400 text-center">{error}</p>}

      <div className="flex gap-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
          placeholder="Type your message..."
          className="flex-grow p-3 bg-brand-gray border border-neutral-700 rounded-lg text-brand-light placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-shadow duration-300"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="flex justify-center items-center gap-2 bg-brand-accent text-brand-dark font-semibold py-3 px-6 rounded-lg transition-all duration-300 hover:bg-neutral-300 disabled:bg-brand-gray disabled:text-neutral-500 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chatbot;