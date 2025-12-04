import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Zap, Shield, Heart } from 'lucide-react';

// --- Configuration ---
// NOTE: You MUST update this URL to your live FastAPI endpoint on Render 
// (or whatever service you are using for the API).
const COMPANIONLY_API_URL = 'https://companionly-api-live.onrender.com/chat'; 

const INITIAL_MESSAGE = {
  text: "Hello! I'm Companionly, your AI support. Please share what's on your mind.",
  sender: 'bot',
  type: 'initial',
};

// --- Helper Functions ---
// Simple exponential backoff retry logic for the API call
const fetchWithRetry = async (url, options, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                // Throw an error to trigger retry or final catch
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            if (i < retries - 1) {
                const delay = Math.pow(2, i) * 1000;
                console.warn(`API call failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw new Error('API request failed after multiple retries.');
            }
        }
    }
};


// --- Chat Message Component ---
const ChatMessage = ({ message }) => {
    const isBot = message.sender === 'bot';
    let icon = <MessageSquare size={20} className="text-white" />;
    let color = 'bg-gray-500';

    if (isBot) {
        if (message.type === 'crisis') {
            // Safety Gateway response
            icon = <Shield size={20} className="text-white" />;
            color = 'bg-red-500';
        } else if (message.type === 'support') {
            // GPT-2 support response
            icon = <Heart size={20} className="text-white" />;
            color = 'bg-teal-500';
        } else if (message.type === 'initial') {
            // Initial welcome message
            icon = <Zap size={20} className="text-white" />;
            color = 'bg-indigo-500';
        }
    }

    return (
        <div className={`flex mb-4 ${isBot ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-3/4 p-4 rounded-xl shadow-lg ${isBot ? 'bg-gray-100' : 'bg-teal-500 text-white'}`}>
                {isBot && (
                    <div className="flex items-center mb-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${color}`}>
                            {icon}
                        </div>
                        <span className="font-semibold text-gray-700">
                            {message.type === 'crisis' ? 'Safety Gateway' : 'Companionly'}
                        </span>
                    </div>
                )}
                <p className={`text-lg ${isBot ? 'text-gray-800' : 'text-white'}`}>{message.text}</p>
                {message.citation && isBot && (
                    <p className="text-xs mt-2 italic text-gray-500">
                        Source: {message.citation}
                    </p>
                )}
            </div>
        </div>
    );
};

// --- Main App Component ---
export default function App() {
    const [messages, setMessages] = useState([INITIAL_MESSAGE]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const userText = input.trim();
        if (!userText || isLoading) return;

        // 1. Add user message to history
        const newUserMessage = { text: userText, sender: 'user' };
        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // 2. Call the FastAPI endpoint. Payload key MUST be 'user_message'.
            const data = await fetchWithRetry(COMPANIONLY_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_message: userText }) 
            });

            // 3. Process response. Expecting {"status": "crisis" or "support", "response": "text"}
            const botResponse = {
                text: data.response || "I didn't receive a valid text response.",
                sender: 'bot',
                type: data.status || 'support', 
                citation: data.source_info, // Optional: if your API returns source info
            };

            setMessages(prev => [...prev, botResponse]);

        } catch (error) {
            console.error('Error fetching response:', error);
            setMessages(prev => [
                ...prev,
                {
                    text: "I'm sorry, I'm experiencing technical difficulties. The server may be restarting. Please try again or reach out to the 988 Suicide & Crisis Lifeline.",
                    sender: 'bot',
                    type: 'crisis',
                }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 font-inter">
            {/* Header / Logo */}
            <div className="w-full max-w-4xl p-6 bg-white shadow-lg rounded-xl mb-4 text-center">
                <h1 className="text-4xl font-extrabold text-teal-600 flex items-center justify-center">
                    <Heart className="mr-3 h-8 w-8 text-red-500" />
                    Companionly AI Support
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Your confidential, safety-first mental health companion.
                </p>
            </div>

            {/* Chat Window */}
            <div className="flex flex-col w-full max-w-4xl h-[70vh] bg-white rounded-xl shadow-2xl">
                <div className="flex-grow p-6 overflow-y-auto">
                    {messages.map((msg, index) => (
                        <ChatMessage key={index} message={msg} />
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Form */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                    <div className="flex items-center space-x-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={isLoading ? "Waiting for Companionly..." : "Type your message here..."}
                            disabled={isLoading}
                            className="flex-grow p-3 border border-gray-300 rounded-full focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-50 disabled:opacity-75 transition duration-150"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="bg-teal-600 text-white p-3 rounded-full shadow-md hover:bg-teal-700 transition duration-150 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isLoading ? <Zap size={20} className="animate-spin" /> : <Send size={20} />}
                        </button>
                    </div>
                </form>
            </div>
            
            {/* Footer / Disclaimer */}
            <div className="w-full max-w-4xl mt-4 text-center text-xs text-gray-400">
                Disclaimer: Companionly is an AI support tool, not a substitute for professional medical advice, diagnosis, or treatment. If you are in crisis, please call 988.
            </div>
        </div>
    );
}